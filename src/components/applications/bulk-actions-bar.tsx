"use client";

import { ChevronDown, Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ApplicationStatus } from "@/lib/domain";
import { countApplications } from "@/lib/plural";
import { StatusBadge } from "./status-badge";

type BulkActionsBarProps = {
  count: number;
  /** Statuses every selected application may move to. */
  statuses: ApplicationStatus[];
  onChangeStatus: (status: ApplicationStatus) => void;
  onExport: () => void;
  onClear: () => void;
};

// Floats above the content, so showing it never shifts the layout.
export function BulkActionsBar({ count, statuses, onChangeStatus, onExport, onClear }: BulkActionsBarProps) {
  return (
    <div
      role="toolbar"
      aria-label="Actions for selected applications"
      className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-xl bg-popover p-1.5 pl-4 text-sm text-popover-foreground shadow-lg ring-1 ring-border"
    >
      <span className="mr-2 whitespace-nowrap tabular-nums" aria-live="polite">
        {countApplications(count)} selected
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" disabled={statuses.length === 0}>
            Change status
            <ChevronDown aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="center" className="w-48">
          {statuses.map((status) => (
            <DropdownMenuItem key={status} onSelect={() => onChangeStatus(status)}>
              <StatusBadge status={status} />
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Button variant="ghost" size="sm" onClick={onExport}>
        <Download aria-hidden />
        Export
      </Button>
      <Button variant="ghost" size="icon-sm" onClick={onClear} aria-label="Clear selection">
        <X aria-hidden />
      </Button>
    </div>
  );
}
