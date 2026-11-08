"use client";

import { useEffect } from "react";
import { parseAsStringLiteral, useQueryState } from "nuqs";

export const ADD_TABS = ["manual", "import"] as const;
export type AddTab = (typeof ADD_TABS)[number];

/** The add dialog is URL state (?add=manual|import): the browser Back button closes it. */
export function useAddDialog() {
  const [tab, setTab] = useQueryState("add", parseAsStringLiteral(ADD_TABS).withOptions({ history: "push" }));

  // A tab read from the address bar on load (a reload or a bookmark) is not a deliberate open:
  // drop it once, so a reload never greets the user with the form they left earlier.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("add")) {
      setTab(null, { history: "replace" });
    }
  }, [setTab]);

  return {
    tab,
    open: (next: AddTab = "manual") => setTab(next),
    switchTo: (next: AddTab) => setTab(next, { history: "replace" }),
    close: () => setTab(null),
  };
}
