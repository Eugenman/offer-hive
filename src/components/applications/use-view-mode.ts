"use client";

import { useEffect } from "react";
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

/**
 * The view from the URL wins. Without it, the last chosen view is restored into the URL
 * (replacing the history entry), so the address always matches what is on screen.
 * Stage 5 moves "last view" from localStorage to the user profile.
 */
export function useViewMode(urlView: ViewMode | null, restore: (view: ViewMode) => void): ViewMode {
  useEffect(() => {
    if (urlView) return;
    const stored = readStored();
    if (stored && stored !== "table") restore(stored);
  }, [urlView, restore]);

  return urlView ?? "table";
}
