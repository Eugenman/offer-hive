"use client";

import { useEffect, useRef, useState } from "react";
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
import {
  APPLICATION_STATUSES,
  type ApplicationStatus,
  type ApplicationSummary,
  STATUS_LABELS,
} from "@/lib/domain";
import { StatusBadge } from "../status-badge";
import { ApplicationCard } from "./application-card";

type KanbanBoardProps = {
  applications: ApplicationSummary[];
  onChangeStatus: (id: string, status: ApplicationStatus) => void;
  onDelete: (app: ApplicationSummary) => void;
};

const HINT_ID = "kanban-card-hint";

// Browsers report the Windows/Linux Delete key and Fn+⌫ on a Mac as "Delete",
// and Backspace / ⌫ / ⌘⌫ as "Backspace", so no OS detection is needed.
const isDeleteKey = (event: React.KeyboardEvent) => event.key === "Delete" || event.key === "Backspace";

type CardHandlers = {
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
  onRequestDelete: () => void;
  onDeselect: () => void;
};

function DraggableCard({ app, selected, onSelect, onOpen, onRequestDelete, onDeselect }: { app: ApplicationSummary } & CardHandlers) {
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
      aria-describedby={HINT_ID}
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

function Column({
  status,
  items,
  cardProps,
}: {
  status: ApplicationStatus;
  items: ApplicationSummary[];
  cardProps: (app: ApplicationSummary) => CardHandlers;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  // The whole column, top to bottom, is a drop target.
  return (
    <section
      ref={setNodeRef}
      aria-label={`${STATUS_LABELS[status]}: ${items.length}`}
      className={cn(
        "flex w-64 shrink-0 flex-col gap-2 rounded-xl bg-muted/60 p-2 transition-colors",
        isOver && "bg-primary/5 ring-2 ring-primary/40",
      )}
    >
      <header className="flex items-center gap-2 px-1 pt-1 pb-1">
        <StatusBadge status={status} />
        <span className="text-sm text-muted-foreground tabular-nums">{items.length}</span>
      </header>
      {items.map((app) => (
        <DraggableCard key={app.id} app={app} {...cardProps(app)} />
      ))}
    </section>
  );
}

const quoted = (summary: ApplicationSummary | undefined) => (summary ? `«${summary.company}»` : "отклик");

export function KanbanBoard({ applications, onChangeStatus, onDelete }: KanbanBoardProps) {
  const router = useRouter();
  const boardRef = useRef<HTMLDivElement>(null);
  // A small distance threshold keeps clicks and double-clicks working.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ApplicationSummary | null>(null);
  const byId = new Map(applications.map((app) => [app.id, app]));
  const active = activeId ? byId.get(activeId) : undefined;

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
    if (item.data.current?.status !== status) onChangeStatus(String(item.id), status);
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

  const cardProps = (app: ApplicationSummary): CardHandlers => ({
    selected: selectedId === app.id,
    onSelect: () => setSelectedId(app.id),
    onOpen: () => router.push(`/applications/${app.id}`),
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
      <span id={HINT_ID} className="sr-only">
        Enter — открыть, Delete — удалить
      </span>
      <div
        ref={boardRef}
        tabIndex={-1}
        className="flex min-h-[calc(100vh-11rem)] items-stretch gap-3 overflow-x-auto px-6 pt-1 pb-6 outline-none"
      >
        {APPLICATION_STATUSES.map((status) => (
          <Column
            key={status}
            status={status}
            items={applications.filter((app) => app.status === status)}
            cardProps={cardProps}
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
