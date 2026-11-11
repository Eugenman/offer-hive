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
  onAdd: () => void;
  /**
   * Archive control: checked rows in the table, every shown card in the kanban.
   * Inactive when there is nothing to archive.
   */
  archive?: { count: number; label: string; onArchive: () => void };
  /** Downloads the current list; hidden while there is nothing to export. */
  onExport?: (format: ExportFormat) => void;
  exportDisabled?: boolean;
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
  onExport,
  exportDisabled,
}: ApplicationsToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b bg-background px-6 py-4 max-[480px]:gap-y-2 max-[480px]:px-4 max-[480px]:py-3">
      {/* Actions first, where the eye starts; then search and how to show the results. */}
      {/* On a phone the toolbar is two rows, not three: `contents` keeps one row on wider screens. */}
      {/* Row 1 on a max-[480px]: the actions. Row 2: search and the view controls. Both rows never wrap. */}
      <div className="contents max-[480px]:flex max-[480px]:w-full max-[480px]:flex-nowrap max-[480px]:items-center max-[480px]:justify-between max-[480px]:gap-2">
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
        <ViewSwitcher value={view} onChange={onViewChange} />
        {onExport ? (
          // Phones with room (456–480) keep Export in this row, icon-only and pushed to the right
          // edge; narrower screens put it next to the search, where it fits without a third row.
          <span className="hidden [@media(min-width:456px)_and_(max-width:480px)]:flex">
            <ExportMenu label="Export" disabled={exportDisabled} onExport={onExport} iconOnly />
          </span>
        ) : null}
      </div>
      <div className="contents max-[480px]:flex max-[480px]:w-full max-[480px]:flex-nowrap max-[480px]:items-center max-[480px]:gap-2">
        <SearchInput
          value={search}
          onChange={onSearchChange}
          label="Search applications"
          className="max-[480px]:max-w-none max-[480px]:min-w-0 max-[480px]:flex-1"
        />
        {onExport ? (
          <span className="[@media(min-width:456px)_and_(max-width:480px)]:hidden">
            <ExportMenu label="Export" disabled={exportDisabled} onExport={onExport} />
          </span>
        ) : null}
        {archive ? (
          <Button
            variant="outline"
            size="icon"
            onClick={archive.onArchive}
            disabled={archive.count === 0}
            aria-label={archive.label}
            title={archive.label}
            // The same air as between the buttons of the row above.
            className="max-[480px]:ml-2"
          >
            <Archive aria-hidden />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
