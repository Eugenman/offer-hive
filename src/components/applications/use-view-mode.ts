"use client";

import { useEffect, useSyncExternalStore } from "react";
import { VIEWS, type ViewMode } from "./use-applications-url-state";

const STORAGE_KEY = "offerhive:view";

function readStored(): ViewMode | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return VIEWS.includes(value as ViewMode) ? (value as ViewMode) : null;
  } catch {
    return null; // storage can be blocked (private mode, strict settings)
  }
}

export function rememberView(view: ViewMode) {
  try {
    localStorage.setItem(STORAGE_KEY, view);
  } catch {
    // Not critical: the view still lives in the URL.
  }
}

const noSubscription = () => () => {};

/**
 * The view from the URL wins. Without it, the last chosen view is shown right away (no frame of
 * the table first) and restored into the URL (replacing the history entry), so the address
 * always matches what is on screen.
 */
export function useViewMode(urlView: ViewMode | null, restore: (view: ViewMode) => void): ViewMode {
  // Server rendering and hydration see no stored view; after that it is read on every render.
  const stored = useSyncExternalStore(noSubscription, readStored, () => null);

  // After a full page load the first render can't read storage (it must match the server), so the
  // saved view is read here too.
  useEffect(() => {
    if (urlView) return;
    const saved = readStored();
    if (saved && saved !== "table") restore(saved);
  }, [urlView, restore]);

  return urlView ?? stored ?? "table";
}
