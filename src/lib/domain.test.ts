import { describe, expect, test } from "bun:test";
import {
  APPLICATION_STATUSES,
  canChangeStatus,
  commonNextStatuses,
  isReturn,
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

  test("the statuses of one column move into each other", () => {
    // The whole of In process is one stage: any order the company happens to use.
    expect(canChangeStatus("screening", "technical")).toBe(true);
    expect(canChangeStatus("technical", "test_task")).toBe(true);
    expect(canChangeStatus("test_task", "fit")).toBe(true);
    expect(canChangeStatus("fit", "screening")).toBe(true);
    expect(canChangeStatus("offer_discussion", "offer")).toBe(true);
    expect(canChangeStatus("offer", "offer_discussion")).toBe(true);
  });

  test("the two outcomes switch into each other and nowhere else", () => {
    expect(canChangeStatus("rejected", "withdrawn")).toBe(true);
    expect(canChangeStatus("withdrawn", "rejected")).toBe(true);
    expect(canChangeStatus("rejected", "sent")).toBe(false);
    expect(canChangeStatus("rejected", "interview")).toBe(false);
  });

  test("a column switch does not open the rest of the board backwards", () => {
    // Inside In process everything is reachable, earlier columns are not.
    expect(canChangeStatus("technical", "screening")).toBe(true);
    expect(canChangeStatus("technical", "sent")).toBe(false);
    expect(canChangeStatus("interview", "wishlist")).toBe(false);
  });

  test("negotiation only follows an offer", () => {
    expect(canChangeStatus("sent", "offer_discussion")).toBe(false);
    expect(canChangeStatus("test_task", "offer_discussion")).toBe(false);
    expect(canChangeStatus("offer", "offer_discussion")).toBe(true);
  });

  test("going back a column is not a transition", () => {
    expect(canChangeStatus("screening", "sent")).toBe(false);
    expect(canChangeStatus("sent", "wishlist")).toBe(false);
  });

  test("only an offer is accepted", () => {
    expect(canChangeStatus("offer", "accepted")).toBe(true);
    expect(canChangeStatus("offer_discussion", "accepted")).toBe(true);
    expect(canChangeStatus("interview", "accepted")).toBe(false);
    expect(canChangeStatus("sent", "accepted")).toBe(false);
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
    // No going back, and neither the offer stage nor its finish line is reachable from Applied.
    expect(common).not.toContain("sent");
    expect(common).not.toContain("offer_discussion");
    expect(common).not.toContain("accepted");
  });

  test("a finished row can still switch to the other outcome", () => {
    // The closed application may move between Rejected and Withdrawn, the live one to either.
    expect(commonNextStatuses(["rejected", "sent"])).toEqual(["rejected", "withdrawn"]);
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
  test("wishlist leads to the whole board", () => {
    expect(nextStatuses("wishlist")).toEqual([
      "sent",
      "screening",
      "interview",
      "technical",
      "test_task",
      "fit",
      "offer",
      "rejected",
      "withdrawn",
    ]);
  });

  test("applied opens the interview stage and the outcomes", () => {
    expect(nextStatuses("sent")).toEqual([
      "screening",
      "interview",
      "technical",
      "test_task",
      "fit",
      "offer",
      "rejected",
      "withdrawn",
    ]);
  });

  test("a take-home step leads to the offer, not to negotiation", () => {
    expect(nextStatuses("test_task")).toEqual([
      "screening",
      "interview",
      "technical",
      "fit",
      "offer",
      "rejected",
      "withdrawn",
    ]);
  });

  test("an offer adds negotiation, acceptance and another round", () => {
    expect(nextStatuses("offer")).toEqual([
      "offer_discussion",
      // A real step back: the company asked for one more interview after the offer.
      "screening",
      "interview",
      "technical",
      "test_task",
      "fit",
      "accepted",
      "rejected",
      "withdrawn",
    ]);
  });

  test("negotiation leads to acceptance, an outcome, or back to the offer it belongs to", () => {
    expect(nextStatuses("offer_discussion")).toEqual([
      "offer",
      "screening",
      "interview",
      "technical",
      "test_task",
      "fit",
      "accepted",
      "rejected",
      "withdrawn",
    ]);
  });

  test("only an offer looks back, and the board asks first", () => {
    expect(isReturn("offer", "fit")).toBe(true);
    expect(isReturn("sent", "interview")).toBe(false);
    expect(canChangeStatus("offer", "fit")).toBe(true);
  });

  test("accepted is the end of the road", () => {
    expect(nextStatuses("accepted")).toEqual([]);
    expect(canChangeStatus("accepted", "offer")).toBe(false);
  });
});
