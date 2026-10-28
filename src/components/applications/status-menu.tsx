"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type ApplicationStatus, STATUS_LABELS, nextStatuses } from "@/lib/domain";
import { StatusBadge } from "./status-badge";

type StatusMenuProps = {
  company: string;
  status: ApplicationStatus;
  previousStatus: ApplicationStatus | null;
  onChangeStatus: (status: ApplicationStatus) => void;
  onRevertStatus: () => void;
};

/** The status badge in a table row, opening the moves allowed from it (same rules as the kanban). */
export function StatusMenu({
  company,
  status,
  previousStatus,
  onChangeStatus,
  onRevertStatus,
}: StatusMenuProps) {
  const choices = nextStatuses(status);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Статус: ${STATUS_LABELS[status]}. Сменить статус: ${company}`}
          // A double click on the row opens the application; not when it lands on the badge.
          onDoubleClick={(event) => event.stopPropagation()}
          // Fixed width, so every row's badge is the same size with room for the arrow.
          className="group flex w-46 rounded-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <StatusBadge status={status} chevron />
        </button>
      </DropdownMenuTrigger>
      {/*
        Same width for every status: the badges inside are as wide as the one in the row
        (menu padding 4px + item padding 6px on each side = 1.25rem), and the shift lines them up
        right under it. A longer label added later can still widen the menu.
      */}
      <DropdownMenuContent
        align="start"
        alignOffset={-10}
        className="w-auto min-w-[calc(var(--radix-dropdown-menu-trigger-width)+1.25rem)]"
      >
        {[status, ...choices].map((value) => (
          <DropdownMenuItem
            key={value}
            role="menuitemradio"
            aria-checked={value === status}
            onSelect={() => {
              if (value !== status) onChangeStatus(value);
            }}
          >
            <StatusBadge status={value} checked={value === status} />
          </DropdownMenuItem>
        ))}
        {previousStatus ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onRevertStatus}>
              Вернуть «{STATUS_LABELS[previousStatus]}»
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
