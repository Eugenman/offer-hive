import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PAGE_SIZES = ["10", "25", "50"];

export function TableFooter({ total, pageSize = 25 }: { total: number; pageSize?: number }) {
  const shown = Math.min(total, pageSize);
  return (
    <div className="flex flex-wrap items-center gap-4 border-t px-6 py-3 text-sm text-muted-foreground">
      <div className="flex items-center gap-2">
        <span id="page-size-label">Показывать</span>
        <Select defaultValue={String(pageSize)}>
          <SelectTrigger size="sm" aria-labelledby="page-size-label" className="w-18">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZES.map((size) => (
              <SelectItem key={size} value={size}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <span className="tabular-nums">
        1–{shown} из {total}
      </span>
      <Pagination className="mx-0 ml-auto w-auto" aria-label="Страницы откликов">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious href="?page=1" text="Назад" aria-label="Предыдущая страница" />
          </PaginationItem>
          <PaginationItem>
            <PaginationLink href="?page=1" isActive>
              1
            </PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationNext href="?page=1" text="Вперёд" aria-label="Следующая страница" />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
