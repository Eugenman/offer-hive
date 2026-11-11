"use client";

import { Archive, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ApplicationStatus } from "@/lib/domain";
import type { ExportFormat } from "@/lib/export/applications-csv";
import { ExportMenu } from "./export-menu";
import { cn } from "@/lib/utils";
import { useIsPhone } from "@/lib/use-is-phone";
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
  const isPhone = useIsPhone();
  return (
    <div className="flex flex-wrap items-center gap-2 border-b bg-background px-6 py-4 max-[480px]:sticky max-[480px]:top-16 max-[480px]:z-20 max-[480px]:gap-x-1.5 max-[480px]:gap-y-2 max-[480px]:px-2 max-[480px]:py-3 max-[360px]:gap-x-1 max-[360px]:px-1.5">
      {/* Actions first, where the eye starts; then search and how to show the results. */}
      {/* On a phone the toolbar is two rows, not three: `contents` keeps one row on wider screens. */}
      {/* Row 1 on a max-[480px]: the actions. Row 2: search and the view controls. Both rows never wrap. */}
      <div className="contents max-[480px]:grid max-[480px]:w-full max-[480px]:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)] max-[480px]:items-center max-[480px]:gap-2">
        <Button onClick={onAdd} className="max-[480px]:w-full max-[480px]:justify-center">
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
      </div>
      {/* Row 2 uses the same grid as row 1, so Filter, the view switcher and Export are always
          the same width, in every view. The search takes the rest. */}
      <div className="contents max-[480px]:grid max-[480px]:w-full max-[480px]:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)] max-[480px]:items-center max-[480px]:gap-2">
        <SearchInput
          value={search}
          onChange={onSearchChange}
          label="Search applications"
          className={cn(
            "max-[480px]:w-full max-[480px]:max-w-none max-[480px]:min-w-0",
            // Without the archive button the search takes its cell too.
            (!archive || isPhone) && "max-[480px]:col-span-2",
          )}
        />
        {archive && !isPhone ? (
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
        {onExport ? (
          <span className="max-[480px]:flex max-[480px]:min-w-0">
            <ExportMenu
              label="Export"
              disabled={exportDisabled}
              onExport={onExport}
              className="max-[480px]:w-full max-[480px]:min-w-0 max-[480px]:justify-center"
            />
          </span>
        ) : null}
      </div>
    </div>
  );
}
