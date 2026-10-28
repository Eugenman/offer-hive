"use client";

import { useState } from "react";
import { Ellipsis, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  type ApplicationDetails,
  type Note,
  STAGE_STATES,
  STAGE_STATE_LABELS,
  type Stage,
  type StageState,
} from "@/lib/domain";
import { formatDateTime, toDateTimeLocal } from "@/lib/format";
import { useRepository } from "@/lib/repository/provider";
import { stageTitle } from "@/lib/stage-title";
import { DetailCard } from "./detail-card";
import { saveErrorMessage } from "./save-error";

const STATE_CLASSES: Record<StageState, string> = {
  planned: "bg-status-sent-bg text-status-sent",
  done: "bg-status-offer-bg text-status-offer",
  cancelled: "bg-status-withdrawn-bg text-status-withdrawn",
};

/** Inline textarea for adding or editing a note: "Save / Cancel", Esc cancels. */
function NoteEditor({
  initial,
  label,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: string;
  label: string;
  submitLabel: string;
  onSubmit: (body: string) => Promise<string | null>;
  onCancel: () => void;
}) {
  const [body, setBody] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="grid gap-2" onKeyDown={(event) => event.key === "Escape" && onCancel()}>
      <Textarea
        autoFocus
        aria-label={label}
        aria-invalid={error ? true : undefined}
        value={body}
        rows={3}
        onChange={(event) => {
          setBody(event.target.value);
          setError(null);
        }}
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Отмена
        </Button>
        <Button size="sm" onClick={async () => setError(await onSubmit(body))}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}

function NoteItem({ note }: { note: Note }) {
  const repository = useRepository();
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <li>
        <NoteEditor
          initial={note.body}
          label="Текст заметки"
          submitLabel="Сохранить"
          onCancel={() => setEditing(false)}
          onSubmit={async (body) => {
            try {
              await repository.updateNote(note.id, { body });
              setEditing(false);
              return null;
            } catch (error) {
              return saveErrorMessage(error);
            }
          }}
        />
      </li>
    );
  }

  return (
    <li className="group flex gap-2 rounded-md py-1.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm whitespace-pre-line">{note.body}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{formatDateTime(note.createdAt)}</p>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Действия с заметкой">
            <Ellipsis aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditing(true)}>Изменить</DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onSelect={async () => {
              await repository.removeNote(note.id);
              toast("Заметка удалена");
            }}
          >
            Удалить
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

function AddNoteInline({
  applicationId,
  stageId,
  label,
}: {
  applicationId: string;
  stageId: string | null;
  label: string;
}) {
  const repository = useRepository();
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-md text-sm text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Plus className="size-4" aria-hidden />
        {label}
      </button>
    );
  }
  return (
    <NoteEditor
      initial=""
      label={label}
      submitLabel="Добавить"
      onCancel={() => setOpen(false)}
      onSubmit={async (body) => {
        try {
          await repository.addNote(applicationId, { body, stageId });
          setOpen(false);
          return null;
        } catch (error) {
          return saveErrorMessage(error);
        }
      }}
    />
  );
}

/** Stage date: click to edit; Enter or leaving the field saves, Esc cancels. */
function StageDate({ stage }: { stage: Stage }) {
  const repository = useRepository();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const label = formatDateTime(stage.scheduledAt);

  async function save() {
    setEditing(false);
    const next = draft ? new Date(draft).toISOString() : null;
    if (next !== stage.scheduledAt) await repository.updateStage(stage.id, { scheduledAt: next });
  }

  if (editing) {
    return (
      <input
        type="datetime-local"
        autoFocus
        aria-label={`Дата: ${stageTitle(stage)}`}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => void save()}
        onKeyDown={(event) => {
          if (event.key === "Enter") void save();
          if (event.key === "Escape") setEditing(false);
        }}
        className="mt-0.5 h-7 rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
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
      aria-label={`Дата: ${label ?? "не указана"}. Изменить`}
      className={cn(
        "-ml-1 rounded-md px-1 text-xs hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        label ? "text-muted-foreground" : "text-muted-foreground/70",
      )}
    >
      {label ?? "Добавить дату"}
    </button>
  );
}

function StageCard({ stage, notes }: { stage: Stage; notes: Note[] }) {
  const repository = useRepository();
  const title = stageTitle(stage);
  return (
    <article className="border-t pt-3 first:border-0 first:pt-0" aria-label={title}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-medium">{title}</h3>
          <StageDate stage={stage} />
        </div>
        <span
          className={cn(
            "inline-flex h-6 items-center rounded-md px-2 text-xs font-medium",
            STATE_CLASSES[stage.state],
          )}
        >
          {STAGE_STATE_LABELS[stage.state]}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Действия: ${title}`}>
              <Ellipsis aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuRadioGroup
              value={stage.state}
              onValueChange={(value) => void repository.updateStage(stage.id, { state: value as StageState })}
            >
              {STAGE_STATES.map((state) => (
                <DropdownMenuRadioItem key={state} value={state}>
                  {STAGE_STATE_LABELS[state]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={async () => {
                await repository.removeStage(stage.id);
                toast(`«${title}» удалено из прогресса`, {
                  description: notes.length ? "Его заметки остались в заметках к отклику" : undefined,
                });
              }}
            >
              Удалить из прогресса
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {notes.length ? (
        <ul className="mt-2 divide-y border-t">
          {notes.map((note) => (
            <NoteItem key={note.id} note={note} />
          ))}
        </ul>
      ) : null}
      <div className="mt-2">
        <AddNoteInline applicationId={stage.applicationId} stageId={stage.id} label="Добавить заметку" />
      </div>
    </article>
  );
}

export function StagesSection({ app }: { app: ApplicationDetails }) {
  const looseNotes = app.notes.filter((note) => note.stageId === null);
  return (
    <div className="grid content-start gap-4">
      {app.stages.length > 0 ? (
        <DetailCard title="Прогресс">
          <div className="grid gap-3">
            {app.stages.map((stage) => (
              <StageCard
                key={stage.id}
                stage={stage}
                notes={app.notes.filter((note) => note.stageId === stage.id)}
              />
            ))}
          </div>
        </DetailCard>
      ) : null}
      <DetailCard title="Заметки к отклику">
        {looseNotes.length ? (
          <ul className="mb-2 divide-y border-y">
            {looseNotes.map((note) => (
              <NoteItem key={note.id} note={note} />
            ))}
          </ul>
        ) : null}
        <AddNoteInline applicationId={app.id} stageId={null} label="Добавить заметку" />
      </DetailCard>
    </div>
  );
}
