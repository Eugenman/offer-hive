"use client";

import { useRef, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useAxisLockScroll } from "@/lib/use-axis-lock";
import { useIsPhone } from "@/lib/use-is-phone";

/** One table header that sorts a list; the field is whatever the page sorts by. */
export type TableSort<Field extends string> = { field: Field; direction: "asc" | "desc" } | null;

/** Click a sorted column again to turn it around; a new column starts ascending. */
export function nextSort<Field extends string>(current: TableSort<Field>, field: Field): TableSort<Field> {
  if (current?.field !== field) return { field, direction: "asc" };
  return { field, direction: current.direction === "asc" ? "desc" : "asc" };
}

/** A header cell that is also a sort button, pinned to the top while the body scrolls. */
export function SortableHead<Field extends string>({
  field,
  sort,
  onSort,
  children,
  className,
}: {
  field: Field;
  sort: TableSort<Field>;
  onSort: (sort: TableSort<Field>) => void;
  children: ReactNode;
  className?: string;
}) {
  const active = sort?.field === field ? sort.direction : null;
  const Icon = active === "asc" ? ArrowUp : active === "desc" ? ArrowDown : ArrowUpDown;
  return (
    <TableHead
      aria-sort={active === "asc" ? "ascending" : active === "desc" ? "descending" : "none"}
      className={cn("sticky top-0 z-[2] bg-background", className)}
    >
      <button
        type="button"
        onClick={() => onSort(nextSort(sort, field))}
        className={cn(
          "-ml-2 inline-flex h-8 items-center gap-1.5 rounded-md px-2 hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
          active && "text-foreground",
        )}
      >
        {children}
        <Icon className={cn("size-3.5", !active && "opacity-40")} aria-hidden />
      </button>
    </TableHead>
  );
}

/** A plain header that still sticks to the top of the scrolling body. */
export function StickyHead({ children, className }: { children: ReactNode; className?: string }) {
  return <TableHead className={cn("sticky top-0 z-[2] bg-background", className)}>{children}</TableHead>;
}

/**
 * The area a page table scrolls in: the header and everything around it stay put.
 *
 * The height comes from the page: a flex column bounded by the viewport, with this element as the
 * `flex-1 min-h-0` child. No viewport math here — that was what let the rows overflow the card.
 */
export function TableScroll({ children, className }: { children: ReactNode; className?: string }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  // A phone locks each swipe to one axis: the rows go down, the columns go sideways, never both.
  useAxisLockScroll(scrollerRef, useIsPhone());
  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      {/* The table component brings its own overflow wrapper; inside this scroller it would be a
          second one, and the sticky header would bind to it instead. */}
      <div
        ref={scrollerRef}
        data-table-scroller=""
        className="min-h-0 flex-1 overflow-auto [&_[data-slot=table-container]]:overflow-visible"
      >
        {children}
      </div>
    </div>
  );
}
