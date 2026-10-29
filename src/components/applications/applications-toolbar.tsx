"use client";

import { useState } from "react";
import { Download, Plus, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ApplicationStatus } from "@/lib/domain";
import { FilterMenu } from "./filter-menu";
import type { ViewMode } from "./use-applications-url-state";
import { ViewSwitcher } from "./view-switcher";

type ApplicationsToolbarProps = {
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
  search: string;
  statuses: ApplicationStatus[];
  sources: string[];
  availableSources: string[];
  onSearchChange: (value: string) => void;
  onStatusesChange: (statuses: ApplicationStatus[]) => void;
  onSourcesChange: (sources: string[]) => void;
  onResetFilters: () => void;
  onExport: () => void;
  exportDisabled: boolean;
  onAdd: () => void;
  /** Table only: deletes the checked rows; the button stays inactive until a row is checked. */
  selectedCount?: number;
  onDeleteSelected?: () => void;
};

export function ApplicationsToolbar({
  view,
  onViewChange,
  search,
  statuses,
  sources,
  availableSources,
  onSearchChange,
  onStatusesChange,
  onSourcesChange,
  onResetFilters,
  onExport,
  exportDisabled,
  onAdd,
  selectedCount = 0,
  onDeleteSelected,
}: ApplicationsToolbarProps) {
  // Local value keeps typing instant; the URL is updated with a short debounce.
  const [value, setValue] = useState(search);
  const [synced, setSynced] = useState(search);
  if (search !== synced) {
    setSynced(search);
    setValue(search);
  }

  function change(next: string) {
    setValue(next);
    setSynced(next);
    onSearchChange(next);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 px-6 py-4">
      {/* Actions on the left, where the eye starts; the view switcher on the right. */}
      <div className="flex items-center gap-2">
        <Button onClick={onAdd}>
          <Plus aria-hidden />
          Add application
        </Button>
        <FilterMenu
          statuses={statuses}
          sources={sources}
          availableSources={availableSources}
          onStatusesChange={onStatusesChange}
          onSourcesChange={onSourcesChange}
          onReset={onResetFilters}
        />
        <Button variant="outline" onClick={onExport} disabled={exportDisabled}>
          <Download aria-hidden />
          Export
        </Button>
      </div>
      <div className="relative w-full max-w-64">
        <Search
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value={value}
          onChange={(event) => change(event.target.value)}
          placeholder="Company or position"
          aria-label="Search applications"
          className="pr-8 pl-8 [&::-webkit-search-cancel-button]:hidden"
        />
        {value ? (
          <button
            type="button"
            onClick={() => change("")}
            aria-label="Clear search"
            className="absolute top-1/2 right-1.5 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        ) : null}
      </div>
      {onDeleteSelected ? (
        <Button
          variant="outline"
          size="icon"
          onClick={onDeleteSelected}
          disabled={selectedCount === 0}
          aria-label={selectedCount ? `Delete selected: ${selectedCount}` : "Delete selected"}
          title={selectedCount ? `Delete selected: ${selectedCount}` : "Select applications to delete"}
          className="text-destructive hover:text-destructive disabled:text-muted-foreground"
        >
          <Trash2 aria-hidden />
        </Button>
      ) : null}
      <div className="ml-auto">
        <ViewSwitcher value={view} onChange={onViewChange} />
      </div>
    </div>
  );
}
