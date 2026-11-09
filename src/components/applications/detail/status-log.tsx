"use client";

import { type ApplicationDetails, type ApplicationStatus } from "@/lib/domain";
import { formatDate, formatDateTime } from "@/lib/format";
import { StatusBadge } from "../status-badge";

/** "Nov 9, 7:16 PM": the day and the time, without the year. */
function shortDateTime(value: string) {
  return formatDateTime(value)?.replace(/, \d{4}/, "") ?? value;
}

type Entry = { status: ApplicationStatus; at: string; day: string; reason: string | null };

/**
 * The history as a timeline: one point per status, oldest first. The first date is the
 * application's own "Date applied", not the moment the record was created.
 */
export function StatusHistory({ app }: { app: ApplicationDetails }) {
  // Newest first in the store; walk it backwards to get the story in order.
  const entries: Entry[] = [];
  for (const change of [...app.statusChanges].reverse()) {
    const initial = change.fromStatus === null;
    const at = initial ? (app.appliedAt ?? change.changedAt) : change.changedAt;
    entries.push({
      status: change.toStatus,
      at,
      day: initial && app.appliedAt ? (formatDate(at) ?? at) : shortDateTime(at),
      reason: change.reason,
    });
  }

  return (
    // One rail for the whole list: a single line, dots on top of it.
    <ol className="grid">
      {entries.map((entry, index) => (
        <li key={`${entry.status}-${entry.at}`} className="relative grid gap-1 py-1.5 pl-5">
          {/* The dot, and a segment that reaches the next dot exactly. */}
          <span aria-hidden className="absolute top-5 left-0 size-[7px] rounded-full bg-muted-foreground" />
          {index < entries.length - 1 ? (
            <span aria-hidden className="absolute top-8 -bottom-[15px] left-[3px] w-px bg-border" />
          ) : null}
          {/* One length for every badge: wide enough for the longest label and the longest date
                ("Nov 30, 11:59 PM"), so nothing wraps and nothing stretches. */}
          <StatusBadge
            status={entry.status}
            className="w-fit min-w-[6.375rem]"
            sub={<time dateTime={entry.at}>{entry.day}</time>}
          />
          {entry.reason ? <p className="text-sm text-muted-foreground">Reason: {entry.reason}</p> : null}
        </li>
      ))}
    </ol>
  );
}
