import type { SummaryStage } from "./domain";

/** A day is "today" from midnight in the viewer's time zone. */
function startOfToday(now: Date) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return start;
}

/**
 * The event that comes next: the nearest planned one that has not started yet, down to the minute.
 * Two calls on the same day are ordered by their clock time, so after the 11:00 one the 15:00 one
 * takes the badge without anybody marking anything.
 *
 * An event that already passed today stays as a fallback: it is still today's business until the
 * day ends, and a card should not lose its marker because the clock ran on.
 */
export function nextEvent(events: SummaryStage[], now: Date = new Date()): SummaryStage | null {
  const planned = events
    .filter((event) => event.state === "planned" && event.scheduledAt !== null)
    .sort((a, b) => a.scheduledAt!.localeCompare(b.scheduledAt!));
  const ahead = planned.find((event) => new Date(event.scheduledAt!).getTime() >= now.getTime());
  if (ahead) return ahead;
  const from = startOfToday(now).getTime();
  return planned.find((event) => new Date(event.scheduledAt!).getTime() >= from) ?? null;
}

/**
 * Cards of one column, the nearest event first. What has no date ahead goes to the bottom: a column
 * reads as a queue of what to prepare for, and the top card is the one the NEXT badge marks.
 */
export function sortByNextEvent<T>(
  items: T[],
  eventOf: (item: T) => { scheduledAt: string | null } | null,
): T[] {
  return [...items].sort((a, b) => {
    const left = eventOf(a)?.scheduledAt ?? null;
    const right = eventOf(b)?.scheduledAt ?? null;
    if (left !== null && right !== null) return left.localeCompare(right);
    if (left !== null) return -1;
    if (right !== null) return 1;
    return 0; // neither has a date: keep the order the list came in
  });
}
