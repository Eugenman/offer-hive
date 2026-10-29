"use client";

import { Archive, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ApplicationStatus } from "@/lib/domain";
import type { ExportFormat } from "@/lib/export/applications-csv";
import { ExportMenu } from "./export-menu";
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
  onExport: (format: ExportFormat) => void;
  exportDisabled: boolean;
  onAdd: () => void;
  /** Table only: moves the checked rows to the archive; inactive until a row is checked. */
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
        <ExportMenu onExport={onExport} disabled={exportDisabled} />
      </div>
      <SearchInput value={search} onChange={onSearchChange} label="Search applications" />
      {onDeleteSelected ? (
        <Button
          variant="outline"
          size="icon"
          onClick={onDeleteSelected}
          disabled={selectedCount === 0}
          aria-label={selectedCount ? `Archive selected: ${selectedCount}` : "Archive selected"}
          title={selectedCount ? `Archive selected: ${selectedCount}` : "Select applications to archive"}
        >
          <Archive aria-hidden />
        </Button>
      ) : null}
      <div className="ml-auto">
        <ViewSwitcher value={view} onChange={onViewChange} />
      </div>
    </div>
  );
}
