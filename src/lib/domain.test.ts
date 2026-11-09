import { describe, expect, test } from "bun:test";
import {
  APPLICATION_STATUSES,
  canChangeStatus,
  commonNextStatuses,
  nextStatuses,
  OUTCOME_STATUSES,
  PIPELINE_STATUSES,
} from "./domain";

// The rules the whole interface asks about: the table, the kanban and the application page all
// call these functions, so a mistake here shows up everywhere at once.

describe("status rules", () => {
  test("an outcome has no way out", () => {
    for (const status of OUTCOME_STATUSES) expect(nextStatuses(status)).toEqual([]);
  });

  test("optional steps may be skipped", () => {
    // Applied → Offer jumps over screening, interview, technical and take-home.
    expect(canChangeStatus("sent", "offer")).toBe(true);
    expect(canChangeStatus("interview", "offer")).toBe(true);
  });

  test("each step is reachable from the one before", () => {
    for (let i = 0; i < PIPELINE_STATUSES.length - 1; i += 1) {
      expect(canChangeStatus(PIPELINE_STATUSES[i], PIPELINE_STATUSES[i + 1])).toBe(true);
    }
  });

  test("the two statuses of one stage move into each other", () => {
    // Interview and Technical share a column, Offer and Negotiation too.
    expect(canChangeStatus("technical", "interview")).toBe(true);
    expect(canChangeStatus("interview", "technical")).toBe(true);
    expect(canChangeStatus("offer_discussion", "offer")).toBe(true);
    expect(canChangeStatus("offer", "offer_discussion")).toBe(true);
  });

  test("a stage switch does not open the rest of the pipeline backwards", () => {
    // From Technical only Interview comes back, not Screening or Applied.
    expect(canChangeStatus("technical", "screening")).toBe(false);
    expect(canChangeStatus("technical", "sent")).toBe(false);
  });

  test("negotiation only follows an offer", () => {
    expect(canChangeStatus("sent", "offer_discussion")).toBe(false);
    expect(canChangeStatus("test_task", "offer_discussion")).toBe(false);
    expect(canChangeStatus("offer", "offer_discussion")).toBe(true);
  });

  test("going back is not a transition", () => {
    expect(canChangeStatus("interview", "screening")).toBe(false);
    expect(canChangeStatus("screening", "sent")).toBe(false);
  });

  test("an outcome is reachable from any step", () => {
    expect(canChangeStatus("sent", "rejected")).toBe(true);
    expect(canChangeStatus("offer", "withdrawn")).toBe(true);
  });

  test("a bulk change keeps only statuses every row may reach", () => {
    const common = commonNextStatuses(["sent", "screening"]);
    // Screening stays offerable: one row is already there, the other may move to it.
    expect(common).toContain("screening");
    expect(common).toContain("interview");
    expect(common).toContain("rejected");
    // No going back, and negotiation needs an offer first.
    expect(common).not.toContain("sent");
    expect(common).not.toContain("offer_discussion");
  });

  test("a finished row leaves only its own outcome for the whole selection", () => {
    expect(commonNextStatuses(["rejected", "sent"])).toEqual(["rejected"]);
  });

  test("an empty selection offers nothing", () => {
    expect(commonNextStatuses([])).toEqual([]);
  });

  test("no status is its own next step", () => {
    // Re-applying the same status is a no-op, not a transition.
    for (const status of APPLICATION_STATUSES) expect(nextStatuses(status)).not.toContain(status);
  });
});

describe("next statuses, step by step", () => {
  test("an application starts by offering every later step and both outcomes", () => {
    expect(nextStatuses("sent")).toEqual([
      "screening",
      "interview",
      "technical",
      "test_task",
      "offer",
      "rejected",
      "withdrawn",
    ]);
  });

  test("a take-home step leads to the offer, not to negotiation", () => {
    expect(nextStatuses("test_task")).toEqual(["offer", "rejected", "withdrawn"]);
  });

  test("an offer adds negotiation", () => {
    expect(nextStatuses("offer")).toEqual(["offer_discussion", "rejected", "withdrawn"]);
  });

  test("negotiation leads to an outcome or back to the offer it belongs to", () => {
    expect(nextStatuses("offer_discussion")).toEqual(["offer", "rejected", "withdrawn"]);
  });
});
