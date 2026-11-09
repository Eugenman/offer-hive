import { describe, expect, test } from "bun:test";
import { nextEvent } from "./next-event";
import type { SummaryStage } from "./domain";

const now = new Date("2026-11-09T12:00:00");

function stage(over: Partial<SummaryStage>): SummaryStage {
  return {
    type: "interview",
    interviewKind: null,
    title: null,
    seq: 1,
    scheduledAt: null,
    state: "planned",
    ...over,
  };
}

describe("the next event", () => {
  test("is the nearest planned one in the future", () => {
    const events = [
      stage({ seq: 3, scheduledAt: "2026-11-25T10:00:00.000Z" }),
      stage({ seq: 2, scheduledAt: "2026-11-19T10:00:00.000Z" }),
    ];
    expect(nextEvent(events, now)?.seq).toBe(2);
  });

  test("skips done, failed, cancelled and past events", () => {
    const events = [
      stage({ seq: 1, scheduledAt: "2026-11-01T10:00:00.000Z", state: "done" }),
      stage({ seq: 2, scheduledAt: "2026-11-20T10:00:00.000Z", state: "cancelled" }),
      stage({ seq: 3, scheduledAt: "2026-11-19T10:00:00.000Z", state: "failed" }),
      stage({ seq: 4, scheduledAt: "2026-11-05T10:00:00.000Z" }),
      stage({ seq: 5, scheduledAt: "2026-11-21T10:00:00.000Z" }),
    ];
    expect(nextEvent(events, now)?.seq).toBe(5);
  });

  test("a finished nearest event moves the frame to the next planned one", () => {
    const events = [
      stage({ seq: 1, scheduledAt: "2026-11-19T10:00:00.000Z", state: "done" }),
      stage({ seq: 2, scheduledAt: "2026-11-24T10:00:00.000Z" }),
    ];
    expect(nextEvent(events, now)?.seq).toBe(2);
  });

  test("counts today, even earlier in the day", () => {
    const events = [stage({ seq: 1, scheduledAt: "2026-11-09T08:00:00.000Z" })];
    expect(nextEvent(events, now)?.seq).toBe(1);
  });

  test("is nothing when every event is history", () => {
    const events = [
      stage({ seq: 1, scheduledAt: "2026-11-01T10:00:00.000Z", state: "done" }),
      stage({ seq: 2, scheduledAt: null }),
    ];
    expect(nextEvent(events, now)).toBeNull();
  });
});
