import { describe, expect, test } from "bun:test";
import { importReport } from "./report";

describe("import report", () => {
  test("a clean run says it finished", () => {
    expect(importReport(6, 0)).toEqual({ title: "Import finished", tone: "ok" });
  });

  test("some rows saved and some failed: finished with errors", () => {
    expect(importReport(3, 2)).toEqual({ title: "Import finished with errors", tone: "warn" });
  });

  test("nothing saved and rows failed: never a green check", () => {
    expect(importReport(0, 5)).toEqual({ title: "Nothing imported", tone: "bad" });
  });
});
