import { describe, expect, test } from "bun:test";
import { isFutureDay } from "./format";

// An event's state is locked until its day comes: the date decides, the time of day does not.

const now = new Date("2026-11-19T12:00:00");

describe("a day that has not come yet", () => {
  test("tomorrow is in the future", () => {
    expect(isFutureDay("2026-11-20T09:00:00.000Z", now)).toBe(true);
  });

  test("later today is not: the time is ignored", () => {
    expect(isFutureDay("2026-11-19T23:30:00.000Z", now)).toBe(false);
  });

  test("yesterday is history", () => {
    expect(isFutureDay("2026-11-18T09:00:00.000Z", now)).toBe(false);
  });

  test("an event without a date is never locked", () => {
    expect(isFutureDay(null, now)).toBe(false);
  });
});
