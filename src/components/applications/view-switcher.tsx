"use client";

import { ChartGantt, Columns3, Table2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ViewMode } from "./use-applications-url-state";

const OPTIONS: { value: ViewMode; label: string; icon: LucideIcon }[] = [
  { value: "table", label: "Table", icon: Table2 },
  { value: "kanban", label: "Kanban", icon: Columns3 },
  { value: "timeline", label: "Timeline", icon: ChartGantt },
];

export function ViewSwitcher({ value, onChange }: { value: ViewMode; onChange: (view: ViewMode) => void }) {
  return (
    <div role="radiogroup" aria-label="View" className="inline-flex rounded-lg bg-muted p-0.5">
      {OPTIONS.map(({ value: option, label, icon: Icon }) => {
        const active = option === value;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option)}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              active && "bg-background text-foreground shadow-xs ring-1 ring-border",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
}
