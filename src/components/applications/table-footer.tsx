"use client";

import { useId } from "react";
import { ChevronLeft, ChevronRight, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PAGE_SIZES, type PageSize } from "./use-applications-url-state";

type TableFooterProps = {
  page: number;
  pageSize: PageSize;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: PageSize) => void;
  /** Folds the name column down to the avatar. */
  namesFolded?: boolean;
  onToggleNames?: () => void;
};

/** 1 … 4 5 6 … 12 — first, last and two neighbours of the current page. */
function pageList(current: number, last: number): (number | "gap")[] {
  const pages = new Set([1, last, current - 1, current, current + 1].filter((p) => p >= 1 && p <= last));
  const sorted = [...pages].sort((a, b) => a - b);
  return sorted.flatMap((page, index) =>
    index > 0 && page - sorted[index - 1] > 1 ? ["gap", page] : [page],
  );
}

export function TableFooter({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  namesFolded = false,
  onToggleNames,
}: TableFooterProps) {
  const labelId = useId();
  const last = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <div className="flex flex-wrap items-center gap-4 border-t px-6 py-3 text-sm text-muted-foreground max-[480px]:gap-2 max-[480px]:px-4">
      {/* Phones: page size is noise, the pager is one compact line. */}
      <div className="flex items-center gap-2 max-[480px]:hidden">
        <span id={labelId}>Rows per page</span>
        <Select
          value={String(pageSize)}
          onValueChange={(value) => onPageSizeChange(Number(value) as PageSize)}
        >
          <SelectTrigger size="sm" aria-labelledby={labelId} className="w-18">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZES.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {/* Phones: just the pager, centred: "‹ 1 / 2 ›". */}
      <span className="tabular-nums max-[480px]:hidden">
        {from}–{to} of {total}
      </span>
      <nav aria-label="Application pages" className="ml-auto flex items-center gap-1 max-[480px]:mx-auto">
        <Button variant="ghost" size="sm" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
          <ChevronLeft aria-hidden />
          <span className="max-[480px]:sr-only">Previous</span>
        </Button>
        <span className="hidden px-1 tabular-nums max-[480px]:inline">
          {page} / {last}
        </span>
        <span className="contents max-[480px]:hidden">
          {pageList(page, last).map((item, index) =>
            item === "gap" ? (
              <span key={`gap-${index}`} aria-hidden className="px-1">
                …
              </span>
            ) : (
              <Button
                key={item}
                variant={item === page ? "outline" : "ghost"}
                size="icon-sm"
                aria-current={item === page ? "page" : undefined}
                aria-label={`Page ${item}`}
                onClick={() => onPageChange(item)}
              >
                {item}
              </Button>
            ),
          )}
        </span>
        <Button variant="ghost" size="sm" onClick={() => onPageChange(page + 1)} disabled={page >= last}>
          <span className="max-[480px]:sr-only">Next</span>
          <ChevronRight aria-hidden />
        </Button>
      </nav>
      {/* Right of the pager: folds the name column down to the avatar. */}
      {onToggleNames ? (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onToggleNames}
          aria-pressed={namesFolded}
          aria-label={namesFolded ? "Show company names" : "Fold company names to avatars"}
          title={namesFolded ? "Show company names" : "Fold company names to avatars"}
        >
          {namesFolded ? <PanelLeftOpen aria-hidden /> : <PanelLeftClose aria-hidden />}
        </Button>
      ) : null}
    </div>
  );
}
