"use client";

import { useLayoutEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { debounce, parseAsString, useQueryState } from "nuqs";
import { Archive, Eye, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SortableHead, StickyHead, TableScroll, type TableSort } from "@/components/table/sortable-head";
import { BOARD_COLUMNS, STATUS_LABELS, type ApplicationStatus } from "@/lib/domain";
import { formatDate } from "@/lib/format";
import { paginate } from "@/lib/pagination";
import { countApplications, plural } from "@/lib/plural";
import { useRepository, useRepositoryQuery } from "@/lib/repository/provider";
import type { DeletedApplication } from "@/lib/repository/types";
import { trackHorizontalScroll } from "@/lib/table-scroll";
import { CompanyAvatar } from "../applications/company-avatar";
import { SearchInput } from "../applications/search-input";
import { TableFooter } from "../applications/table-footer";
import type { PageSize } from "../applications/use-applications-url-state";
import { StatusBadge } from "../applications/status-badge";

const DAY_MS = 86_400_000;

const normalize = (value: string) => value.toLocaleLowerCase("ru").replaceAll("ё", "е").trim();

/** The board column a status belongs to: it tells where the card stood when it was archived. */
function columnTitleOf(status: ApplicationStatus) {
  return BOARD_COLUMNS.find((column) => column.zones.includes(status))?.title ?? "";
}

/** Days until the automatic erase, with the tone of an approaching deadline. */
function daysLeft(erasedAt: string, now: number) {
  const days = Math.max(0, Math.ceil((Date.parse(erasedAt) - now) / DAY_MS));
  const text =
    days === 0
      ? "today"
      : days <= 7
        ? `${days} ${plural(days, "day", "days")} left`
        : `${days} ${plural(days, "day", "days")}`;
  const tone =
    days <= 3
      ? "font-medium text-destructive"
      : days <= 7
        ? "font-medium text-amber-700 dark:text-amber-400"
        : "text-muted-foreground";
  return { text, tone };
}

type ArchiveSortField = "company" | "status" | "archived" | "erased";

/** Same field for every row, so the list is ordered the way the header says. */
const sortValue = (app: DeletedApplication, field: ArchiveSortField) => {
  switch (field) {
    case "company":
      return app.company.toLocaleLowerCase("ru");
    case "status":
      return app.status;
    case "archived":
      return app.deletedAt;
    case "erased":
      return app.erasedAt;
  }
};

/** What "Delete forever" is about to erase: the checked rows, or one row from its own button. */
type PendingErase = { ids: string[]; label: string } | null;

/** Archived applications: restore them, or delete them for good before the 30 days run out. */
export function ArchiveView() {
  const router = useRouter();
  const repository = useRepository();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pendingErase, setPendingErase] = useState<PendingErase>(null);
  // Same idea as the main table: a sorted header sorts the list, the newest archive first by default.
  const [sort, setSort] = useState<TableSort<ArchiveSortField>>({ field: "archived", direction: "desc" });
  // Same pager as Applications: the archive can run to hundreds of rows.
  const [page, setPage] = useState(1);
  const [size, setSize] = useState<PageSize>(25);
  const { data, error } = useRepositoryQuery("archive", async (repo) => ({
    items: await repo.listDeleted(),
    now: Date.now(),
  }));

  // Reset transient UI when Next.js hides this page (<Activity>).
  useLayoutEffect(
    () => () => {
      setPendingErase(null);
      setSelected(new Set());
    },
    [],
  );

  // Same search as on Applications: company or position, kept in the URL (?q=).
  const [search, setSearch] = useQueryState("q", parseAsString.withDefault(""));
  const needle = normalize(search);
  const items = (data?.items ?? []).filter(
    (app) => !needle || normalize(app.company).includes(needle) || normalize(app.position).includes(needle),
  );

  const sorted = [...items].sort((a, b) => {
    if (!sort) return 0;
    const left = sortValue(a, sort.field);
    const right = sortValue(b, sort.field);
    return (sort.direction === "asc" ? 1 : -1) * left.localeCompare(right);
  });
  const paged = paginate(sorted, page, size);
  const visible = paged.items;

  // Rows restored or erased elsewhere drop out of the selection.
  const selectedIds = items.filter((app) => selected.has(app.id)).map((app) => app.id);
  const visibleIds = visible.map((app) => app.id);
  const checkedOnPage = visibleIds.filter((id) => selected.has(id)).length;
  const allChecked =
    checkedOnPage === 0 ? false : checkedOnPage === visibleIds.length ? true : ("indeterminate" as const);

  function toggleAll() {
    setSelected((current) => {
      const next = new Set(current);
      // Select all acts on the rows you can see, as it does on Applications.
      if (allChecked === true) visibleIds.forEach((id) => next.delete(id));
      else visibleIds.forEach((id) => next.add(id));
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const labelFor = (ids: string[]) =>
    ids.length === 1
      ? (items.find((app) => app.id === ids[0])?.company ?? "1 application")
      : countApplications(ids.length);

  async function restore(ids: string[]) {
    try {
      await repository.restore(ids);
      setSelected(new Set());
      const onlyId = ids.length === 1 ? ids[0] : null;
      toast.success(`Restored ${labelFor(ids)}`, {
        action: onlyId ? { label: "Open", onClick: () => router.push(`/applications/${onlyId}`) } : undefined,
      });
    } catch {
      toast.error("Couldn’t restore");
    }
  }

  async function erase() {
    if (!pendingErase) return;
    const { ids, label } = pendingErase;
    setPendingErase(null);
    try {
      await repository.erase(ids);
      setSelected(new Set());
      toast.success(`Deleted ${label} forever`);
    } catch {
      toast.error("Couldn’t delete");
    }
  }

  if (error) {
    return (
      <p role="alert" className="px-6 py-8 text-sm text-destructive">
        Couldn’t load the archive. Reload the page.
      </p>
    );
  }
  if (!data) return <div aria-hidden className="h-96" />;

  if (data.items.length === 0) {
    return (
      <div className="flex flex-col items-center px-6 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-xl bg-muted" aria-hidden>
          <Archive className="size-6 text-muted-foreground" />
        </span>
        <h2 className="mt-4 text-base font-semibold">The archive is empty</h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Archived applications stay here for 30 days, then they’re erased for good.
        </p>
      </div>
    );
  }

  const selectionLabel = selectedIds.length ? `: ${selectedIds.length}` : "";

  return (
    // Full height of the page slot: the toolbar stays, only the rows scroll.
    <div className="flex h-full min-h-0 flex-col">
      {/* Same toolbar rhythm as Applications: padding above and below, a border under it. */}
      <div className="flex flex-none flex-wrap items-center gap-2 border-b bg-background px-6 py-4 max-[480px]:sticky max-[480px]:top-16 max-[480px]:z-20">
        <SearchInput
          value={search}
          onChange={(next) => {
            setPage(1);
            void setSearch(next || null, { limitUrlUpdates: next ? debounce(300) : undefined });
          }}
          label="Search the archive"
        />
        <Button
          variant="outline"
          disabled={selectedIds.length === 0}
          onClick={() => void restore(selectedIds)}
        >
          <RotateCcw aria-hidden />
          Restore
        </Button>
        <Button
          variant="outline"
          size="icon"
          disabled={selectedIds.length === 0}
          onClick={() => setPendingErase({ ids: selectedIds, label: labelFor(selectedIds) })}
          aria-label={`Delete selected forever${selectionLabel}`}
          title={
            selectedIds.length ? `Delete selected forever${selectionLabel}` : "Select applications to delete"
          }
          className="text-destructive hover:text-destructive disabled:text-muted-foreground"
        >
          <Trash2 aria-hidden />
        </Button>
      </div>
      {/* Same shell as Applications: the rows scroll, the header and the toolbar stay put. */}
      <TableScroll>
        {/* The last column has no width: it takes the leftover space, so the table fills the card
            while every other column keeps the exact width from the colgroup. With a fixed last
            column the extra would be spread over all of them. */}
        <Table ref={trackHorizontalScroll} className="w-full min-w-[1100px] table-fixed">
          <colgroup>
            {/* Same widths as the matching columns on Applications: checkbox, company, status,
                then the archive's own two, and the actions column takes the rest. */}
            <col className="w-14" />
            <col className="w-52 desktop:w-64" />
            <col className="w-36" />
            <col className="w-36" />
            <col className="w-44" />
            <col />
          </colgroup>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pinned-cell sticky top-0 left-0 z-[2] bg-background pl-6">
                <Checkbox
                  checked={allChecked}
                  onCheckedChange={toggleAll}
                  aria-label="Select all archived applications"
                />
              </TableHead>
              <SortableHead
                field="company"
                sort={sort}
                onSort={setSort}
                className="pinned-cell-edge pinned-cell left-14"
              >
                Company and position
              </SortableHead>
              <SortableHead
                field="status"
                sort={sort}
                onSort={(next) => {
                  setSort(next);
                  setPage(1);
                }}
              >
                Status
              </SortableHead>
              <SortableHead
                field="archived"
                sort={sort}
                onSort={(next) => {
                  setSort(next);
                  setPage(1);
                }}
              >
                Archived
              </SortableHead>
              <SortableHead
                field="erased"
                sort={sort}
                onSort={(next) => {
                  setSort(next);
                  setPage(1);
                }}
              >
                Erased in
              </SortableHead>
              <StickyHead className="pinned-cell right-0 pr-6">
                <span className="sr-only">Actions</span>
              </StickyHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((app: DeletedApplication) => (
              <TableRow
                key={app.id}
                data-state={selected.has(app.id) ? "selected" : undefined}
                // Double click opens the application, as in the main table; not on its controls.
                onDoubleClick={(event) => {
                  if ((event.target as Element).closest("a, button, [role=checkbox]")) return;
                  window.getSelection()?.removeAllRanges();
                  router.push(`/archive/${app.id}`);
                }}
                className="cursor-default"
              >
                <TableCell className="pinned-cell left-0 pl-6">
                  <Checkbox
                    checked={selected.has(app.id)}
                    onCheckedChange={() => toggleOne(app.id)}
                    aria-label={`Select ${app.company}`}
                  />
                </TableCell>
                <TableCell className="pinned-cell-edge pinned-cell left-14">
                  <Link
                    href={`/archive/${app.id}`}
                    className="group flex min-w-0 items-center gap-3 rounded-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <CompanyAvatar name={app.company} />
                    <span className="min-w-0">
                      <span className="block truncate font-medium group-hover:underline">{app.company}</span>
                      <span className="block truncate text-muted-foreground">{app.position}</span>
                    </span>
                  </Link>
                </TableCell>
                <TableCell>
                  {/* The exact sub-status, with its board column next to it: "Interview · In process".
                      When the column is named like the status ("Wishlist"), the second label says
                      nothing and is dropped. */}
                  {/* Stacked, not side by side: the column is as narrow as on Applications, and a
                      wide badge would squeeze the column name into a stray letter. */}
                  <span className="flex min-w-0 flex-col items-start gap-0.5">
                    <StatusBadge status={app.status} />
                    {columnTitleOf(app.status) === STATUS_LABELS[app.status] ? null : (
                      <span className="truncate text-[11px] text-muted-foreground">
                        {columnTitleOf(app.status)}
                      </span>
                    )}
                  </span>
                </TableCell>
                <TableCell>{formatDate(app.deletedAt.slice(0, 10))}</TableCell>
                <TableCell className={daysLeft(app.erasedAt, data.now).tone}>
                  {daysLeft(app.erasedAt, data.now).text}
                </TableCell>
                <TableCell className="pinned-cell right-0 bg-background pr-6">
                  <span className="flex items-center justify-end gap-1">
                    <Button asChild variant="ghost" size="icon-sm" aria-label={`Open ${app.company}`}>
                      <Link href={`/archive/${app.id}`} title="Open">
                        <Eye aria-hidden />
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void restore([app.id])}
                      aria-label={`Restore ${app.company}`}
                    >
                      <RotateCcw aria-hidden />
                      Restore
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setPendingErase({ ids: [app.id], label: app.company })}
                      aria-label={`Delete ${app.company} forever`}
                      title="Delete forever"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </span>
                </TableCell>
              </TableRow>
            ))}
            {items.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  Nothing found. Try another search.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </TableScroll>

      <TableFooter
        page={paged.page}
        pageSize={size}
        total={sorted.length}
        onPageChange={setPage}
        onPageSizeChange={(value) => {
          setSize(value);
          setPage(1);
        }}
      />

      <AlertDialog open={pendingErase !== null} onOpenChange={(open) => !open && setPendingErase(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete forever?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingErase?.label} and everything attached to{" "}
              {pendingErase?.ids.length === 1 ? "it" : "them"} (progress, notes, status history) will be
              erased. This can’t be undone. Statistics keep counting it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void erase()}>
              Delete forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
