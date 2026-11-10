"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Archive, ChevronDown, ListFilter } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  type ApplicationStatus,
  type ApplicationSummary,
  BOARD_COLUMNS,
  STATUS_LABELS,
  TERMINAL_STATUSES,
  isReturn,
  stageForStatus,
  statusTargets,
} from "@/lib/domain";
import { COLUMN_BG, COLUMN_TEXT, zoneBarClass } from "@/lib/column-colors";
import { formatDate, toDateTimeLocal } from "@/lib/format";
import { STATE_BADGE_CLASSES } from "@/lib/stage-state";
import {
  setZonePrefs,
  showZone,
  toggleZoneCollapsed,
  toggleZoneHidden,
  useZonePrefs,
} from "@/lib/zone-prefs";
import { nextEvent, sortByNextEvent } from "@/lib/next-event";
import { rememberListPosition } from "../detail/return-to-list";
import { ApplicationCard } from "./application-card";

type KanbanBoardProps = {
  applications: ApplicationSummary[];
  onChangeStatus: (id: string, status: ApplicationStatus) => void;
  onRevertStatus: (app: ApplicationSummary) => void;
  onDelete: (app: ApplicationSummary) => void;
  /** Archives every card of one column. */
  onArchiveColumn: (ids: string[]) => void;
  /** Schedules another event of the current status' kind. */
  onRepeat: (app: ApplicationSummary) => void;
};

/** Columns a card may be dropped on: allowed next statuses, plus the previous one (undo). */
function dropTargets(app: ApplicationSummary): ApplicationStatus[] {
  const targets = statusTargets(app.status);
  return app.previousStatus ? [...targets, app.previousStatus] : targets;
}

// Browsers report the Windows/Linux Delete key and Fn+⌫ on a Mac as "Delete",
// and Backspace / ⌫ / ⌘⌫ as "Backspace", so no OS detection is needed.
const isDeleteKey = (event: React.KeyboardEvent) => event.key === "Delete" || event.key === "Backspace";

type CardHandlers = {
  hintId: string;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
  onRequestDelete: () => void;
  onDeselect: () => void;
  /** Scheduling another dated event; absent when the status cannot carry one. */
  onRepeat?: () => void;
};

function DraggableCard({
  app,
  highlightNext,
  hintId,
  selected,
  onSelect,
  onOpen,
  onRequestDelete,
  onDeselect,
  onRepeat,
}: { app: ApplicationSummary; highlightNext?: boolean } & CardHandlers) {
  const { setNodeRef, listeners, isDragging } = useDraggable({ id: app.id, data: { status: app.status } });
  // Mouse-only drag (agreed): pointer listeners, no keyboard drag. Without a mouse the status is changed
  // in the table or on the application page.
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      data-id={app.id}
      data-kanban-card=""
      // A group, not a button: it contains the eye link, and nested interactive roles are an a11y error.
      role="group"
      aria-roledescription="application card"
      tabIndex={0}
      aria-label={`${app.company}, ${app.position}`}
      aria-describedby={hintId}
      onClick={onSelect}
      onFocus={onSelect}
      onDoubleClick={onOpen}
      onKeyDown={(event) => {
        // Keys pressed on the eye link inside are handled by the link itself.
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter") {
          event.preventDefault();
          onOpen();
        } else if (isDeleteKey(event)) {
          event.preventDefault();
          onRequestDelete();
        } else if (event.key === "Escape") {
          onDeselect();
          (event.currentTarget as HTMLElement).blur();
        }
      }}
      className={cn(
        "cursor-grab touch-none rounded-lg outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50",
        selected && "ring-2 ring-primary/70",
        isDragging && "opacity-40",
      )}
    >
      <ApplicationCard app={app} onRepeat={onRepeat} highlightNext={highlightNext} />
    </div>
  );
}

// The board comes from the model: a few stable columns, each with one or more statuses inside.
const COLUMNS = BOARD_COLUMNS;

// A column has its own colour, separate from the statuses inside: the board reads left to right,
// from a quiet backlog to a loud finish. The palette lives in one place for the whole app.
const columnBadge = (key: string) => `${COLUMN_BG[key]} ${COLUMN_TEXT[key]}`;
// Zone labels can differ from status names when that reads better inside a column.
const ZONE_LABELS: Partial<Record<ApplicationStatus, string>> = {};

