"use client";

import { useState } from "react";
import { Download, Plus, Search, X } from "lucide-react";
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
      <ViewSwitcher value={view} onChange={onViewChange} />
      <div className="relative w-full max-w-64">
        <Search
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value={value}
          onChange={(event) => change(event.target.value)}
          placeholder="Компания или должность"
          aria-label="Поиск по откликам"
          className="pr-8 pl-8 [&::-webkit-search-cancel-button]:hidden"
        />
        {value ? (
          <button
            type="button"
            onClick={() => change("")}
            aria-label="Очистить поиск"
            className="absolute top-1/2 right-1.5 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        ) : null}
      </div>
      <div className="ml-auto flex items-center gap-2">
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
          Экспорт
        </Button>
        <Button onClick={onAdd}>
          <Plus aria-hidden />
          Добавить отклик
        </Button>
      </div>
    </div>
  );
}
