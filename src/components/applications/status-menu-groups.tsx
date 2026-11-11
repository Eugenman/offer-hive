"use client";

import { DropdownMenuGroup, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { BOARD_COLUMNS, type ApplicationStatus } from "@/lib/domain";
import { zoneBarClass } from "@/lib/column-colors";
import { StatusBadge } from "./status-badge";

export type StatusGroup = { key: string; title: string; zones: ApplicationStatus[] };

/**
 * Statuses grouped by the board column they live in, in board order. The menu then reads like the
 * board itself: In process with its five sub-statuses, Offer with two, Closed with two.
 */
export function groupStatuses(statuses: readonly ApplicationStatus[]): StatusGroup[] {
  return BOARD_COLUMNS.map((column) => ({
    key: column.key,
    title: column.title,
    zones: column.zones.filter((zone) => statuses.includes(zone)),
  })).filter((group) => group.zones.length > 0);
}

type StatusMenuGroupsProps = {
  statuses: readonly ApplicationStatus[];
  onSelect: (status: ApplicationStatus) => void;
  /** When set, this status is marked as the current one (a radio menu). */
  current?: ApplicationStatus | null;
};

/**
 * The list of statuses inside a menu: each column gets a frame of its own, so a menu of ten items
 * still says which stage every status belongs to.
 */
export function StatusMenuGroups({ statuses, onSelect, current = null }: StatusMenuGroupsProps) {
  return groupStatuses(statuses).map((group) => (
    <DropdownMenuGroup
      key={group.key}
      className="rounded-lg border border-border/70 bg-muted/30 p-1 not-last:mb-1"
    >
      <div className="flex items-center gap-1.5 px-1.5 pt-0.5 pb-1 text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase">
        <span className={cn("h-2.5 w-[3px] rounded-full", zoneBarClass(group.zones[0]))} aria-hidden />
        {group.title}
      </div>
      {group.zones.map((status) => (
        <DropdownMenuItem
          key={status}
          {...(current === null
            ? {}
            : { role: "menuitemradio" as const, "aria-checked": status === current })}
          onSelect={() => {
            if (status !== current) onSelect(status);
          }}
        >
          <StatusBadge status={status} {...(current === null ? {} : { checked: status === current })} />
        </DropdownMenuItem>
      ))}
    </DropdownMenuGroup>
  ));
}
