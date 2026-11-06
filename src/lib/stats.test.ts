import { describe, expect, test } from "bun:test";
import type { ApplicationStatus, StatisticsEntry } from "./domain";
import { computeStatistics, weekStart } from "./stats";

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

const funnelCount = (stats: ReturnType<typeof computeStatistics>, key: ApplicationStatus) =>
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

  test("the funnel counts what was ever reached, not the current status", () => {
    const stats = computeStatistics(rows, today);
    expect(funnelCount(stats, "sent")).toBe(4);
    expect(funnelCount(stats, "screening")).toBe(2);
    // Rejected after an interview still counts as reaching it.
    expect(funnelCount(stats, "interview")).toBe(1);
    expect(funnelCount(stats, "technical")).toBe(0);
    expect(funnelCount(stats, "offer")).toBe(0);
  });

  test("every application counts as sent, even one that starts later", () => {
    const stats = computeStatistics([entry("x", { status: "offer", reached: ["offer"] })], today);
    expect(funnelCount(stats, "sent")).toBe(1);
    expect(funnelCount(stats, "offer")).toBe(1);
  });

  test("shares are fractions of the total, and zero stays zero", () => {
    const stats = computeStatistics(rows, today);
    expect(stats.funnel[0].share).toBe(1);
    expect(stats.funnel.find((step) => step.key === "screening")?.share).toBe(0.5);
    expect(computeStatistics([], today).funnel[0].share).toBe(0);
  });

  test("only active rows in a live step count as in progress", () => {
    const stats = computeStatistics(rows, today);
    expect(stats.total).toBe(4);
    expect(stats.archived).toBe(1);
    expect(stats.deleted).toBe(1);
    expect(stats.inProgress).toBe(1);
  });

  test("outcomes count the current status", () => {
    const stats = computeStatistics(rows, today);
    expect(stats.outcomes).toEqual({ rejected: 2, withdrawn: 0 });
  });

  test("sources carry the same ever-reached logic", () => {
    const stats = computeStatistics(rows, today);
    expect(stats.sources).toEqual([
      { source: "LinkedIn", total: 2, screenings: 1, interviews: 1, offers: 0 },
      { source: "HH", total: 1, screenings: 1, interviews: 0, offers: 0 },
      { source: "Not specified", total: 1, screenings: 0, interviews: 0, offers: 0 },
    ]);
  });

  test("weeks are counted by the date applied, oldest bucket first", () => {
    const stats = computeStatistics(rows, today);
    expect(stats.weeks).toHaveLength(8);
    expect(stats.weeks[7]).toEqual({ weekStart: "2026-11-02", count: 1 });
    expect(stats.weeks[6]).toEqual({ weekStart: "2026-10-26", count: 1 });
    // A null date and a date outside the window add nothing.
    expect(stats.weeks.reduce((sum, week) => sum + week.count, 0)).toBe(2);
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
