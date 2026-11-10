import { type ApplicationStatus, BOARD_COLUMNS, type StatisticsEntry } from "./domain";

// Funnel counts what applications ever reached (from the status log), not only where they are now:
// an application rejected after an interview still counts as "reached an interview".
// One step per status, never merged: a step nobody went through stays empty.

function reached(app: StatisticsEntry, status: ApplicationStatus) {
  // A wish has not been sent yet; anything further along was, even when imported straight there.
  if (status === "sent") return app.reached.some((value) => value !== "wishlist");
  return app.reached.includes(status) || app.status === status;
}

/** A column counts an application that ever stood in any of its statuses. */
function reachedColumn(app: StatisticsEntry, column: { zones: readonly ApplicationStatus[] }) {
  return column.zones.some((status) => reached(app, status));
}

/**
 * How deep an application got, as a level: 1 screening, 2 interview, 3 technical or a test,
 * 4 an offer, 5 accepted. Counting the deepest level keeps every row of the source table
 * narrowing left to right, whatever order the company used.
 */
const DEPTH: Record<ApplicationStatus, number> = {
  wishlist: 0,
  sent: 0,
  screening: 1,
  interview: 2,
  technical: 3,
  test_task: 3,
  fit: 3,
  offer: 4,
  offer_discussion: 4,
  accepted: 5,
  rejected: 0,
  withdrawn: 0,
};

function depthOf(app: StatisticsEntry) {
  return app.reached.reduce(
    (deepest, status) => Math.max(deepest, DEPTH[status], app.status === status ? DEPTH[status] : 0),
    0,
  );
}

/** A real conversation: any interview, take-home or fit, and everything after them. */
const INTERVIEWS: readonly ApplicationStatus[] = [
  "interview",
  "technical",
  "test_task",
  "fit",
  "offer",
  "offer_discussion",
  "accepted",
];

/** Cards standing in the In process column: the KPI counts that column, not Applied. */
const IN_PROGRESS: readonly ApplicationStatus[] = ["screening", "interview", "technical", "test_task", "fit"];

export type FunnelStep = { key: string; label: string; count: number; share: number };

export type SourceRow = {
  source: string;
  total: number;
  screenings: number;
  interviews: number;
  /** Any of technical, take-home or fit. */
  technical: number;
  offers: number;
};

export type WeekBucket = {
  weekStart: string;
  count: number;
  /** Of those applications: how many got a reply, and how many reached a real conversation. */
  screening: number;
  interviews: number;
};

/** The most often written reasons of one outcome, most frequent first. */
export type ReasonRow = { reason: string; count: number };

export type Statistics = {
  total: number;
  /** How many of `total` are in the archive. */
  archived: number;
  /** How many of `total` were deleted for good; Statistics still count them. */
  deleted: number;
  inProgress: number;
  /** Average days the applications sitting in In process have spent in their current step. */
  avgDaysInProcess: number | null;
  funnel: FunnelStep[];
  outcomes: { accepted: number; rejected: number; withdrawn: number };
  /** Top reasons per outcome, for the "what went wrong" question. */
  reasons: { rejected: ReasonRow[]; withdrawn: ReasonRow[] };
  /**
   * For each step: how many of the previous step's applications also reached this one. Counting
   * the step on its own would lie — an application can be created straight in Applied or jump
   * from there to an Offer, so `offers / interviews` can say "more than 100 %".
   */
  conversions: Record<string, { moved: number; previous: number }>;
  sources: SourceRow[];
  weeks: WeekBucket[];
  /** Applications with a date applied outside the shown weeks. The chart does not hide them. */
  olderThanWindow: number;
};

const share = (part: number, total: number) => (total === 0 ? 0 : part / total);

/**
 * Share of the applications on the previous step that also got to this one. `moved` is not the
 * step's own count: an application can be created straight in Applied, so `applied / wishlist`
 * would be a meaningless 513 %. What matters is how many of the wishes actually became applications.
 */
export function stepConversion(moved: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.min(moved, previous) / previous;
}

