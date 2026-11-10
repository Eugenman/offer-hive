import { describe, expect, test } from "bun:test";
import type { SummaryStage } from "./domain";
import { WAITING_DAYS, waitingDays } from "./waiting";

const now = new Date("2026-11-10T12:00:00");
const today = "2026-11-10";

const event = (over: Partial<SummaryStage>): SummaryStage =>
  ({
    id: "e1",
    type: "interview",
    interviewKind: null,
    seq: 1,
    scheduledAt: null,
    state: "planned",
    title: null,
    ...over,
  }) as SummaryStage;

const app = (over: Partial<Parameters<typeof waitingDays>[0]> = {}) => ({
  status: "interview" as const,
  statusChangedAt: "2026-10-01T10:00:00Z",
  createdAt: "2026-09-20T10:00:00Z",
  events: [] as SummaryStage[],
  ...over,
});

describe("waitingDays", () => {
  test("a long silence counts the days since the last thing that happened", () => {
    expect(waitingDays(app(), now)).toBe(40);
  });

  test("a planned event ahead keeps the card quiet", () => {
    expect(waitingDays(app({ events: [event({ scheduledAt: "2026-11-20" })] }), now)).toBeNull();
  });

  test("a finished event does not count as a plan for the future", () => {
    const done = event({ scheduledAt: "2026-10-05", state: "done" });
    expect(waitingDays(app({ events: [done] }), now)).toBe(36);
  });

  test("a short silence stays quiet", () => {
    expect(waitingDays(app({ statusChangedAt: today }), now)).toBeNull();
    expect(waitingDays(app({ statusChangedAt: "2026-11-08T10:00:00Z" }), now)).toBeNull();
  });

  test("exactly a week of silence is a nudge", () => {
    const week = new Date(now.getTime() - WAITING_DAYS * 86_400_000);
    expect(waitingDays(app({ statusChangedAt: week.toISOString() }), now)).toBe(WAITING_DAYS);
  });

  test("finished processes never wait", () => {
    for (const status of ["accepted", "rejected", "withdrawn"] as const) {
      expect(waitingDays(app({ status }), now)).toBeNull();
    }
  });

  test("a wish is not a process yet", () => {
    expect(waitingDays(app({ status: "wishlist" }), now)).toBeNull();
  });
});
