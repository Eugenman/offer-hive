"use client";

import { ChevronDown, Download, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { APPLICATION_STATUSES, type ApplicationStatus } from "@/lib/domain";
import { APPLICATION_WORDS, pluralRu } from "@/lib/plural";
import { StatusBadge } from "./status-badge";

type BulkActionsBarProps = {
  count: number;
  onChangeStatus: (status: ApplicationStatus) => void;
  onExport: () => void;
  onDelete: () => void;
  onClear: () => void;
};

// Floats above the content, so showing it never shifts the layout.
export function BulkActionsBar({ count, onChangeStatus, onExport, onDelete, onClear }: BulkActionsBarProps) {
  return (
    <div
      role="toolbar"
      aria-label="Действия с выбранными откликами"
      className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-xl bg-popover p-1.5 pl-4 text-sm text-popover-foreground shadow-lg ring-1 ring-border"
    >
      <span className="mr-2 whitespace-nowrap tabular-nums" aria-live="polite">
        Выбрано: {count} {pluralRu(count, APPLICATION_WORDS)}
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            Сменить статус
            <ChevronDown aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="center" className="w-44">
          {APPLICATION_STATUSES.map((status) => (
            <DropdownMenuItem key={status} onSelect={() => onChangeStatus(status)}>
              <StatusBadge status={status} />
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Button variant="ghost" size="sm" onClick={onExport}>
        <Download aria-hidden />
        Экспорт
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onDelete}
        className="text-destructive hover:text-destructive"
      >
        <Trash2 aria-hidden />
        Удалить
      </Button>
      <Button variant="ghost" size="icon-sm" onClick={onClear} aria-label="Снять выделение">
        <X aria-hidden />
      </Button>
    </div>
  );
}
