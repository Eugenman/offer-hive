"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DateTimeInput, isDateTime } from "@/components/date-picker";
import { formatDateTime, toDateTimeLocal } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { type ApplicationSummary, type InterviewKind, STAGE_TYPE_LABELS, type StageType } from "@/lib/domain";
import { useRepository } from "@/lib/repository/provider";
import { saveErrorMessage } from "./save-error";

/** The next event of the same kind: only the event itself is filled in here. */
export function RepeatEventDialog({
  open,
  onOpenChange,
  app,
  type,
  interviewKind,
  after,
  notBefore,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  app: Omit<ApplicationSummary, "events">;
  type: StageType;
  interviewKind: InterviewKind | null;
  /** The latest event of this kind: a new one cannot be earlier than it. */
  after?: string | null;
  /** The application's own date: an event cannot be earlier than the application. */
  notBefore?: string | null;
}) {
  const repository = useRepository();
  const [scheduledAt, setScheduledAt] = useState("");
  const [note, setNote] = useState("");
  // Both limits are local days; a date-only value is already a day and must not be shifted.
  const localDay = (value: string | null | undefined) =>
    value ? (value.length === 10 ? value : toDateTimeLocal(value).slice(0, 10)) : null;
  const minDay =
    [localDay(after), localDay(notBefore)]
      .filter((day): day is string => day !== null)
      .sort()
      .at(-1) ?? undefined;
  const [topic, setTopic] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!isDateTime(scheduledAt)) {
      setError("Pick a date and time");
      return;
    }
    const when = new Date(scheduledAt);
    if (after && when < new Date(after)) {
      setError(`Pick a date after the previous event (${formatDateTime(after)})`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const stage = await repository.addStage(app.id, {
        type,
        interviewKind,
        title: topic.trim() === "" ? null : topic.trim(),
        scheduledAt: new Date(scheduledAt).toISOString(),
        state: "planned",
      });
      // A note written while scheduling belongs to the event it was written for.
      if (note.trim() !== "") {
        await repository.addNote(app.id, { body: note.trim(), stageId: stage.id });
      }
      toast(`${STAGE_TYPE_LABELS[type]} scheduled`);
      onOpenChange(false);
    } catch (caught) {
      setError(saveErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New event</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Topic</span>
            <Input
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              maxLength={120}
              placeholder={STAGE_TYPE_LABELS[type]}
            />
          </label>
          <div className="grid gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Date and time (required)</span>
            <DateTimeInput value={scheduledAt} onValueChange={setScheduledAt} min={minDay} />
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </div>
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Note (optional)</span>
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="What to prepare, who joins, anything to remember"
            />
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
