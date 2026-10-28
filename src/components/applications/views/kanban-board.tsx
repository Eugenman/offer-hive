"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
import { cn } from "@/lib/utils";
import { type ApplicationStatus, type ApplicationSummary, STATUS_LABELS, nextStatuses } from "@/lib/domain";
import { rememberListPosition } from "../detail/return-to-list";
import { StatusBadge } from "../status-badge";
import { ApplicationCard } from "./application-card";

type KanbanBoardProps = {
  applications: ApplicationSummary[];
  onChangeStatus: (id: string, status: ApplicationStatus) => void;
  onRevertStatus: (app: ApplicationSummary) => void;
  onDelete: (app: ApplicationSummary) => void;
};

/** Columns a card may be dropped on: allowed next statuses, plus the previous one (undo). */
function dropTargets(app: ApplicationSummary): ApplicationStatus[] {
  return app.previousStatus ? [...nextStatuses(app.status), app.previousStatus] : nextStatuses(app.status);
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
};

function DraggableCard({
  app,
  hintId,
  selected,
  onSelect,
  onOpen,
  onRequestDelete,
  onDeselect,
}: { app: ApplicationSummary } & CardHandlers) {
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
      aria-roledescription="карточка отклика"
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
      <ApplicationCard app={app} />
    </div>
  );
}

// Six columns; three of them hold two related statuses, one zone each.
const COLUMNS: { title: string; zones: ApplicationStatus[] }[] = [
  { title: "Отправлен", zones: ["sent"] },
  { title: "Скрининг", zones: ["screening"] },
  { title: "Интервью", zones: ["interview", "technical"] },
  { title: "Тестовое", zones: ["test_task"] },
  { title: "Оффер", zones: ["offer", "offer_discussion"] },
  { title: "Отказ", zones: ["rejected", "withdrawn"] },
];

// Inside the "Отказ" column the company's refusal reads better next to "Отказался".
const ZONE_LABELS: Partial<Record<ApplicationStatus, string>> = { rejected: "Отказали" };

/** While dragging: the card's own zone, a zone that accepts it, or one that does not. */
type ZoneState = "idle" | "own" | "accepts" | "refuses";

function Zone({
  status,
  items,
  cardProps,
  state,
  paired,
  divider,
}: {
  status: ApplicationStatus;
  items: ApplicationSummary[];
  cardProps: (app: ApplicationSummary) => CardHandlers;
  state: ZoneState;
  /** Shares the column with another zone: it gets a label and grows with its cards. */
  paired: boolean;
  /** Thin line above the second zone of a pair. */
  divider: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status, disabled: state === "refuses" });
  const label = ZONE_LABELS[status] ?? STATUS_LABELS[status];
  return (
    <div
      ref={setNodeRef}
      role="group"
      aria-label={paired ? `${label}: ${items.length}` : undefined}
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-dashed border-transparent p-1 transition-[opacity,border-color,background-color]",
        // A lone zone takes the whole column; paired zones fit their cards (one card's height when empty).
        paired ? "min-h-24" : "flex-1",
        divider && state !== "accepts" && "border-t-border",
        state === "accepts" && (isOver ? "border-primary/60 bg-primary/5" : "border-foreground/30"),
        state === "refuses" && "opacity-40",
      )}
    >
      {paired ? (
        <p aria-hidden className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
          {label}
          <span className="tabular-nums">{items.length}</span>
        </p>
      ) : null}
      {items.map((app) => (
        <DraggableCard key={app.id} app={app} {...cardProps(app)} />
      ))}
    </div>
  );
}

function Column({
  title,
  zones,
  applications,
  cardProps,
  zoneState,
}: {
  title: string;
  zones: ApplicationStatus[];
  applications: ApplicationSummary[];
  cardProps: (app: ApplicationSummary) => CardHandlers;
  zoneState: (status: ApplicationStatus) => ZoneState;
}) {
  const total = applications.filter((app) => zones.includes(app.status)).length;
  return (
    <section
      aria-label={`${title}: ${total}`}
      className="flex w-64 shrink-0 flex-col gap-2 rounded-xl bg-muted/60 p-2"
    >
      <header className="flex items-center gap-2 px-1 pt-1 pb-1">
        <StatusBadge status={zones[0]} label={title} count={total} />
      </header>
      {zones.map((status, index) => (
        <Zone
          key={status}
          status={status}
          items={applications.filter((app) => app.status === status)}
          cardProps={cardProps}
          state={zoneState(status)}
          paired={zones.length > 1}
          divider={index > 0}
        />
      ))}
    </section>
  );
}

