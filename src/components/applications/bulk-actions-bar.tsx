"use client";

import { ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { ApplicationStatus } from "@/lib/domain";
import { countApplications } from "@/lib/plural";
import type { ExportFormat } from "@/lib/export/applications-csv";
import { ExportMenu } from "./export-menu";
import { StatusMenuGroups } from "./status-menu-groups";

type BulkActionsBarProps = {
  count: number;
  /** Statuses every selected application may move to. */
  statuses: ApplicationStatus[];
  onChangeStatus: (status: ApplicationStatus) => void;
  onExport: (format: ExportFormat) => void;
  onClear: () => void;
};

// Floats above the content, so showing it never shifts the layout.
export function BulkActionsBar({ count, statuses, onChangeStatus, onExport, onClear }: BulkActionsBarProps) {
  return (
    <div
      role="toolbar"
      aria-label="Actions for selected applications"
      className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-xl bg-popover p-1.5 pl-4 text-sm text-popover-foreground shadow-lg ring-1 ring-border max-[480px]:inset-x-2 max-[480px]:bottom-3 max-[480px]:left-2 max-[480px]:translate-x-0 max-[480px]:justify-between max-[480px]:gap-0 max-[480px]:pl-3"
    >
      <span
        className="mr-2 whitespace-nowrap tabular-nums max-[480px]:mr-0 max-[480px]:text-xs"
        aria-live="polite"
      >
        {countApplications(count)} selected
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" disabled={statuses.length === 0}>
            <span className="max-[480px]:hidden">Change status</span>
            <span className="hidden max-[480px]:inline">Status</span>
            <ChevronDown aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="center" className="w-52">
          <StatusMenuGroups statuses={statuses} onSelect={onChangeStatus} />
        </DropdownMenuContent>
      </DropdownMenu>
      <ExportMenu onExport={onExport} variant="ghost" size="sm" side="top" />
      <Button variant="ghost" size="icon-sm" onClick={onClear} aria-label="Clear selection">
        <X aria-hidden />
      </Button>
    </div>
  );
}
