import { describe, expect, test } from "bun:test";
import { showZone, toggleZoneCollapsed, toggleZoneHidden, type ZonePrefs } from "./zone-prefs";

const empty: ZonePrefs = { hidden: [], collapsed: [] };

describe("zone preferences", () => {
  test("hiding a zone keeps the rest untouched", () => {
    const next = toggleZoneHidden(empty, "test_task");
    expect(next.hidden).toEqual(["test_task"]);
    expect(next.collapsed).toEqual([]);
    expect(empty.hidden).toEqual([]); // no mutation
  });

  test("toggling twice brings the zone back", () => {
    const hidden = toggleZoneHidden(empty, "fit");
    expect(toggleZoneHidden(hidden, "fit").hidden).toEqual([]);
  });

  test("showing a zone again unfolds it", () => {
    const foldedAndHidden: ZonePrefs = { hidden: ["interview"], collapsed: ["interview", "fit"] };
    expect(showZone(foldedAndHidden, "interview")).toEqual({
      hidden: [],
      collapsed: ["fit"],
    });
  });

  test("folding and hiding are independent lists", () => {
    const folded = toggleZoneCollapsed(empty, "interview");
    expect(folded.collapsed).toEqual(["interview"]);
    const alsoHidden = toggleZoneHidden(folded, "interview");
    expect(alsoHidden).toEqual({ hidden: ["interview"], collapsed: ["interview"] });
  });
});
