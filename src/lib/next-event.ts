import type { SummaryStage } from "./domain";

/** A day is "today" from midnight in the viewer's time zone. */
function startOfToday(now: Date) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return start;
}

/**
 * The event that comes next: the nearest planned one, today or later. The frame marks what is
 * still ahead, so an event marked done, failed or cancelled gives it up and the next planned one
 * takes over — even when its date is later.
 */
export function nextEvent(events: SummaryStage[], now: Date = new Date()): SummaryStage | null {
  const from = startOfToday(now).getTime();
  const upcoming = events
    .filter((event) => event.state === "planned" && event.scheduledAt !== null)
    .filter((event) => new Date(event.scheduledAt!).getTime() >= from)
    .sort((a, b) => a.scheduledAt!.localeCompare(b.scheduledAt!));
  return upcoming[0] ?? null;
}
