"use client";

import { ListFilter } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { APPLICATION_STATUSES, type ApplicationStatus, STATUS_LABELS } from "@/lib/domain";

type FilterMenuProps = {
  statuses: ApplicationStatus[];
  sources: string[];
  availableSources: string[];
  onStatusesChange: (statuses: ApplicationStatus[]) => void;
  onSourcesChange: (sources: string[]) => void;
  onReset: () => void;
};

function toggle<T>(list: T[], value: T) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export function FilterMenu({
  statuses,
  sources,
  availableSources,
  onStatusesChange,
  onSourcesChange,
  onReset,
}: FilterMenuProps) {
  const active = statuses.length + sources.length;
  // Keep the menu open while ticking several boxes.
  const keepOpen = (event: Event) => event.preventDefault();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" aria-label={active ? `Filter, ${active} selected` : "Filter"}>
          <ListFilter aria-hidden />
          Filter
          {active ? (
            <span className="ml-0.5 rounded-md bg-primary px-1.5 text-xs text-primary-foreground tabular-nums">
              {active}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Status</DropdownMenuLabel>
        {APPLICATION_STATUSES.map((status) => (
          <DropdownMenuCheckboxItem
            key={status}
            checked={statuses.includes(status)}
            onSelect={keepOpen}
            onCheckedChange={() => onStatusesChange(toggle(statuses, status))}
          >
            {STATUS_LABELS[status]}
          </DropdownMenuCheckboxItem>
        ))}
        {availableSources.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Source</DropdownMenuLabel>
            {availableSources.map((source) => (
              <DropdownMenuCheckboxItem
                key={source}
                checked={sources.includes(source)}
                onSelect={keepOpen}
                onCheckedChange={() => onSourcesChange(toggle(sources, source))}
              >
                {source}
              </DropdownMenuCheckboxItem>
            ))}
          </>
        ) : null}
        {active ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onReset}>Reset filter</DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
