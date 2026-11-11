import { describe, expect, test } from "bun:test";
import { paginate } from "./pagination";

const rows = Array.from({ length: 32 }, (_, index) => index + 1);

describe("paginate", () => {
  test("cuts the first page and reports the last one", () => {
    const page = paginate(rows, 1, 25);
    expect(page.items).toHaveLength(25);
    expect(page.items[0]).toBe(1);
    expect(page.total).toBe(32);
    expect(page.last).toBe(2);
  });

  test("the last page holds the remainder", () => {
    const page = paginate(rows, 2, 25);
    expect(page.items).toHaveLength(7);
    expect(page.items.at(-1)).toBe(32);
  });

  test("a page past the end falls back to the last real page", () => {
    // Rows disappear while the page number stays: an empty page would look like an empty archive.
    expect(paginate(rows, 9, 25).page).toBe(2);
    expect(paginate(rows, 9, 25).items).toHaveLength(7);
    expect(paginate([], 5, 25)).toMatchObject({ page: 1, last: 1, total: 0, items: [] });
  });

  test("a page below the first one is the first one", () => {
    expect(paginate(rows, 0, 25).page).toBe(1);
    expect(paginate(rows, -3, 25).page).toBe(1);
  });

  test("an empty list is one empty page", () => {
    const page = paginate([], 1, 25);
    expect(page.items).toEqual([]);
    expect(page.last).toBe(1);
  });
});
