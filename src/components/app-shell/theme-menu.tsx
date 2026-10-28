"use client";

import { SunMoon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { THEME_OPTIONS, useTheme } from "@/hooks/use-theme";
import type { Theme } from "@/lib/ui-prefs";

export function ThemeMenu() {
  const [theme, setTheme] = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex h-9 items-center gap-3 rounded-lg px-2.5 text-sm text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none data-[state=open]:bg-background data-[state=open]:text-foreground">
        <SunMoon className="size-4.5 shrink-0" aria-hidden />
        <span className="truncate sidebar-collapsed:sr-only">Тема</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="end" sideOffset={8} className="w-44">
        <DropdownMenuLabel>Тема оформления</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={(value) => setTheme(value as Theme)}>
          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
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
