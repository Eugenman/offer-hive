import { describe, expect, test } from "bun:test";
import { resolveDrop, statusFromDrop } from "./board-drop";
import type { ApplicationStatus } from "./domain";

const app = (status: ApplicationStatus, previousStatus: ApplicationStatus | null = null) => ({
  status,
  previousStatus,
});

describe("statusFromDrop", () => {
  test("a status id is a status", () => {
    expect(statusFromDrop("interview")).toBe("interview");
    expect(statusFromDrop("accepted")).toBe("accepted");
  });

  test("a card id, a column title or an empty drop is not", () => {
    // On a phone the finger lands on a card or a header and dnd-kit reports that id; writing it down
    // used to fail with an error toast.
    expect(statusFromDrop("7c9f6c1e-6a1c-4c1f-9d0e-7b2a1f3d4e5f")).toBeNull();
    expect(statusFromDrop("Company and position")).toBeNull();
    expect(statusFromDrop(undefined)).toBeNull();
    expect(statusFromDrop(null)).toBeNull();
  });
});

describe("resolveDrop", () => {
  test("a drop on its own status does nothing", () => {
    expect(resolveDrop(app("sent"), "sent")).toEqual({ kind: "none" });
  });

  test("a step forward is a move", () => {
    expect(resolveDrop(app("sent"), "interview")).toEqual({ kind: "move", status: "interview" });
  });

  test("a drop on a foreign id does nothing instead of failing", () => {
    expect(resolveDrop(app("sent"), "some-card-id")).toEqual({ kind: "none" });
  });

  test("the previous status undoes the last change", () => {
    expect(resolveDrop(app("interview", "sent"), "sent")).toEqual({ kind: "revert", status: "sent" });
  });

  test("a step back asks first", () => {
    // Offer back to Screening is another round, not an undo.
    expect(resolveDrop(app("offer"), "screening")).toEqual({ kind: "return", status: "screening" });
  });
});