/** While dragging: the card's own zone, a zone that accepts it, or one that does not. */
type ZoneState = "idle" | "own" | "accepts" | "refuses";

function Zone({
  status,
  items,
  cardProps,
  state,
  paired,
  divider,
  collapsed,
  onToggleCollapsed,
  focusId,
}: {
  status: ApplicationStatus;
  items: ApplicationSummary[];
  cardProps: (app: ApplicationSummary) => CardHandlers;
  state: ZoneState;
  /** Shares the column with another zone: it gets a label and grows with its cards. */
  paired: boolean;
  /** Thin line above the second zone of a pair. */
  divider: boolean;
  /** Folded by the user: the header stays, the cards hide. */
  collapsed: boolean;
  onToggleCollapsed: () => void;
  /** The card that wears NEXT: only one per column, across all its zones. */
  focusId: string | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status, disabled: state === "refuses" });
  const label = ZONE_LABELS[status] ?? STATUS_LABELS[status];
  const zoneBar = zoneBarClass(status);
  // The zone is a queue: the nearest event on top. The NEXT badge is decided one level up, so a
  // column never shows two of them.
  const ordered = sortByNextEvent(items, nextEventOf);
  const focus = items.find((app) => app.id === focusId);
  const focusInside = focus ? nextEventOf(focus) : null;
  return (
    <div
      ref={setNodeRef}
      role="group"
      aria-label={paired ? `${label}: ${items.length}` : undefined}
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-dashed border-transparent p-1 transition-[opacity,border-color,background-color]",
        // A lone zone takes the whole column; a paired one is at least as tall as a card with
        // three events, so there is always room to drop above or below the cards.
        paired ? "min-h-60" : "flex-1",
        collapsed && "min-h-0",
        divider && state !== "accepts" && "border-t-border",
        state === "accepts" && (isOver ? "border-primary/60 bg-primary/5" : "border-foreground/30"),
        state === "refuses" && "opacity-40",
      )}
    >
      {paired ? (
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-expanded={!collapsed}
          className={cn(
            "flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
            // An empty zone is shown only as a drop target: faded, so it does not read as content.
            items.length === 0 && "opacity-40",
          )}
        >
          <ChevronDown
            aria-hidden
            className={cn("size-3 shrink-0 transition-transform", collapsed && "-rotate-90")}
          />
          {/* A thin bar carries the stage colour; the label itself stays quiet. */}
          {zoneBar ? <span className={cn("h-3 w-[3px] shrink-0 rounded-full", zoneBar)} /> : null}
          {label}
          {/* A zero says nothing: the empty zone is clear on its own. */}
          {/* A zero is shown while the zone is revealed for a drop, so the row never looks broken. */}
          <span className="tabular-nums">{items.length}</span>
          {collapsed && focusInside ? (
            <span
              className={cn(
                "ml-auto shrink-0 rounded px-1 py-0.5 text-[10px] leading-none font-semibold tracking-wide uppercase",
                STATE_BADGE_CLASSES.planned,
              )}
              title={`The nearest event of the column is inside: ${formatDate(toDateTimeLocal(focusInside.scheduledAt!).slice(0, 10))}`}
            >
              Next
            </span>
          ) : null}
        </button>
      ) : null}
      {collapsed
        ? null
        : ordered.map((app) => (
            <DraggableCard key={app.id} app={app} highlightNext={app.id === focusId} {...cardProps(app)} />
          ))}
    </div>
  );
}