const quoted = (summary: ApplicationSummary | undefined) => (summary ? `«${summary.company}»` : "отклик");

export function KanbanBoard({ applications, onChangeStatus, onRevertStatus, onDelete }: KanbanBoardProps) {
  const router = useRouter();
  const hintId = useId();
  const boardRef = useRef<HTMLDivElement>(null);
  // A small distance threshold keeps clicks and double-clicks working.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ApplicationSummary | null>(null);
  const byId = new Map(applications.map((app) => [app.id, app]));
  const active = activeId ? byId.get(activeId) : undefined;

  // Reset transient UI when Next.js hides this page (<Activity>).
  useLayoutEffect(
    () => () => {
      setPendingDelete(null);
      setSelectedId(null);
    },
    [],
  );

  // A click anywhere outside the cards clears the selection.
  useEffect(() => {
    const clear = (event: PointerEvent) => {
      if (!(event.target as Element).closest("[data-kanban-card], [role=alertdialog]")) setSelectedId(null);
    };
    document.addEventListener("pointerdown", clear);
    return () => document.removeEventListener("pointerdown", clear);
  }, []);

  const announcements: Announcements = {
    onDragStart: ({ active: item }) => `Перемещается ${quoted(byId.get(String(item.id)))}`,
    onDragOver: ({ over }) => (over ? `Над колонкой «${STATUS_LABELS[over.id as ApplicationStatus]}»` : ""),
    onDragEnd: ({ active: item, over }) =>
      over
        ? `${quoted(byId.get(String(item.id)))} перемещён в «${STATUS_LABELS[over.id as ApplicationStatus]}»`
        : "Перемещение отменено",
    onDragCancel: () => "Перемещение отменено",
  };

  function handleDragEnd({ active: item, over }: DragEndEvent) {
    setActiveId(null);
    if (!over) return;
    const status = over.id as ApplicationStatus;
    const app = byId.get(String(item.id));
    if (!app || app.status === status) return;
    // Dropping back on the previous column undoes the last change instead of logging a new one.
    if (status === app.previousStatus) onRevertStatus(app);
    else onChangeStatus(app.id, status);
  }

  // Remembers which card to refocus when the dialog closes without deleting.
  const [cancelledId, setCancelledId] = useState<string | null>(null);

  function requestDelete(app: ApplicationSummary) {
    setCancelledId(app.id);
    setPendingDelete(app);
  }

  function confirmDelete() {
    if (!pendingDelete) return;
    setCancelledId(null);
    onDelete(pendingDelete);
    setPendingDelete(null);
    setSelectedId(null);
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
    onRequestDelete: () => requestDelete(app),
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
        Enter — открыть, Delete — удалить
      </span>
      <div
        ref={boardRef}
        tabIndex={-1}
        className="flex min-h-[calc(100vh-11rem)] items-stretch gap-3 overflow-x-auto px-6 pt-1 pb-6 outline-none"
      >
        {COLUMNS.map((column) => (
          <Column
            key={column.title}
            title={column.title}
            zones={column.zones}
            applications={applications}
            cardProps={cardProps}
            zoneState={zoneState}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>
        {active ? <ApplicationCard app={active} className="w-60 rotate-1 cursor-grabbing shadow-lg" /> : null}
      </DragOverlay>

      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent
          onCloseAutoFocus={(event) => {
            // There is no trigger button to return to: put focus back on the card (or the board after delete).
            event.preventDefault();
            const card = cancelledId
              ? boardRef.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(cancelledId)}"]`)
              : null;
            (card ?? boardRef.current)?.focus();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить отклик?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete ? `«${pendingDelete.company}» будет удалён.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete}>
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DndContext>
  );
}
