"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { InlineField, useReadOnly } from "./inline-field";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  type ApplicationDetails,
  type Note,
  type InterviewKind,
  INTERVIEW_KIND_LABELS,
  STAGE_TYPE_LABELS,
  stageForStatus,
  STAGE_STATES,
  STAGE_STATE_LABELS,
  type Stage,
  type StageState,
  type StageType,
} from "@/lib/domain";
import { DateTimeInput, isDateTime } from "@/components/date-picker";
import { formatDateTime, isFutureDay, toDateTimeLocal } from "@/lib/format";
import { useRepository } from "@/lib/repository/provider";
import { stageTitle } from "@/lib/stage-title";
import { STATE_BADGE_CLASSES } from "@/lib/stage-state";
import { DetailCard } from "./detail-card";
import { AddNoteInline, NoteItem } from "./note-item";
import { RepeatEventDialog } from "./repeat-event-dialog";
import { trySave } from "./save-error";

/** Stage date: click to edit; Enter or leaving the field saves, Esc cancels. */
function StageDate({ stage, min }: { stage: Stage; min?: string | null }) {
  const repository = useRepository();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const label = formatDateTime(stage.scheduledAt);
  const readOnly = useReadOnly();

  async function save(value: string) {
    // An unfinished date stays in the field, marked invalid, until it is fixed or Esc is pressed.
    if (value && !isDateTime(value)) return;
    setEditing(false);
    const next = value ? new Date(value).toISOString() : null;
    if (next !== stage.scheduledAt) await repository.updateStage(stage.id, { scheduledAt: next });
  }

  if (readOnly) {
    return label ? <p className="text-xs text-muted-foreground">{label}</p> : null;
  }
  if (editing) {
    return (
      <DateTimeInput
        autoFocus
        size="sm"
        min={min}
        aria-label={`Date: ${stageTitle(stage)}`}
        value={draft}
        onValueChange={setDraft}
        onCommit={(value) => void save(value)}
        onCancel={() => setEditing(false)}
        className="mt-0.5 max-w-72"
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => {
        setDraft(toDateTimeLocal(stage.scheduledAt));
        setEditing(true);
      }}
      aria-label={`Date: ${label ?? "not set"}. Edit`}
      className={cn(
        "rounded-md px-2 text-xs hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        label ? "text-muted-foreground" : "text-muted-foreground/70",
      )}
    >
      {label ?? "Add date"}
    </button>
  );
}

