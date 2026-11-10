import { describe, expect, test } from "bun:test";
import { BOARD_COLUMNS, type StatisticsEntry } from "./domain";
import { computeStatistics, stepConversion, weekStart } from "./stats";

// Statistics cover the whole search, so the fixtures below mix active, archived and deleted rows.
// The funnel counts what an application ever reached, not only where it stands today.

function entry(id: string, over: Partial<StatisticsEntry> = {}): StatisticsEntry {
  return {
    id,
    company: "Acme",
    position: "Developer",
    source: null,
    appliedAt: null,
    status: "sent",
    reached: ["sent"],
    state: "active",
    ...over,
  };
}

const funnelCount = (stats: ReturnType<typeof computeStatistics>, key: string) =>
  stats.funnel.find((step) => step.key === key)?.count;

describe("weekStart", () => {
  test("a Monday is its own week start", () => {
    expect(weekStart("2026-11-02")).toBe("2026-11-02");
  });

  test("a mid-week day belongs to the Monday before it", () => {
    // 2026-11-05 is a Thursday.
    expect(weekStart("2026-11-05")).toBe("2026-11-02");
  });

  test("Sunday closes the same week, not the next one", () => {
    expect(weekStart("2026-11-08")).toBe("2026-11-02");
  });

  test("the first days of a month reach back into the previous one", () => {
    // 2026-11-01 is a Sunday; its Monday is in October.
    expect(weekStart("2026-11-01")).toBe("2026-10-26");
  });
});

describe("stepConversion", () => {
  test("a share of the previous step", () => {
    expect(stepConversion(33, 41)).toBeCloseTo(0.804);
  });

  test("an empty previous step has no conversion", () => {
    expect(stepConversion(0, 0)).toBeNull();
  });

  test("more moved than came in is impossible and is clamped", () => {
    expect(stepConversion(41, 8)).toBe(1);
  });
});

