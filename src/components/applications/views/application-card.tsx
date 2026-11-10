"use client";

import Link from "next/link";
import { Eye, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { type ApplicationSummary, TERMINAL_STATUSES, stageForStatus } from "@/lib/domain";
import { formatDate, formatDateTime, formatSalary, toDateTimeLocal } from "@/lib/format";
import { waitingDays } from "@/lib/waiting";
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
  /**
   * Marks the nearest event of its zone with the NEXT chip. The board turns it on for one card per
   * zone, so the chip keeps meaning "the first thing to prepare for".
   */
  highlightNext?: boolean;
};

/** Compact card used by the kanban board. Open via the eye button (the board adds double-click / Enter). */
export function ApplicationCard({ app, className, onRepeat, highlightNext = true }: ApplicationCardProps) {
  const salary = formatSalary(app.salaryMin, app.salaryMax, app.currency);
  // The zone header already names the status, so the card only speaks up about a silence.
  const waiting = waitingDays(app);
  // A finished process has no plans: on the board it shows the day it ended, not its events.
  const finished = (TERMINAL_STATUSES as readonly string[]).includes(app.status);
  const finishedOn = finished
    ? formatDate(toDateTimeLocal(app.statusChangedAt).slice(0, 10))?.replace(/, \d{4}/, "")
    : null;
  // A wish has no date applied yet: show when it was added instead.
  const applied = formatDate(app.appliedAt ?? toDateTimeLocal(app.createdAt).slice(0, 10));
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
    // The frame and the chip belong to the one nearest event of the zone.
    next: highlightNext && upcoming !== null && upcoming.seq === event.seq && upcoming.type === event.type,
    state: event.state,
  }));
  // Never more than three: a card with ten interviews would stretch the whole board.
  const events = allEvents.slice(0, 3);
  const hidden = allEvents.length - events.length;
  return (
    <article
      className={cn(
        "relative rounded-lg bg-card p-3 text-sm shadow-xs ring-1 ring-border",
        // A silence longer than a week gets a warm frame: time to write the recruiter.
        waiting !== null && "ring-2 ring-amber-500/45",
        className,
      )}
    >
      <div className="flex items-start gap-2.5 pr-8">
        <CompanyAvatar name={app.company} className="size-7 text-xs" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{app.company}</p>
          <p className="truncate text-muted-foreground">{app.position}</p>
        </div>
      </div>
      {waiting !== null ? (
        <p className="mt-1.5">
          <span
            className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 tabular-nums dark:text-amber-400"
            title={`Nothing planned and no answer for ${waiting} days`}
          >
            No reply · {waiting} d
          </span>
        </p>
      ) : null}
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
      {finished && finishedOn ? (
        <p className="mt-2 text-xs text-muted-foreground tabular-nums">
          {app.status === "accepted" ? "Accepted" : "Closed"} · {finishedOn}
        </p>
      ) : null}
      {!finished && events.length > 0 ? (
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
                </span>
                {/* The moment has its own line: a long title never fights the clock for room. */}
                <span className="flex w-full min-w-0 items-center gap-1.5 text-muted-foreground">
                  <span className="min-w-0 flex-1 truncate tabular-nums">{event.date}</span>
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