function StageCard({ stage, notes, min }: { stage: Stage; notes: Note[]; min?: string | null }) {
  const repository = useRepository();
  const readOnly = useReadOnly();
  const title = stageTitle(stage);
  // The state menu opens on hover: a short delay lets the pointer travel into the menu.
  const [stateOpen, setStateOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keepOpen = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  // After closing, keep the menu shut for a moment: the pointer is still over the badge, and
  // the element under it changes when the menu unmounts — which fires pointerenter again.
  const cooldown = useRef(0);
  const inside = useRef(false);
  // Opening the menu sets pointer-events: none on <body>, so the badge gets a pointerleave
  // although the pointer has not moved. Ignore leaves for a moment after opening.
  const openedAt = useRef(0);
  const enter = () => {
    inside.current = true;
    if (Date.now() < cooldown.current) return;
    openedAt.current = Date.now();
    keepOpen();
    setStateOpen(true);
  };
  const leave = () => {
    inside.current = false;
    keepOpen();
    if (Date.now() - openedAt.current < 300) return;
    closeTimer.current = setTimeout(() => {
      if (inside.current) return;
      cooldown.current = Date.now() + 400;
      setStateOpen(false);
    }, 300);
  };
  useEffect(() => keepOpen, []);

  return (
    <article className="border-t pt-3 first:border-0 first:pt-0" aria-label={title}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <InlineField
            fieldKey={`stage-title-${stage.id}`}
            label="Event title"
            value={stage.title}
            display={title}
            emptyText={title}
            maxLength={120}
            onSave={(next) => trySave(() => repository.updateStage(stage.id, { title: next }))}
          />
          <StageDate stage={stage} min={min} />
        </div>
        {readOnly || isFutureDay(stage.scheduledAt) ? (
          // A future event keeps its state until its day comes: marking it done or failed early
          // would be a guess. Time of day is ignored on purpose.
          <span
            className={cn(
              "inline-flex h-6 items-center rounded-md px-2 text-xs font-medium",
              STATE_BADGE_CLASSES[stage.state],
            )}
            title={
              isFutureDay(stage.scheduledAt)
                ? `The state can change on ${formatDateTime(stage.scheduledAt)}`
                : undefined
            }
          >
            {STAGE_STATE_LABELS[stage.state]}
          </span>
        ) : (
          <DropdownMenu open={stateOpen} onOpenChange={setStateOpen} modal={false}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                onPointerEnter={enter}
                onPointerLeave={leave}
                className={cn(
                  "inline-flex h-6 cursor-pointer items-center rounded-md px-2 text-xs font-medium ring-1 ring-transparent transition-colors hover:ring-border focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  STATE_BADGE_CLASSES[stage.state],
                )}
                aria-label={`State: ${STAGE_STATE_LABELS[stage.state]}. Change`}
              >
                {STAGE_STATE_LABELS[stage.state]}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40" onPointerEnter={enter} onPointerLeave={leave}>
              <DropdownMenuRadioGroup
                value={stage.state}
                onValueChange={(value) =>
                  void repository.updateStage(stage.id, { state: value as StageState })
                }
              >
                {STAGE_STATES.map((state) => (
                  <DropdownMenuRadioItem key={state} value={state}>
                    <span
                      className={cn("rounded px-1.5 py-0.5 text-xs font-medium", STATE_BADGE_CLASSES[state])}
                    >
                      {STAGE_STATE_LABELS[state]}
                    </span>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {readOnly ? null : (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove ${title} from progress`}
            title="Remove from progress"
            onClick={async () => {
              await repository.removeStage(stage.id);
              toast(`${title} removed from progress`, {
                description: notes.length ? "Its notes moved to the application notes" : undefined,
              });
            }}
          >
            <Trash2 aria-hidden />
          </Button>
        )}
      </div>
      {notes.length ? (
        // Nested under the event: it is a comment on it, not a record of its own.
        <ul className="mt-2 ml-2 grid gap-1 border-l pl-2">
          {notes.map((note) => (
            <NoteItem key={note.id} note={note} />
          ))}
        </ul>
      ) : null}
      <div className="mt-2">
        <AddNoteInline applicationId={stage.applicationId} stageId={stage.id} label="Add note" />
      </div>
    </article>
  );
}

export function StagesSection({ app }: { app: ApplicationDetails }) {
  const readOnly = useReadOnly();
  const [adding, setAdding] = useState(false);
  const mapped = stageForStatus(app.status);
  // "Interview progress": the card is about the event this status schedules.
  // The same rule as on the kanban board: no event before the application, none before the
  // previous event of its kind. Both limits are local days.
  const floor = app.appliedAt ?? app.createdAt;
  const localDay = (value: string | null) =>
    value ? (value.length === 10 ? value : toDateTimeLocal(value).slice(0, 10)) : null;
  const minDayFor = (stage: Stage) => {
    const previous =
      app.stages
        .filter(
          (other) =>
            other.type === stage.type &&
            (other.interviewKind ?? null) === (stage.interviewKind ?? null) &&
            other.seq < stage.seq &&
            other.scheduledAt,
        )
        .map((other) => other.scheduledAt!)
        .sort()
        .at(-1) ?? null;
    return (
      [localDay(floor), localDay(previous)]
        .filter((day): day is string => day !== null)
        .sort()
        .at(-1) ?? null
    );
  };
  // Sections mirror the kanban zones: Interview first, then Technical, then anything else.
  const order: { type: StageType; kind: InterviewKind | null }[] = [
    { type: "interview", kind: null },
    { type: "interview", kind: "technical" },
    { type: "interview", kind: "team" },
    { type: "interview", kind: "manager" },
    { type: "interview", kind: "final" },
    { type: "test_task", kind: null },
    { type: "other", kind: null },
  ];
  const sections = order
    .map(({ type, kind }) => ({
      key: `${type}:${kind ?? ""}`,
      label: kind
        ? INTERVIEW_KIND_LABELS[kind].replace(/^./, (letter) => letter.toUpperCase())
        : STAGE_TYPE_LABELS[type],
      stages: app.stages.filter((stage) => stage.type === type && (stage.interviewKind ?? null) === kind),
    }))
    // Only the sections that actually have events.
    .filter((section) => section.stages.length > 0);
  return (
    <div className="grid content-start gap-4">
      {app.stages.length > 0 || mapped ? (
        <DetailCard title="Progress">
          <div className="grid gap-4">
            {sections.length === 0 ? <p className="text-sm text-muted-foreground">No events yet</p> : null}
            {sections.map((section) => (
              <section key={section.key} className="grid gap-1 rounded-lg px-1 py-2 ring-1 ring-border">
                <p className="flex items-baseline gap-1.5 px-2 text-xs font-medium text-muted-foreground">
                  {section.label}
                  {section.stages.length > 0 ? (
                    <span className="tabular-nums">{section.stages.length}</span>
                  ) : null}
                </p>
                {section.stages.map((stage) => (
                  <StageCard
                    key={stage.id}
                    stage={stage}
                    min={minDayFor(stage)}
                    notes={app.notes.filter((note) => note.stageId === stage.id)}
                  />
                ))}
              </section>
            ))}
          </div>
          {readOnly || !mapped ? null : (
            <div className="mt-2">
              <Button variant="ghost" size="sm" onClick={() => setAdding(true)}>
                <Plus aria-hidden />
                Add event
              </Button>
            </div>
          )}
        </DetailCard>
      ) : null}
      {mapped && adding ? (
        <RepeatEventDialog
          open
          onOpenChange={(open) => {
            if (!open) setAdding(false);
          }}
          app={app}
          type={mapped.type}
          interviewKind={mapped.interviewKind}
          notBefore={app.appliedAt ?? app.createdAt}
          after={
            app.stages
              .filter(
                (stage) =>
                  stage.type === mapped.type &&
                  (stage.interviewKind ?? null) === mapped.interviewKind &&
                  stage.scheduledAt,
              )
              .map((stage) => stage.scheduledAt!)
              .sort()
              .at(-1) ?? null
          }
        />
      ) : null}
    </div>
  );
}
