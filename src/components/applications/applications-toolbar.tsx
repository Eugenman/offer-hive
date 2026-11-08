"use client";

import { Archive, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ApplicationStatus } from "@/lib/domain";
import { FilterMenu } from "./filter-menu";
import { SearchInput } from "./search-input";
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
  onAdd: () => void;
  /**
   * Archive control: checked rows in the table, every shown card in the kanban.
   * Inactive when there is nothing to archive.
   */
  archive?: { count: number; label: string; onArchive: () => void };
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
  onAdd,
  archive,
}: ApplicationsToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-6 py-4">
      {/* Actions first, where the eye starts; then search and how to show the results. */}
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
      </div>
      <SearchInput value={search} onChange={onSearchChange} label="Search applications" />
      <ViewSwitcher value={view} onChange={onViewChange} />
      {archive ? (
        <Button
          variant="outline"
          size="icon"
          onClick={archive.onArchive}
          disabled={archive.count === 0}
          aria-label={archive.label}
          title={archive.label}
        >
          <Archive aria-hidden />
        </Button>
      ) : null}
    </div>
  );
}