function Column({
  columnKey,
  title,
  zones,
  applications,
  cardProps,
  zoneState,
  onArchive,
  dragging,
}: {
  columnKey: string;
  title: string;
  zones: readonly ApplicationStatus[];
  applications: ApplicationSummary[];
  cardProps: (app: ApplicationSummary) => CardHandlers;
  zoneState: (status: ApplicationStatus) => ZoneState;
  onArchive: (ids: string[]) => void;
  dragging: boolean;
}) {
  const prefs = useZonePrefs();
  const inColumn = applications.filter((app) => zones.includes(app.status));
  const total = inColumn.length;
  // An empty zone has nothing to show: it appears only as a drop target while a card is dragged.
  const isVisible = (status: ApplicationStatus) =>
    !prefs.hidden.includes(status) &&
    (applications.some((app) => app.status === status) || (dragging && zoneState(status) !== "refuses"));
  const shown = zones.filter(isVisible);
  // One NEXT per column: the card with the earliest future event among all zones of this column.
  // Exact time decides; on a full tie the zone order does, then the id, so the pick never flickers.
  const focusId =
    shown
      .flatMap((status, zoneIndex) =>
        applications
          .filter((app) => app.status === status)
          .map((app) => ({ id: app.id, at: nextEventOf(app)?.scheduledAt ?? null, zoneIndex })),
      )
      .filter((entry): entry is { id: string; at: string; zoneIndex: number } => entry.at !== null)
      .sort((a, b) => a.at.localeCompare(b.at) || a.zoneIndex - b.zoneIndex || a.id.localeCompare(b.id))[0]
      ?.id ?? null;
  return (
    <section
      aria-label={`${title}: ${total}`}
      className="flex w-64 shrink-0 flex-col gap-2 rounded-xl bg-muted/60 p-2"
    >
      {/* Pinned to the top of the board: the column keeps its name and count in view. */}
      {/* Flush with the top of the column and rounded on every side, so the column keeps its shape
          while the board scrolls under it. */}
      <header className="sticky top-0 z-10 -mx-2 -mt-2 flex items-center gap-2 rounded-xl bg-muted px-3 pt-2.5 pb-2.5">
        {/* The column has its own colour, not the colour of its first status: the badge is built
            here so the palette never depends on overriding another component. */}
        <span
          className={cn(
            "inline-flex h-6 items-center gap-1.5 rounded-md px-2 text-xs font-medium whitespace-nowrap",
            columnBadge(columnKey),
          )}
        >
          {title}
          {/* The count is always there: a column without it looks broken next to the others. */}
          <span className="rounded bg-background px-1 text-[11px] leading-none tabular-nums">{total}</span>
        </span>
        {zones.length > 1 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="ml-auto"
                aria-label={`Choose the zones of ${title}`}
                title="Choose the zones"
              >
                <ListFilter aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {zones.map((status) => (
                <DropdownMenuCheckboxItem
                  key={status}
                  checked={!prefs.hidden.includes(status)}
                  onSelect={(event) => event.preventDefault()}
                  onCheckedChange={() =>
                    setZonePrefs(
                      prefs.hidden.includes(status)
                        ? showZone(prefs, status)
                        : toggleZoneHidden(prefs, status),
                    )
                  }
                >
                  {STATUS_LABELS[status]}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        <Button
          variant="ghost"
          size="icon-sm"
          className={zones.length > 1 ? undefined : "ml-auto"}
          disabled={total === 0}
          onClick={() => onArchive(inColumn.map((app) => app.id))}
          aria-label={`Archive all in ${title}: ${total}`}
          title={total === 0 ? `Nothing in ${title}` : `Archive all ${total} in ${title}`}
        >
          <Archive aria-hidden />
        </Button>
      </header>
      {shown.map((status, index) => (
        <Zone
          key={status}
          status={status}
          items={applications.filter((app) => app.status === status)}
          cardProps={cardProps}
          state={zoneState(status)}
          paired={zones.length > 1}
          divider={index > 0}
          // A folded zone opens up while a card hovers it: you can see where it will land.
          collapsed={prefs.collapsed.includes(status) && !(dragging && zoneState(status) === "accepts")}
          focusId={focusId}
          onToggleCollapsed={() => setZonePrefs(toggleZoneCollapsed(prefs, status))}
        />
      ))}
    </section>
  );
}

/** The nearest planned event of the kind this status schedules, as the card shows it. */
function nextEventOf(app: ApplicationSummary) {
  const mapped = stageForStatus(app.status);
  if (!mapped) return null;
  const matching = app.events.filter(
    (event) => event.type === mapped.type && event.interviewKind === mapped.interviewKind,
  );
  return nextEvent(matching);
}

const quoted = (summary: ApplicationSummary | undefined) => (summary ? summary.company : "Application");

export function KanbanBoard({
  applications,
  onChangeStatus,
  onRevertStatus,
  onDelete,
  onArchiveColumn,
  onRepeat,
}: KanbanBoardProps) {
  const router = useRouter();
  const hintId = useId();
  const boardRef = useRef<HTMLDivElement>(null);
  // A small distance threshold keeps clicks and double-clicks working.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // A step back that the user has to confirm: no silent rewinds in the history.
  const [pendingReturn, setPendingReturn] = useState<{
    app: ApplicationSummary;
    status: ApplicationStatus;
  } | null>(null);

  const byId = new Map(applications.map((app) => [app.id, app]));
  const active = activeId ? byId.get(activeId) : undefined;

  // Reset transient UI when Next.js hides this page (<Activity>).
  useLayoutEffect(() => () => setSelectedId(null), []);

  // A click anywhere outside the cards clears the selection.
  useEffect(() => {
    const clear = (event: PointerEvent) => {
      if (!(event.target as Element).closest("[data-kanban-card], [role=alertdialog]")) setSelectedId(null);
    };
    document.addEventListener("pointerdown", clear);
    return () => document.removeEventListener("pointerdown", clear);
  }, []);

  const announcements: Announcements = {
    onDragStart: ({ active: item }) => `Moving ${quoted(byId.get(String(item.id)))}`,
    onDragOver: ({ over }) => (over ? `Over ${STATUS_LABELS[over.id as ApplicationStatus]}` : ""),
    onDragEnd: ({ active: item, over }) =>
      over
        ? `${quoted(byId.get(String(item.id)))} moved to ${STATUS_LABELS[over.id as ApplicationStatus]}`
        : "Move cancelled",
    onDragCancel: () => "Move cancelled",
  };

  function handleDragEnd({ active: item, over }: DragEndEvent) {
    setActiveId(null);
    if (!over) return;
    const status = over.id as ApplicationStatus;
    const app = byId.get(String(item.id));
    if (!app || app.status === status) return;
    // Dropping back on the previous column undoes the last change instead of logging a new one.
    if (status === app.previousStatus) onRevertStatus(app);
    // A step back is a real change (another round after an offer): ask before writing it down.
    else if (isReturn(app.status, status)) setPendingReturn({ app, status });
    else onChangeStatus(app.id, status);
  }

  const zoneState = (status: ApplicationStatus): ZoneState => {
    if (!active) return "idle";
    if (status === active.status) return "own";
    return dropTargets(active).includes(status) ? "accepts" : "refuses";
  };

  const cardProps = (app: ApplicationSummary): CardHandlers => ({
    hintId,
    selected: selectedId === app.id,
    onSelect: () => setSelectedId(app.id),
    onOpen: () => {
      rememberListPosition(app.id);
      router.push(`/applications/${app.id}`);
    },
    // The page confirms the move, so every archive comes from one dialog.
    onRequestDelete: () => onDelete(app),
    // Only live statuses that can carry a dated event get the "+": a closed process plans nothing.
    onRepeat:
      stageForStatus(app.status) && !(TERMINAL_STATUSES as readonly string[]).includes(app.status)
        ? () => onRepeat(app)
        : undefined,
    onDeselect: () => setSelectedId(null),
  });

  return (
    <DndContext
      sensors={sensors}
      accessibility={{ announcements }}
      onDragStart={({ active: item }) => setActiveId(String(item.id))}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <span id={hintId} className="sr-only">
        Enter to open, Delete to move to the archive
      </span>
      {/* The board scrolls itself, so the columns can pin their headers. The inner row is at least
          the height of the board and grows with the tallest column, keeping every column equal. */}
      <div ref={boardRef} tabIndex={-1} className="h-[calc(100vh-11rem)] overflow-auto outline-none">
        <div className="flex min-h-full items-stretch gap-3 px-6 pt-1 pb-6">
          {COLUMNS.map((column) => (
            <Column
              key={column.title}
              columnKey={column.key}
              title={column.title}
              zones={column.zones}
              applications={applications}
              cardProps={cardProps}
              zoneState={zoneState}
              onArchive={onArchiveColumn}
              dragging={active !== null}
            />
          ))}
        </div>
      </div>
      <AlertDialog
        open={pendingReturn !== null}
        onOpenChange={(open) => {
          if (!open) setPendingReturn(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Back to {pendingReturn ? STATUS_LABELS[pendingReturn.status] : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingReturn
                ? `${pendingReturn.app.company} goes back from ${STATUS_LABELS[pendingReturn.app.status]} to ${STATUS_LABELS[pendingReturn.status]}. This is logged as a new change, not as an undo.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const pending = pendingReturn;
                setPendingReturn(null);
                if (pending) onChangeStatus(pending.app.id, pending.status);
              }}
            >
              Move back
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <DragOverlay dropAnimation={null}>
        {active ? <ApplicationCard app={active} className="w-60 rotate-1 cursor-grabbing shadow-lg" /> : null}
      </DragOverlay>
    </DndContext>
  );
}
