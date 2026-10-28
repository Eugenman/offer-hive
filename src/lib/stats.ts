import type { ApplicationDetails, ApplicationStatus } from "./domain";

// Funnel counts what applications ever reached (from the status log), not only where they are now:
// an application rejected after an interview still counts as "reached an interview".

// A rejection is a reply from the company too; "withdrawn" is the candidate's own decision.
const RESPONSE_STATUSES: readonly ApplicationStatus[] = ["interview", "test_task", "offer", "rejected"];

function reached(app: ApplicationDetails, statuses: readonly ApplicationStatus[]) {
  return app.statusChanges.some((change) => statuses.includes(change.toStatus)) || statuses.includes(app.status);
}

export type FunnelStep = { key: string; label: string; count: number; share: number };

export type SourceRow = { source: string; total: number; responses: number; interviews: number; offers: number };

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

export function computeStatistics(applications: ApplicationDetails[], today: string, weeksBack = 8): Statistics {
  const total = applications.length;
  const responded = applications.filter((app) => reached(app, RESPONSE_STATUSES)).length;
  const interviewed = applications.filter((app) => reached(app, ["interview"])).length;
  const offered = applications.filter((app) => reached(app, ["offer"])).length;

  const funnel: FunnelStep[] = [
    { key: "sent", label: "Откликов", count: total, share: 1 },
    { key: "response", label: "Получили ответ", count: responded, share: share(responded, total) },
    { key: "interview", label: "Дошли до интервью", count: interviewed, share: share(interviewed, total) },
    { key: "offer", label: "Получили оффер", count: offered, share: share(offered, total) },
  ];

  const bySource = new Map<string, SourceRow>();
  for (const app of applications) {
    const source = app.source ?? "Не указан";
    const row = bySource.get(source) ?? { source, total: 0, responses: 0, interviews: 0, offers: 0 };
    row.total += 1;
    if (reached(app, RESPONSE_STATUSES)) row.responses += 1;
    if (reached(app, ["interview"])) row.interviews += 1;
    if (reached(app, ["offer"])) row.offers += 1;
    bySource.set(source, row);
  }
  const sources = [...bySource.values()].sort((a, b) => b.total - a.total || a.source.localeCompare(b.source, "ru"));

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
    inProgress: applications.filter((app) => ["sent", "interview", "test_task"].includes(app.status)).length,
    funnel,
    outcomes: {
      rejected: applications.filter((app) => app.status === "rejected").length,
      withdrawn: applications.filter((app) => app.status === "withdrawn").length,
    },
    sources,
    weeks,
  };
}
