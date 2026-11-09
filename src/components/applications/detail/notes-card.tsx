"use client";

import { type ApplicationDetails } from "@/lib/domain";
import { useReadOnly } from "./inline-field";
import { AddNoteInline, NoteItem } from "./note-item";
import { DetailCard } from "./detail-card";

/** Notes that belong to the application itself, not to one of its events. */
export function NotesCard({ app }: { app: ApplicationDetails }) {
  const readOnly = useReadOnly();
  const notes = app.notes.filter((note) => note.stageId === null);

  return (
    <DetailCard title="Notes">
      {notes.length ? (
        <ul className="mb-2 divide-y border-y">
          {notes.map((note) => (
            <NoteItem key={note.id} note={note} />
          ))}
        </ul>
      ) : readOnly ? (
        <p className="text-sm text-muted-foreground">No notes</p>
      ) : null}
      <AddNoteInline applicationId={app.id} stageId={null} label="Add note" />
    </DetailCard>
  );
}