describe("computeStatistics", () => {
  const today = "2026-11-05";
  const rows: StatisticsEntry[] = [
    entry("a1", { source: "LinkedIn", appliedAt: "2026-11-04" }),
    entry("a2", {
      status: "rejected",
      reached: ["sent", "screening", "interview"],
      source: "LinkedIn",
      appliedAt: "2026-10-28",
    }),
    entry("a3", { state: "archived" }),
    entry("a4", {
      status: "rejected",
      reached: ["sent", "screening"],
      source: "HH",
      appliedAt: "2026-01-01",
      state: "deleted",
    }),
  ];

  test("the funnel counts columns ever reached, not the current status", () => {
    const stats = computeStatistics(rows, today);
    // All four were sent; two of them got a reply.
    expect(funnelCount(stats, "applied")).toBe(4);
    // Rejected after an interview still counts as reaching "In process".
    expect(funnelCount(stats, "in_process")).toBe(2);
    expect(funnelCount(stats, "offer")).toBe(0);
    expect(funnelCount(stats, "accepted")).toBe(0);
  });

  test("the funnel follows the board columns", () => {
    // The statistics page looks steps up by column key: a rename here must break this test, not the page.
    const stats = computeStatistics(rows, today);
    expect(stats.funnel.map((step) => step.key)).toEqual(
      BOARD_COLUMNS.filter((column) => column.key !== "closed").map((column) => column.key),
    );
  });

  test("a wish counts as a wish, not as a sent application", () => {
    const stats = computeStatistics([entry("w1", { status: "wishlist", reached: ["wishlist"] })], today);
    expect(funnelCount(stats, "wishlist")).toBe(1);
    expect(funnelCount(stats, "applied")).toBe(0);
  });

  test("every application counts as applied, even one that starts later", () => {
    const stats = computeStatistics([entry("x", { status: "offer", reached: ["offer"] })], today);
    expect(funnelCount(stats, "applied")).toBe(1);
    expect(funnelCount(stats, "offer")).toBe(1);
  });

  test("shares are fractions of the total, and zero stays zero", () => {
    const stats = computeStatistics(rows, today);
    // The funnel starts at Wishlist, so look the step up by key.
    expect(stats.funnel.find((step) => step.key === "applied")?.share).toBe(1);
    expect(stats.funnel.find((step) => step.key === "in_process")?.share).toBe(0.5);
    expect(computeStatistics([], today).funnel[0].share).toBe(0);
  });

  test("only active cards in the In process column count as in progress", () => {
    const stats = computeStatistics(rows, today);
    expect(stats.total).toBe(4);
    expect(stats.archived).toBe(1);
    expect(stats.deleted).toBe(1);
    // a1 stands in Applied: it is live, but not in process yet.
    expect(stats.inProgress).toBe(0);

    const inProcess = computeStatistics(
      [entry("p1", { status: "technical", reached: ["sent", "technical"] })],
      today,
    );
    expect(inProcess.inProgress).toBe(1);
  });

  test("outcomes count the history, not the current column", () => {
    const stats = computeStatistics(rows, today);
    // Both entries were refused at some point; one of them is in the archive now.
    expect(stats.outcomes).toEqual({ accepted: 0, rejected: 2, withdrawn: 0 });
  });

  test("nobody can be in process now without having reached it", () => {
    const stats = computeStatistics(rows, today);
    const reachedInProcess = stats.funnel.find((step) => step.key === "in_process")!.count;
    // The KPI counts active cards, the funnel counts everyone ever: the funnel can never be smaller.
    expect(reachedInProcess).toBeGreaterThanOrEqual(stats.inProgress);
  });

  test("conversions carry the step, the previous step and the overlap", () => {
    const stats = computeStatistics(rows, today);
    // 2 of the 4 applied reached In process, and both of those came through Applied.
    expect(stats.conversions.in_process).toEqual({ moved: 2, previous: 4 });
    expect(stepConversion(2, 4)).toBe(0.5);
  });

  test("a wish that never became an application is not a conversion", () => {
    const stats = computeStatistics(
      [entry("w1", { status: "wishlist", reached: ["wishlist"] }), entry("a1")],
      today,
    );
    // The wish and the application are different cards: nothing converted.
    expect(stats.conversions.applied).toEqual({ moved: 0, previous: 1 });
  });

  test("outcome reasons are grouped, sorted and capped at three", () => {
    const withReason = (id: string, reason: string, status: "rejected" | "withdrawn" = "rejected") =>
      entry(id, { status, reached: ["sent", status], reasons: [{ status, reason }] });
    const stats = computeStatistics(
      [
        withReason("r1", "No budget"),
        withReason("r2", "No budget"),
        withReason("r3", "Stack mismatch"),
        withReason("r4", "Position closed"),
        withReason("r5", "Too senior"),
        withReason("w1", "Low salary", "withdrawn"),
      ],
      today,
    );
    expect(stats.reasons.rejected).toEqual([
      { reason: "No budget", count: 2 },
      { reason: "Position closed", count: 1 },
      { reason: "Stack mismatch", count: 1 },
    ]);
    expect(stats.reasons.withdrawn).toEqual([{ reason: "Low salary", count: 1 }]);
  });

  test("an outcome survives a reopen", () => {
    const reopened = entry("r1", {
      status: "interview",
      reached: ["sent", "interview", "rejected"],
    });
    const stats = computeStatistics([reopened], today);
    expect(stats.outcomes.rejected).toBe(1);
  });

  test("sources carry the same ever-reached logic", () => {
    const stats = computeStatistics(rows, today);
    expect(stats.sources).toEqual([
      { source: "LinkedIn", total: 2, screenings: 1, interviews: 1, technical: 0, offers: 0 },
      { source: "HH", total: 1, screenings: 1, interviews: 0, technical: 0, offers: 0 },
      { source: "Not specified", total: 1, screenings: 0, interviews: 0, technical: 0, offers: 0 },
    ]);
  });

  test("a source row only narrows: depth counts every step above it", () => {
    const deep = entry("d1", {
      status: "technical",
      reached: ["sent", "technical"],
      source: "Referral",
    });
    const offer = entry("d2", {
      status: "offer",
      reached: ["sent", "offer"],
      source: "Referral",
    });
    const stats = computeStatistics([deep, offer], today);
    // Both went deep enough: an offer counts as the whole way, a technical as everything below it.
    expect(stats.sources).toEqual([
      { source: "Referral", total: 2, screenings: 2, interviews: 2, technical: 2, offers: 1 },
    ]);
  });

  test("weeks are counted by the date applied, oldest bucket first", () => {
    const stats = computeStatistics(rows, today);
    expect(stats.weeks).toHaveLength(8);
    expect(stats.weeks[7]).toEqual({ weekStart: "2026-11-02", count: 1, screening: 0, interviews: 0 });
    expect(stats.weeks[6]).toEqual({ weekStart: "2026-10-26", count: 1, screening: 1, interviews: 1 });
    // The chart shows eight weeks; everything older is counted separately, never dropped silently.
    expect(stats.weeks.reduce((sum, week) => sum + week.count, 0)).toBe(2);
    expect(stats.olderThanWindow).toBe(1); // the January application from the fixture
  });

  test("applications older than the window are counted, not lost", () => {
    const old = entry("old", { appliedAt: "2025-01-01" });
    const fresh = entry("fresh", { appliedAt: "2026-11-04" });
    const stats = computeStatistics([old, fresh], today);
    expect(stats.weeks.reduce((sum, week) => sum + week.count, 0)).toBe(1);
    expect(stats.olderThanWindow).toBe(1);
  });

  test("an empty search gives zeros, not a broken chart", () => {
    const stats = computeStatistics([], today);
    expect(stats.total).toBe(0);
    expect(stats.sources).toEqual([]);
    expect(stats.weeks).toHaveLength(8);
    expect(stats.weeks.every((week) => week.count === 0)).toBe(true);
    expect(stats.funnel.every((step) => step.count === 0 && step.share === 0)).toBe(true);
  });
});
