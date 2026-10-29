import { type ApplicationDetails, type ApplicationStatus, PIPELINE_STATUSES, STATUS_LABELS } from "./domain";

// Funnel counts what applications ever reached (from the status log), not only where they are now:
// an application rejected after an interview still counts as "reached an interview".
// One step per status, never merged: a step nobody went through stays empty.

function reached(app: ApplicationDetails, status: ApplicationStatus) {
  return app.status === status || app.statusChanges.some((change) => change.toStatus === status);
}

const IN_PROGRESS: readonly ApplicationStatus[] = [
  "sent",
  "screening",
  "interview",
  "technical",
  "test_task",
];

export type FunnelStep = { key: string; label: string; count: number; share: number };

export type SourceRow = {
  source: string;
  total: number;
  screenings: number;
  interviews: number;
  offers: number;
};

export type WeekBucket = { weekStart: string; count: number };

export type Statistics = {
  total: number;
  inProgress: number;
  funnel: FunnelStep[];
  outcomes: { rejected: number; withdrawn: number };
  sources: SourceRow[];
  weeks: WeekBucket[];
};

const share = (part: number, total: number) => (total === 0 ? 0 : part / total);

/** Monday of the week (UTC) for a YYYY-MM-DD date. */
export function weekStart(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  const shift = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - shift);
  return date.toISOString().slice(0, 10);
}

export function computeStatistics(
  applications: ApplicationDetails[],
  today: string,
  weeksBack = 8,
): Statistics {
  const total = applications.length;
  const funnel: FunnelStep[] = PIPELINE_STATUSES.map((status) => {
    const count = applications.filter((app) => reached(app, status)).length;
    const label = STATUS_LABELS[status];
    return { key: status, label, count, share: share(count, total) };
  });

  const bySource = new Map<string, SourceRow>();
  for (const app of applications) {
    const source = app.source ?? "Not specified";
    const row = bySource.get(source) ?? { source, total: 0, screenings: 0, interviews: 0, offers: 0 };
    row.total += 1;
    if (reached(app, "screening")) row.screenings += 1;
    if (reached(app, "interview")) row.interviews += 1;
    if (reached(app, "offer")) row.offers += 1;
    bySource.set(source, row);
  }
  const sources = [...bySource.values()].sort(
    (a, b) => b.total - a.total || a.source.localeCompare(b.source, "en"),
  );

  // Applications per week by the date the user applied (not when the record was created).
  const lastWeek = weekStart(today);
  const weeks: WeekBucket[] = [];
  for (let i = weeksBack - 1; i >= 0; i -= 1) {
    const date = new Date(`${lastWeek}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() - i * 7);
    weeks.push({ weekStart: date.toISOString().slice(0, 10), count: 0 });
  }
  const index = new Map(weeks.map((week, i) => [week.weekStart, i]));
  for (const app of applications) {
    if (!app.appliedAt) continue;
    const i = index.get(weekStart(app.appliedAt));
    if (i !== undefined) weeks[i].count += 1;
  }

  return {
    total,
    inProgress: applications.filter((app) => IN_PROGRESS.includes(app.status)).length,
    funnel,
    outcomes: {
      rejected: applications.filter((app) => app.status === "rejected").length,
      withdrawn: applications.filter((app) => app.status === "withdrawn").length,
    },
    sources,
    weeks,
  };
}
