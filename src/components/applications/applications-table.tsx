"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown, Eye, MessageSquareText } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ApplicationStatus, ApplicationSummary } from "@/lib/domain";
import { formatDate, formatSalary } from "@/lib/format";
import type { SortDirection, SortField } from "@/lib/repository/types";
import { CompanyAvatar } from "./company-avatar";
import { rememberListPosition } from "./detail/return-to-list";
import { StatusMenu } from "./status-menu";

const EMPTY = <span className="text-muted-foreground/60">—</span>;

function NoteCell({ count, latest }: { count: number; latest: ApplicationSummary["latestNote"] }) {
  if (!latest) return EMPTY;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="flex max-w-full items-center gap-1.5 rounded-md text-left text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <MessageSquareText className="size-3.5 shrink-0" aria-hidden />
          <span className="text-xs tabular-nums">{count}</span>
          <span className="truncate">{latest.body}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="start" className="max-w-80 whitespace-pre-line">
        {latest.body}
      </TooltipContent>
    </Tooltip>
  );
}

export type TableSort = { field: SortField; direction: SortDirection } | null;

// Click cycles: ascending → descending → back to default order.
function nextSort(current: TableSort, field: SortField): TableSort {
  if (current?.field !== field) return { field, direction: "asc" };
  if (current.direction === "asc") return { field, direction: "desc" };
  return null;
}

function SortableHead({
  field,
  sort,
  onSort,
  children,
}: {
  field: SortField;
  sort: TableSort;
  onSort: (sort: TableSort) => void;
  children: React.ReactNode;
}) {
  const active = sort?.field === field ? sort.direction : null;
  const Icon = active === "asc" ? ArrowUp : active === "desc" ? ArrowDown : ArrowUpDown;
  return (
    <TableHead aria-sort={active === "asc" ? "ascending" : active === "desc" ? "descending" : "none"}>
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

type ApplicationsTableProps = {
  applications: ApplicationSummary[];
  sort: TableSort;
  onSort: (sort: TableSort) => void;
  selected: ReadonlySet<string>;
  onSelectionChange: (selected: Set<string>) => void;
  onChangeStatus: (id: string, status: ApplicationStatus) => void;
  onRevertStatus: (application: ApplicationSummary) => void;
};

// Controls inside a row handle their own clicks; a double click on them must not open the application.
const INTERACTIVE = "a, button, input, [role=checkbox], [role=menuitem]";

export function ApplicationsTable({
  applications,
  sort,
  onSort,
  selected,
  onSelectionChange,
  onChangeStatus,
  onRevertStatus,
}: ApplicationsTableProps) {
  const router = useRouter();
  const pageIds = applications.map((app) => app.id);
  const selectedOnPage = pageIds.filter((id) => selected.has(id)).length;
  const allChecked =
    selectedOnPage === 0 ? false : selectedOnPage === pageIds.length ? true : ("indeterminate" as const);

  function toggleAll() {
    const next = new Set(selected);
    if (allChecked === true) pageIds.forEach((id) => next.delete(id));
    else pageIds.forEach((id) => next.add(id));
    onSelectionChange(next);
  }

  function open(id: string) {
    rememberListPosition(id);
    router.push(`/applications/${id}`);
  }

  function toggleOne(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  }

  return (
    <Table className="min-w-[1000px] table-fixed">
      <colgroup>
        <col className="w-14" />
        <col className="w-64" />
        <col className="w-52" />
        <col className="w-36" />
        <col className="w-48" />
        <col className="w-36" />
        <col />
        <col className="w-16" />
      </colgroup>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="pl-6">
            <Checkbox
              checked={allChecked}
              onCheckedChange={toggleAll}
              aria-label="Select all applications on this page"
            />
          </TableHead>
          <SortableHead field="company" sort={sort} onSort={onSort}>
            Company and position
          </SortableHead>
          <SortableHead field="status" sort={sort} onSort={onSort}>
            Status
          </SortableHead>
          <SortableHead field="appliedAt" sort={sort} onSort={onSort}>
            Date applied
          </SortableHead>
          <SortableHead field="salary" sort={sort} onSort={onSort}>
            Salary
          </SortableHead>
          <SortableHead field="source" sort={sort} onSort={onSort}>
            Source
          </SortableHead>
          <TableHead>Notes</TableHead>
          <TableHead className="pr-6">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {applications.map((app) => (
          <TableRow
            key={app.id}
            data-id={app.id}
            data-state={selected.has(app.id) ? "selected" : undefined}
            onDoubleClick={(event) => {
              if ((event.target as Element).closest(INTERACTIVE)) return;
              window.getSelection()?.removeAllRanges();
              open(app.id);
            }}
            className="cursor-default"
          >
            <TableCell className="pl-6">
              <Checkbox
                checked={selected.has(app.id)}
                onCheckedChange={() => toggleOne(app.id)}
                aria-label={`Select ${app.company}`}
              />
            </TableCell>
            <TableCell>
              <Link
                href={`/applications/${app.id}`}
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
              <StatusMenu
                company={app.company}
                status={app.status}
                previousStatus={app.previousStatus}
                onChangeStatus={(status) => onChangeStatus(app.id, status)}
                onRevertStatus={() => onRevertStatus(app)}
              />
            </TableCell>
            <TableCell>{formatDate(app.appliedAt) ?? EMPTY}</TableCell>
            <TableCell className="truncate tabular-nums">
              {formatSalary(app.salaryMin, app.salaryMax, app.currency) ?? EMPTY}
            </TableCell>
            <TableCell className="truncate">
              {app.source ? <span className="text-muted-foreground">{app.source}</span> : EMPTY}
            </TableCell>
            <TableCell className="max-w-0">
              <NoteCell count={app.noteCount} latest={app.latestNote} />
            </TableCell>
            <TableCell className="pr-6 text-right">
              <Link
                href={`/applications/${app.id}`}
                aria-label={`Open ${app.company}`}
                title="Open"
                className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <Eye className="size-4" aria-hidden />
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
