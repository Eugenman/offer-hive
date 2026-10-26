"use client";

import { useState } from "react";
import { Monitor, Moon, Sun, SunMoon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { THEME_COOKIE, type Theme, readCookie, resolveTheme, writeCookie } from "@/lib/ui-prefs";

const OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Светлая", icon: Sun },
  { value: "dark", label: "Тёмная", icon: Moon },
  { value: "system", label: "Как в системе", icon: Monitor },
];

function readTheme(): Theme {
  if (typeof document === "undefined") return "system";
  const value = readCookie(THEME_COOKIE);
  return value === "light" || value === "dark" ? value : "system";
}

export function ThemeMenu() {
  const [theme, setTheme] = useState<Theme>(readTheme);

  function apply(value: string) {
    const next = value as Theme;
    document.documentElement.dataset.theme = resolveTheme(next);
    writeCookie(THEME_COOKIE, next);
    setTheme(next);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex h-9 items-center gap-3 rounded-lg px-2.5 text-sm text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none data-[state=open]:bg-background data-[state=open]:text-foreground">
        <SunMoon className="size-4.5 shrink-0" aria-hidden />
        <span className="truncate sidebar-collapsed:sr-only">Тема</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="end" sideOffset={8} className="w-44">
        <DropdownMenuLabel>Тема оформления</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={apply}>
          {OPTIONS.map(({ value, label, icon: Icon }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <Icon aria-hidden />
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
