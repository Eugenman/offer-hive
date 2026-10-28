"use client";

import { useId } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PAGE_SIZES, type PageSize } from "./use-applications-url-state";

type TableFooterProps = {
  page: number;
  pageSize: PageSize;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: PageSize) => void;
};

/** 1 … 4 5 6 … 12 — first, last and two neighbours of the current page. */
function pageList(current: number, last: number): (number | "gap")[] {
  const pages = new Set([1, last, current - 1, current, current + 1].filter((p) => p >= 1 && p <= last));
  const sorted = [...pages].sort((a, b) => a - b);
  return sorted.flatMap((page, index) => (index > 0 && page - sorted[index - 1] > 1 ? ["gap", page] : [page]));
}

export function TableFooter({ page, pageSize, total, onPageChange, onPageSizeChange }: TableFooterProps) {
  const labelId = useId();
  const last = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <div className="flex flex-wrap items-center gap-4 border-t px-6 py-3 text-sm text-muted-foreground">
      <div className="flex items-center gap-2">
        <span id={labelId}>Показывать</span>
        <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value) as PageSize)}>
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
      <span className="tabular-nums">
        {from}–{to} из {total}
      </span>
      <nav aria-label="Страницы откликов" className="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
          <ChevronLeft aria-hidden />
          Назад
        </Button>
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
              aria-label={`Страница ${item}`}
              onClick={() => onPageChange(item)}
            >
              {item}
            </Button>
          ),
        )}
        <Button variant="ghost" size="sm" onClick={() => onPageChange(page + 1)} disabled={page >= last}>
          Вперёд
          <ChevronRight aria-hidden />
        </Button>
      </nav>
    </div>
  );
}
