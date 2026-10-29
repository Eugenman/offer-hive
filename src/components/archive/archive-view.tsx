"use client";

import { useLayoutEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { debounce, parseAsString, useQueryState } from "nuqs";
import { Archive, RotateCcw, Trash2 } from "lucide-react";
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
import { formatDate } from "@/lib/format";
import { countApplications, plural } from "@/lib/plural";
import { useRepository, useRepositoryQuery } from "@/lib/repository/provider";
import type { DeletedApplication } from "@/lib/repository/types";
import { trackHorizontalScroll } from "@/lib/table-scroll";
import { CompanyAvatar } from "../applications/company-avatar";
import { SearchInput } from "../applications/search-input";
import { StatusBadge } from "../applications/status-badge";

const DAY_MS = 86_400_000;

const normalize = (value: string) => value.toLocaleLowerCase("ru").replaceAll("ё", "е").trim();

function daysLeft(erasedAt: string, now: number) {
  const days = Math.max(1, Math.ceil((Date.parse(erasedAt) - now) / DAY_MS));
  return `${days} ${plural(days, "day", "days")}`;
}

/** What "Delete forever" is about to erase: the checked rows, or one row from its own button. */
type PendingErase = { ids: string[]; label: string } | null;

/** Archived applications: restore them, or delete them for good before the 30 days run out. */
export function ArchiveView() {
  const router = useRouter();
  const repository = useRepository();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pendingErase, setPendingErase] = useState<PendingErase>(null);
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
  // Rows restored or erased elsewhere drop out of the selection.
  const selectedIds = items.filter((app) => selected.has(app.id)).map((app) => app.id);
  const allChecked =
    selectedIds.length === 0
      ? false
      : selectedIds.length === items.length
        ? true
        : ("indeterminate" as const);

  function toggleAll() {
    setSelected(allChecked === true ? new Set() : new Set(items.map((app) => app.id)));
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
    <div className="py-4">
      <div className="flex flex-wrap items-center gap-2 px-6 pb-4">
        <SearchInput
          value={search}
          onChange={(next) =>
            void setSearch(next || null, { limitUrlUpdates: next ? debounce(300) : undefined })
          }
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
      <Table ref={trackHorizontalScroll} className="min-w-[896px] table-fixed">
        <colgroup>
          <col className="w-14" />
          <col className="w-52 desktop:w-80" />
          <col className="w-36" />
          <col className="w-40" />
          <col className="w-32" />
          <col className="w-44" />
        </colgroup>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="pinned-cell left-0 pl-6">
              <Checkbox
                checked={allChecked}
                onCheckedChange={toggleAll}
                aria-label="Select all archived applications"
              />
            </TableHead>
            <TableHead className="pinned-cell-edge pinned-cell left-14">Company and position</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Archived</TableHead>
            <TableHead>Erased in</TableHead>
            <TableHead className="pr-6">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((app: DeletedApplication) => (
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
                <StatusBadge status={app.status} />
              </TableCell>
              <TableCell>{formatDate(app.deletedAt.slice(0, 10))}</TableCell>
              <TableCell className="text-muted-foreground">{daysLeft(app.erasedAt, data.now)}</TableCell>
              <TableCell className="pr-6">
                <span className="flex items-center justify-end gap-1">
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
