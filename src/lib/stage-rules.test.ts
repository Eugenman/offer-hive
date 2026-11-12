import { describe, expect, it } from "bun:test";
import { isFinishedState, isStageStateConsistent, repairedStageState } from "./stage-rules";

const now = new Date("2026-11-11T20:00:00");

describe("stage state rules", () => {
  it("a plan is always allowed, whenever it is dated", () => {
    expect(isStageStateConsistent("planned", "2026-11-24T14:00:00.000Z", now)).toBe(true);
    expect(isStageStateConsistent("planned", "2026-10-01T14:00:00.000Z", now)).toBe(true);
    expect(isStageStateConsistent("planned", null, now)).toBe(true);
  });

  it("a finished state needs a day that has come", () => {
    expect(isStageStateConsistent("done", "2026-11-24T14:00:00.000Z", now)).toBe(false);
    expect(isStageStateConsistent("failed", "2026-11-24T14:00:00.000Z", now)).toBe(false);
    expect(isStageStateConsistent("done", "2026-11-10T14:00:00.000Z", now)).toBe(true);
    // The exact moment decides: later today has not happened yet.
    expect(isStageStateConsistent("done", "2026-11-11T23:30:00.000Z", now)).toBe(false);
    expect(isStageStateConsistent("done", "2026-11-11T18:00:00.000Z", now)).toBe(true);
    expect(isStageStateConsistent("done", null, now)).toBe(true);
  });

  it("only done and failed claim an outcome", () => {
    expect(isFinishedState("done")).toBe(true);
    expect(isFinishedState("failed")).toBe(true);
    expect(isFinishedState("planned")).toBe(false);
    expect(isFinishedState("cancelled")).toBe(false);
  });

  it("repairs a future outcome into a plan and leaves the rest alone", () => {
    expect(repairedStageState({ state: "done", scheduledAt: "2026-11-24T14:00:00.000Z" }, now)).toBe(
      "planned",
    );
    expect(repairedStageState({ state: "failed", scheduledAt: "2026-12-01T14:00:00.000Z" }, now)).toBe(
      "planned",
    );
    expect(repairedStageState({ state: "done", scheduledAt: "2026-11-01T14:00:00.000Z" }, now)).toBeNull();
    expect(repairedStageState({ state: "planned", scheduledAt: "2026-11-24T14:00:00.000Z" }, now)).toBeNull();
  });
});
