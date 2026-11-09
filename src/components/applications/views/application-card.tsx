"use client";

import Link from "next/link";
import { Eye, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { ApplicationSummary } from "@/lib/domain";
import { formatDate, formatDateTime, formatSalary } from "@/lib/format";
import { stageForStatus } from "@/lib/domain";
import { nextEvent } from "@/lib/next-event";
import { STATE_BADGE_CLASSES, STATE_BORDER_CLASSES } from "@/lib/stage-state";
import { stageLabel } from "@/lib/stage-title";
import { CompanyAvatar } from "../company-avatar";
import { NoteCell } from "../note-cell";

type ApplicationCardProps = {
  app: ApplicationSummary;
  className?: string;
  /** Shown on statuses that can carry a dated event: schedules the next one of the same kind. */
  onRepeat?: () => void;
};

/** Compact card used by the kanban board. Open via the eye button (the board adds double-click / Enter). */
export function ApplicationCard({ app, className, onRepeat }: ApplicationCardProps) {
  const salary = formatSalary(app.salaryMin, app.salaryMax, app.currency);
  const applied = formatDate(app.appliedAt);
  // The progress of this status, newest first — the same events the application page shows.
  const mapped = stageForStatus(app.status);
  const matching =
    mapped === null
      ? []
      : app.events.filter(
          (event) => event.type === mapped.type && event.interviewKind === mapped.interviewKind,
        );
  // The nearest upcoming event of this card's kind, framed exactly as in the table.
  const upcoming = nextEvent(matching);
  const allEvents = matching.map((event) => ({
    key: event.seq,
    label: stageLabel(event),
    seq: event.seq,
    date: formatDateTime(event.scheduledAt)?.replace(/, \d{4}/, "") ?? "No date",
    next: upcoming !== null && upcoming.seq === event.seq && upcoming.type === event.type,
    state: event.state,
  }));
  // Never more than three: a card with ten interviews would stretch the whole board.
  const events = allEvents.slice(0, 3);
  const hidden = allEvents.length - events.length;
  return (
    <article
      className={cn("relative rounded-lg bg-card p-3 text-sm shadow-xs ring-1 ring-border", className)}
    >
      <div className="flex items-start gap-2.5 pr-8">
        <CompanyAvatar name={app.company} className="size-7 text-xs" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{app.company}</p>
          <p className="truncate text-muted-foreground">{app.position}</p>
        </div>
      </div>
      <Link
        href={`/applications/${app.id}`}
        aria-label={`Open ${app.company}`}
        title="Open"
        // Keeps a press on the button from starting a drag of the whole card.
        onPointerDown={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
        className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Eye className="size-4" aria-hidden />
      </Link>
      {onRepeat ? (
        <Button
          variant="ghost"
          size="icon-sm"
          className="absolute right-1.5 bottom-1.5"
          aria-label="Schedule another event"
          title="Schedule another event"
          onPointerDown={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onRepeat();
          }}
        >
          <Plus className="size-4" aria-hidden />
        </Button>
      ) : null}
      {salary || applied ? (
        <p className="mt-2 flex flex-wrap gap-x-3 pr-8 text-xs text-muted-foreground tabular-nums">
          {applied ? <span>{applied}</span> : null}
          {salary ? <span>{salary}</span> : null}
        </p>
      ) : null}
      {events.length > 0 ? (
        <ul className="mt-2 divide-y border-t text-xs">
          {events.map((event) => (
            <li key={event.key} className="py-1.5">
              <span
                className={cn(
                  "grid gap-0.5",
                  event.next && [
                    "rounded-lg border-2 border-dashed px-2 py-1",
                    STATE_BORDER_CLASSES[event.state],
                  ],
                )}
              >
                <span className="flex w-full min-w-0 items-center gap-1.5 font-medium">
                  {/* The title is cut with an ellipsis, the number is always visible. */}
                  <span className="min-w-0 flex-1 truncate">{event.label}</span>
                  <span className="shrink-0 text-muted-foreground tabular-nums">#{event.seq}</span>
                  {/* The same word the table uses in its column, at the end of the row. */}
                  {event.next ? (
                    <span
                      className={cn(
                        "shrink-0 rounded px-1 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
                        STATE_BADGE_CLASSES.planned,
                      )}
                    >
                      Next
                    </span>
                  ) : null}
                </span>
                <span className="text-muted-foreground tabular-nums">{event.date}</span>
              </span>
            </li>
          ))}
          {hidden > 0 ? <li className="py-1.5 text-muted-foreground">+{hidden} more</li> : null}
        </ul>
      ) : null}
      {app.notes.length > 0 ? (
        // The notes button covers this row: hovering it shows every note, as in the table.
        <div className="relative mt-2 mr-10">
          <NoteCell notes={app.notes} />
        </div>
      ) : null}
    </article>
  );
}
