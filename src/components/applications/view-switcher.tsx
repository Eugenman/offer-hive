"use client";

import { useRef, useState } from "react";
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

/**
 * One button with the current view; the other views are in its menu. The menu opens on hover as
 * well as on click: a short delay lets the pointer travel from the button into the list.
 */
export function ViewSwitcher({ value, onChange }: { value: ViewMode; onChange: (view: ViewMode) => void }) {
  const { label, icon: Icon } = OPTIONS[value];
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keepOpen = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  const openNow = () => {
    keepOpen();
    setOpen(true);
  };
  const closeSoon = () => {
    keepOpen();
    closeTimer.current = setTimeout(() => setOpen(false), 150);
  };
  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          aria-label={`View: ${label}`}
          className="max-[480px]:min-w-0"
          onPointerEnter={(event) => {
            if (event.pointerType === "mouse") openNow();
          }}
          onPointerLeave={(event) => {
            if (event.pointerType === "mouse") closeSoon();
          }}
        >
          <Icon aria-hidden />
          <span className="max-[480px]:truncate">{label}</span>
          <ChevronDown className="text-muted-foreground" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        // Keeps the menu off the screen edge when the button sits near it, as on a phone.
        collisionPadding={8}
        className="w-44"
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse") openNow();
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === "mouse") closeSoon();
        }}
      >
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
