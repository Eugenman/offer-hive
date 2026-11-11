import { describe, expect, it } from "bun:test";
import { stageLabel, shortStageTitle, stageTitle } from "./stage-title";
import type { Stage } from "./domain";

const stage = (over: Partial<Stage>): Stage => ({
  id: "s1",
  applicationId: "a1",
  type: "interview",
  interviewKind: "technical",
  title: null,
  seq: 1,
  scheduledAt: null,
  state: "planned",
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-01T00:00:00.000Z",
  ...over,
});

describe("stage titles", () => {
  it("numbers a plain type once", () => {
    expect(stageTitle(stage({ type: "interview", title: null, seq: 2 }))).toBe("Interview #2");
  });

  it("does not repeat a number the user typed into the title", () => {
    expect(stageTitle(stage({ title: "Interview #1", seq: 1 }))).toBe("Interview #1");
    expect(stageTitle(stage({ title: "Техническое интервью #3", seq: 3 }))).toBe("Техническое интервью #3");
  });

  it("renumbers when the title carries another number", () => {
    expect(stageTitle(stage({ title: "Interview #2", seq: 1 }))).toBe("Interview #1");
  });

  it("keeps the label free of the number", () => {
    expect(stageLabel(stage({ title: "Interview #4" }))).toBe("Interview #4");
  });

  it("short titles use the kind", () => {
    expect(shortStageTitle(stage({ interviewKind: "technical", seq: 2 }))).toBe("Technical #2");
    expect(shortStageTitle(stage({ interviewKind: "team", seq: 1 }))).toBe("Team #1");
  });
});