/** The three most frequent reasons, so a tooltip stays short. */
function topReasons(applications: StatisticsEntry[], status: ApplicationStatus): ReasonRow[] {
  const counts = new Map<string, number>();
  for (const app of applications) {
    for (const entry of app.reasons ?? []) {
      if (entry.status !== status) continue;
      const reason = entry.reason.trim();
      if (!reason) continue;
      counts.set(reason, (counts.get(reason) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason))
    .slice(0, 3);
}

/** Whole days between an ISO moment and a YYYY-MM-DD day. */
function dayGap(moment: string, day: string) {
  const from = Date.parse(moment);
  const to = Date.parse(`${day}T00:00:00`);
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  return Math.round((to - from) / 86_400_000);
}

/** Monday of the week (UTC) for a YYYY-MM-DD date. */
export function weekStart(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  const shift = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - shift);
  return date.toISOString().slice(0, 10);
}

/**
 * `applications` covers the whole search: active, archived and deleted-for-good applications.
 * Only "In progress" counts what is still active in the list.
 */
export function computeStatistics(applications: StatisticsEntry[], today: string, weeksBack = 8): Statistics {
  const total = applications.length;
  // How long the cards standing in In process have been there, on average.
  const inProcessNow = applications.filter(
    (app) => app.state === "active" && IN_PROGRESS.includes(app.status),
  );
  const ages = inProcessNow
    .map((app) => (app.statusChangedAt ? dayGap(app.statusChangedAt, today) : null))
    .filter((days): days is number => days !== null && days >= 0);
  const avgDaysInProcess =
    ages.length === 0
      ? null
      : Math.round((ages.reduce((sum, days) => sum + days, 0) / ages.length) * 10) / 10;
  // One step per board column: the funnel follows the board, not every single status.
  const funnel: FunnelStep[] = BOARD_COLUMNS.filter((column) => column.key !== "closed").map((column) => {
    const count = applications.filter((app) => reachedColumn(app, column)).length;
    return { key: column.key, label: column.title, count, share: share(count, total) };
  });

  // A real conversion: of those who reached the step before, how many also reached this one.
  const conversions: Record<string, { moved: number; previous: number }> = {};
  const funnelColumns = BOARD_COLUMNS.filter((column) => column.key !== "closed");
  funnelColumns.forEach((column, index) => {
    const previous = funnelColumns[index - 1];
    if (!previous) return;
    const came = applications.filter((app) => reachedColumn(app, previous)).length;
    const moved = applications.filter(
      (app) => reachedColumn(app, previous) && reachedColumn(app, column),
    ).length;
    conversions[column.key] = { moved, previous: came };
  });

  const reasons = {
    rejected: topReasons(applications, "rejected"),
    withdrawn: topReasons(applications, "withdrawn"),
  };

  const bySource = new Map<string, SourceRow>();
  for (const app of applications) {
    const source = app.source ?? "Not specified";
    const row = bySource.get(source) ?? {
      source,
      total: 0,
      screenings: 0,
      interviews: 0,
      technical: 0,
      offers: 0,
    };
    row.total += 1;
    // Counted by depth, so the row always narrows: an application that got to a technical
    // interview has also been through a screening, and jumping straight to an offer counts
    // as the whole way.
    const depth = depthOf(app);
    if (depth >= 1) row.screenings += 1;
    if (depth >= 2) row.interviews += 1;
    if (depth >= 3) row.technical += 1;
    if (depth >= 4) row.offers += 1;
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
    weeks.push({ weekStart: date.toISOString().slice(0, 10), count: 0, screening: 0, interviews: 0 });
  }
  const index = new Map(weeks.map((week, i) => [week.weekStart, i]));
  let olderThanWindow = 0;
  for (const app of applications) {
    if (!app.appliedAt) continue;
    const i = index.get(weekStart(app.appliedAt));
    if (i === undefined) {
      olderThanWindow += 1;
      continue;
    }
    const week = weeks[i];
    week.count += 1;
    if (reached(app, "screening")) week.screening += 1;
    if (INTERVIEWS.some((status) => reached(app, status))) week.interviews += 1;
  }

  return {
    total,
    archived: applications.filter((app) => app.state === "archived").length,
    deleted: applications.filter((app) => app.state === "deleted").length,
    inProgress: applications.filter((app) => app.state === "active" && IN_PROGRESS.includes(app.status))
      .length,
    avgDaysInProcess,
    funnel,
    // A process that ended in a refusal counts as refused even after it was reopened or archived:
    // the report is about the history, not about what is on the board right now.
    outcomes: {
      accepted: applications.filter((app) => reached(app, "accepted")).length,
      rejected: applications.filter((app) => reached(app, "rejected")).length,
      withdrawn: applications.filter((app) => reached(app, "withdrawn")).length,
    },
    sources,
    reasons,
    conversions,
    weeks,
    olderThanWindow,
  };
}
