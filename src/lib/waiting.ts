import type { ApplicationStatus, SummaryStage } from "./domain";

/** How long a silence has to last before the card starts asking for a follow-up. */
export const WAITING_DAYS = 7;

const TERMINAL: readonly ApplicationStatus[] = ["accepted", "rejected", "withdrawn"];

/** Local midnight, so "7 days" means seven calendar days in the viewer's time zone. */
function startOfDay(value: Date) {
  const start = new Date(value);
  start.setHours(0, 0, 0, 0);
  return start;
}

/** The date part of an ISO date or timestamp, as a local day. */
function dayOf(value: string) {
  return startOfDay(new Date(value.length === 10 ? `${value}T00:00:00` : value));
}

/**
 * How many days an application has been waiting for an answer, or `null` when nothing is expected.
 *
 * Waiting means: the process is alive, nothing is scheduled ahead, and the last thing that happened
 * (a status change or an event) is older than `WAITING_DAYS`. A planned future event means the ball
 * is in the company's court by agreement, so the card stays quiet.
 */
export function waitingDays(
  app: { status: ApplicationStatus; statusChangedAt: string; createdAt: string; events: SummaryStage[] },
  now: Date = new Date(),
): number | null {
  if (TERMINAL.includes(app.status)) return null;
  // A wish has not been sent yet: there is nothing to wait for.
  if (app.status === "wishlist") return null;

  const today = startOfDay(now);
  const plannedAhead = app.events.some(
    (event) => event.state === "planned" && event.scheduledAt && dayOf(event.scheduledAt) >= today,
  );
  if (plannedAhead) return null;

  const moments = [app.statusChangedAt, app.createdAt, ...app.events.map((event) => event.scheduledAt)]
    .filter((value): value is string => value !== null)
    .map(dayOf);
  const last = Math.max(...moments.map((day) => day.getTime()));
  const days = Math.round((today.getTime() - last) / 86_400_000);
  return days >= WAITING_DAYS ? days : null;
}
