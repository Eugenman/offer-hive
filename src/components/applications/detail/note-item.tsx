"use client";

import { useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Note } from "@/lib/domain";
import { formatDateTime } from "@/lib/format";
import { useRepository } from "@/lib/repository/provider";
import { useReadOnly } from "./inline-field";
import { saveErrorMessage } from "./save-error";

/**
 * The note editor: a plain textarea in place of the note, no buttons. Enter adds a line,
 * Cmd/Ctrl+Enter or leaving the field saves, Esc cancels.
 */
export function NoteEditor({
  initial,
  label,
  onSubmit,
  onCancel,
}: {
  initial: string;
  label: string;
  onSubmit: (body: string) => Promise<string | null>;
  onCancel: () => void;
}) {
  const [body, setBody] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const saving = useRef(false);

  async function save() {
    if (saving.current) return;
    if (body.trim() === initial.trim()) {
      onCancel();
      return;
    }
    saving.current = true;
    const failure = await onSubmit(body);
    saving.current = false;
    if (failure) setError(failure);
  }

  return (
    <>
      <Textarea
        autoFocus
        aria-label={label}
        aria-invalid={error ? true : undefined}
        value={body}
        rows={1}
        onChange={(event) => {
          setBody(event.target.value);
          setError(null);
        }}
        // Leaving the field saves it, as everywhere else on the page.
        onBlur={() => void save()}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          } else if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            void save();
          }
        }}
        // The same box as the text it replaces: one line, no extra padding, a ring instead of a border.
        className="-mx-2 min-h-0 resize-none rounded-md border-0 bg-muted px-2 py-1 text-sm leading-5 ring-0 focus-visible:bg-muted focus-visible:ring-0"
        // A tint instead of a border: the field is exactly the line of text, no extra height.
      />
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </>
  );
}

export function NoteItem({ note }: { note: Note }) {
  const repository = useRepository();
  const readOnly = useReadOnly();
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <li className="group flex items-start gap-2 py-1.5 pr-0 pl-2">
        <div className="min-w-0 flex-1">
          <NoteEditor
            initial={note.body}
            label="Note text"
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
          {/* The date stays in place while the note is edited. */}
          <p className="mt-0.5 text-xs text-muted-foreground">{formatDateTime(note.createdAt)}</p>
        </div>
      </li>
    );
  }

  return (
    // No rounding: the row carries the divide line between notes, and a rounded border looks bent.
    <li className="group flex items-start gap-2 py-1.5 pr-0 pl-2">
      <div className="min-w-0 flex-1">
        {readOnly ? (
          <p className="text-sm whitespace-pre-line">{note.body}</p>
        ) : (
          // Click the text to edit it, like the fields in Details.
          <button
            type="button"
            onClick={() => setEditing(true)}
            title="Click to edit"
            className="-mx-2 block w-full rounded-md px-2 py-1 text-left text-sm whitespace-pre-line hover:bg-muted focus-visible:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            {note.body}
          </button>
        )}
        <p className="mt-0.5 text-xs text-muted-foreground">{formatDateTime(note.createdAt)}</p>
      </div>
      {readOnly ? null : (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Delete note"
          title="Delete note"
          onClick={async () => {
            await repository.removeNote(note.id);
            toast("Note deleted");
          }}
        >
          <Trash2 aria-hidden />
        </Button>
      )}
    </li>
  );
}

export function AddNoteInline({
  applicationId,
  stageId,
  label,
}: {
  applicationId: string;
  stageId: string | null;
  label: string;
}) {
  const repository = useRepository();
  const readOnly = useReadOnly();
  const [open, setOpen] = useState(false);
  if (readOnly) return null;
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-md px-2 text-sm text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
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
