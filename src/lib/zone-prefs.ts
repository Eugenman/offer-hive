"use client";

import { useSyncExternalStore } from "react";

/**
 * Which zones of the board are hidden or folded. It is a view preference, so it lives in the
 * browser, not in the data: two people sharing an account still see their own board.
 */
export type ZonePrefs = { hidden: string[]; collapsed: string[] };

const STORAGE_KEY = "offerhive:zones";
const EMPTY: ZonePrefs = { hidden: [], collapsed: [] };

let cached: ZonePrefs | null = null;
const listeners = new Set<() => void>();

function parse(raw: string | null): ZonePrefs {
  if (!raw) return EMPTY;
  try {
    const value = JSON.parse(raw) as Partial<ZonePrefs>;
    return {
      hidden: Array.isArray(value.hidden) ? value.hidden.filter((item) => typeof item === "string") : [],
      collapsed: Array.isArray(value.collapsed)
        ? value.collapsed.filter((item) => typeof item === "string")
        : [],
    };
  } catch {
    return EMPTY;
  }
}

/** The snapshot is cached, so React sees the same object until something really changes. */
export function readZonePrefs(): ZonePrefs {
  if (cached !== null) return cached;
  try {
    cached = parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    cached = EMPTY; // storage can be blocked (private mode, strict settings)
  }
  return cached;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setZonePrefs(next: ZonePrefs) {
  cached = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Not critical: the board still works, the choice just is not remembered.
  }
  for (const listener of listeners) listener();
}

const toggle = (list: string[], value: string) =>
  list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

export const toggleZoneHidden = (prefs: ZonePrefs, zone: string): ZonePrefs => ({
  ...prefs,
  hidden: toggle(prefs.hidden, zone),
});

/**
 * Turning a zone back on unfolds it: the point of showing a zone is seeing its cards, so a zone
 * that comes back should not stay a closed row.
 */
export const showZone = (prefs: ZonePrefs, zone: string): ZonePrefs => ({
  hidden: prefs.hidden.filter((item) => item !== zone),
  collapsed: prefs.collapsed.filter((item) => item !== zone),
});

export const toggleZoneCollapsed = (prefs: ZonePrefs, zone: string): ZonePrefs => ({
  ...prefs,
  collapsed: toggle(prefs.collapsed, zone),
});

/** Reading the stored choice during render; the server renders the plain board. */
export function useZonePrefs(): ZonePrefs {
  return useSyncExternalStore(subscribe, readZonePrefs, () => EMPTY);
}
