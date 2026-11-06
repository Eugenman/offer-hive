"use client";

import { ChartGantt, ChevronDown, Columns3, Table2, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { VIEWS, type ViewMode } from "./use-applications-url-state";

const OPTIONS: Record<ViewMode, { label: string; icon: LucideIcon }> = {
  table: { label: "Table", icon: Table2 },
  kanban: { label: "Kanban", icon: Columns3 },
  timeline: { label: "Timeline", icon: ChartGantt },
};

/** One button with the current view; the other views are in its menu. */
export function ViewSwitcher({ value, onChange }: { value: ViewMode; onChange: (view: ViewMode) => void }) {
  const { label, icon: Icon } = OPTIONS[value];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" aria-label={`View: ${label}`}>
          <Icon aria-hidden />
          {label}
          <ChevronDown className="text-muted-foreground" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        <DropdownMenuRadioGroup value={value} onValueChange={(next) => onChange(next as ViewMode)}>
          {VIEWS.map((view) => {
            const { label: optionLabel, icon: OptionIcon } = OPTIONS[view];
            return (
              <DropdownMenuRadioItem key={view} value={view}>
                <OptionIcon aria-hidden />
                {optionLabel}
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
