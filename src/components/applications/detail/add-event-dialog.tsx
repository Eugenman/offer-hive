"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  type ApplicationDetails,
  type ApplicationStatus,
  INTERVIEW_KINDS,
  INTERVIEW_KIND_LABELS,
  type InterviewKind,
  STAGE_STATES,
  STAGE_STATE_LABELS,
  STAGE_TYPE_LABELS,
  STATUSES_WITH_REASON,
  STATUS_LABELS,
  type StageState,
  type StageType,
  nextStatuses,
} from "@/lib/domain";
import { useRepository } from "@/lib/repository/provider";
import { DateTimeInput, isDateTime } from "@/components/date-picker";
import { Field } from "../add/form-field";
import { useApplicationActions } from "../use-application-actions";
import { stageTitle } from "@/lib/stage-title";
import { saveErrorMessage } from "./save-error";

export type EventKind = { kind: "stage"; type: StageType } | { kind: "note" } | { kind: "status" };

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

const TITLES = {
  stage: (type: StageType) => `Progress: ${STAGE_TYPE_LABELS[type].toLowerCase()}`,
  note: "New note",
  status: "Change status",
};

function Actions({ saving, label }: { saving: boolean; label: string }) {
  return (
    <DialogFooter>
      <Button type="submit" disabled={saving}>
        {label}
      </Button>
    </DialogFooter>
  );
}

function StageForm({ app, type, onDone }: { app: ApplicationDetails; type: StageType; onDone: () => void }) {
  const repository = useRepository();
  const [interviewKind, setInterviewKind] = useState("");
  const [title, setTitle] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [state, setState] = useState<StageState>("planned");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (scheduledAt && !isDateTime(scheduledAt)) {
      setError("Enter a date like Oct 29, 2026");
      return;
    }
    setSaving(true);
    try {
      const stage = await repository.addStage(app.id, {
        type,
        interviewKind: type === "interview" && interviewKind ? (interviewKind as InterviewKind) : null,
        title,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        state,
      });
      if (note.trim()) await repository.addNote(app.id, { body: note, stageId: stage.id });
      toast.success(`${stageTitle(stage)} added to progress`);
      onDone();
    } catch (cause) {
      setError(saveErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      {type === "interview" ? (
        <Field label="Interview kind">
          <select
            value={interviewKind}
            onChange={(e) => setInterviewKind(e.target.value)}
            className={selectClass}
          >
            <option value="">Not set</option>
            {INTERVIEW_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {INTERVIEW_KIND_LABELS[kind]}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      <Field label="Title" hint={type === "other" ? "For example, “Meeting with the CTO”" : "Optional"}>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
      </Field>
      <Field label="Date and time">
        <DateTimeInput value={scheduledAt} onValueChange={setScheduledAt} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="State">
          <select
            value={state}
            onChange={(e) => setState(e.target.value as StageState)}
            className={selectClass}
          >
            {STAGE_STATES.map((value) => (
              <option key={value} value={value}>
                {STAGE_STATE_LABELS[value]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Note">
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="What to remember"
        />
      </Field>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Actions saving={saving} label="Add to progress" />
    </form>
  );
}

function NoteForm({ app, onDone }: { app: ApplicationDetails; onDone: () => void }) {
  const repository = useRepository();
  const [body, setBody] = useState("");
  const [stageId, setStageId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await repository.addNote(app.id, { body, stageId: stageId || null });
      toast.success("Note added");
      onDone();
    } catch (cause) {
      setError(saveErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <Field label="Note" required error={error ?? undefined}>
        <Textarea
          value={body}
          autoFocus
          onChange={(e) => {
            setBody(e.target.value);
            setError(null);
          }}
          rows={4}
          placeholder="What they asked, what you agreed on, next steps"
        />
      </Field>
      {app.stages.length > 0 ? (
        <Field label="Belongs to">
          <select value={stageId} onChange={(e) => setStageId(e.target.value)} className={selectClass}>
            <option value="">The whole application</option>
            {app.stages.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stageTitle(stage)}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      <Actions saving={saving} label="Add note" />
    </form>
  );
}

function StatusForm({ app, onDone }: { app: ApplicationDetails; onDone: () => void }) {
  const actions = useApplicationActions();
  const choices = nextStatuses(app.status);
  const [status, setStatus] = useState<ApplicationStatus>(choices[0] ?? app.status);
  const [reason, setReason] = useState("");
  const withReason = STATUSES_WITH_REASON.includes(status);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (status !== app.status) await actions.changeStatus([app.id], status, withReason ? reason : undefined);
    onDone();
  }

  if (choices.length === 0) {
    return (
      <div className="grid gap-4">
        <p className="text-sm">
          {STATUS_LABELS[app.status]} is a final status and can’t be changed further.
          {app.previousStatus
            ? ` If it was set by mistake, go back to ${STATUS_LABELS[app.previousStatus]}.`
            : ""}
        </p>
        <DialogFooter>
          {app.previousStatus ? (
            <Button
              type="button"
              onClick={async () => {
                await actions.revertStatus(app.id, app.previousStatus!);
                onDone();
              }}
            >
              Back to {STATUS_LABELS[app.previousStatus]}
            </Button>
          ) : (
            <Button type="button" onClick={onDone}>
              Got it
            </Button>
          )}
        </DialogFooter>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <Field label="New status" hint={`Now: ${STATUS_LABELS[app.status]}`}>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as ApplicationStatus)}
          className={selectClass}
        >
          {choices.map((value) => (
            <option key={value} value={value}>
              {STATUS_LABELS[value]}
            </option>
          ))}
        </select>
      </Field>
      {withReason ? (
        <Field label="Reason" hint="Optional">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} />
        </Field>
      ) : null}
      <Actions saving={false} label="Change status" />
    </form>
  );
}

export function AddEventDialog({
  app,
  event,
  onClose,
}: {
  app: ApplicationDetails;
  event: EventKind | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={event !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {event ? (
          <>
            <DialogHeader>
              <DialogTitle>
                {event.kind === "stage" ? TITLES.stage(event.type) : TITLES[event.kind]}
              </DialogTitle>
              <DialogDescription className="sr-only">
                {app.company} · {app.position}
              </DialogDescription>
            </DialogHeader>
            {event.kind === "stage" ? <StageForm app={app} type={event.type} onDone={onClose} /> : null}
            {event.kind === "note" ? <NoteForm app={app} onDone={onClose} /> : null}
            {event.kind === "status" ? <StatusForm app={app} onDone={onClose} /> : null}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
