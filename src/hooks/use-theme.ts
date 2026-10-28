"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { THEME_COOKIE, type Theme, readCookie, resolveTheme, writeCookie } from "@/lib/ui-prefs";

export const THEME_OPTIONS: { value: Theme; label: string; icon: LucideIcon }[] = [
  { value: "light", label: "Светлая", icon: Sun },
  { value: "dark", label: "Тёмная", icon: Moon },
  { value: "system", label: "Как в системе", icon: Monitor },
];

const listeners = new Set<() => void>();

function readTheme(): Theme {
  const value = readCookie(THEME_COOKIE);
  return value === "light" || value === "dark" ? value : "system";
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The chosen theme (light / dark / system), shared by every control that shows it. */
export function useTheme(): [Theme, (theme: Theme) => void] {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "system" as Theme);

  function setTheme(next: Theme) {
    document.documentElement.dataset.theme = resolveTheme(next);
    writeCookie(THEME_COOKIE, next);
    listeners.forEach((listener) => listener());
  }

  return [theme, setTheme];
}
