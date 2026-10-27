"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";

export const ADD_TABS = ["manual", "import"] as const;
export type AddTab = (typeof ADD_TABS)[number];

/** The add dialog is URL state (?add=manual|import): the browser Back button closes it. */
export function useAddDialog() {
  const [tab, setTab] = useQueryState("add", parseAsStringLiteral(ADD_TABS).withOptions({ history: "push" }));
  return {
    tab,
    open: (next: AddTab = "manual") => setTab(next),
    switchTo: (next: AddTab) => setTab(next, { history: "replace" }),
    close: () => setTab(null),
  };
}
