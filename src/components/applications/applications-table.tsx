"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { nextEvent } from "@/lib/next-event";
import { waitingDays } from "@/lib/waiting";
import { STATE_BORDER_CLASSES } from "@/lib/stage-state";
import { shortStageTitle, stageTitle } from "@/lib/stage-title";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SortableHead } from "@/components/table/sortable-head";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { STAGE_STATE_LABELS, type ApplicationStatus, type ApplicationSummary } from "@/lib/domain";
import { formatDate, formatDateTime, formatSalary, toDateTimeLocal } from "@/lib/format";
import type { SortDirection, SortField } from "@/lib/repository/types";
import { CompanyAvatar } from "./company-avatar";
import { rememberListPosition } from "./detail/return-to-list";
import { trackHorizontalScroll } from "@/lib/table-scroll";
import { NoteCell } from "./note-cell";
import { StatusMenu } from "./status-menu";

const EMPTY = <span className="text-muted-foreground/60">—</span>;

export type TableSort = { field: SortField; direction: SortDirection } | null;

// Click cycles: ascending → descending → back to default order.
/**
 * The event that comes next, marked with a dashed outline: it is the same event the card and the
 * application page show, only brought up to the row. Past and cancelled events do not count.
 */
function NextEvent({ app }: { app: ApplicationSummary }) {
  const event = nextEvent(app.events);
  if (!event) {
    // Nothing scheduled for a week or more: the silence itself is the signal.
    const waiting = waitingDays(app);
    if (waiting === null) return <span className="text-muted-foreground">{EMPTY}</span>;
    return (
      <span
        className="inline-flex items-center rounded-lg bg-amber-500/15 px-2 py-1 text-xs font-medium whitespace-nowrap text-amber-700 tabular-nums dark:text-amber-400"
        title={`Nothing planned and no answer for ${waiting} days`}
      >
        No reply · {waiting} d
      </span>
    );
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex max-w-full cursor-default items-center gap-1.5 rounded-lg border-2 border-dashed px-2 py-1 text-xs whitespace-nowrap",
            STATE_BORDER_CLASSES[event.state],
          )}
        >
          <span className="tabular-nums">
            {formatDate(toDateTimeLocal(event.scheduledAt).slice(0, 10))?.replace(/, \d{4}/, "")}
          </span>
          <span className="truncate text-muted-foreground">· {shortStageTitle(event)}</span>
        </span>
      </TooltipTrigger>
      {/* More about the event without opening the application. */}
      <TooltipContent className="gap-1 px-3 py-2">
        <p className="font-medium">{stageTitle(event)}</p>
        <p className="text-background/70">{formatDateTime(event.scheduledAt)}</p>
        <p className="text-background/70">{STAGE_STATE_LABELS[event.state]}</p>
      </TooltipContent>
    </Tooltip>
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
    // Below a 1870px window the table keeps the width it has at 1870px (1622px next to the open
    // sidebar) and scrolls sideways, so columns never get cramped; company and position stay
    // pinned on the left. Without the sidebar (1024px and below) it keeps that same 1622px.
    <Table
      ref={trackHorizontalScroll}
      className="min-w-[1622px] table-fixed desktop:min-w-[max(100%,calc(100%_+_1870px_-_100vw))]"
    >
      <colgroup>
        <col className="w-14" />
        <col className="w-52 desktop:w-64" />
        <col className="w-36" />
        <col className="w-36" />
        <col className="w-48" />
        <col className="w-36" />
        <col className="w-44" />
        <col />
        <col className="w-16" />
      </colgroup>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="pinned-cell sticky top-0 left-0 z-[2] bg-background pl-6">
            <Checkbox
              checked={allChecked}
              onCheckedChange={toggleAll}
              aria-label="Select all applications on this page"
            />
          </TableHead>
          <SortableHead
            field="company"
            sort={sort}
            onSort={onSort}
            className="pinned-cell-edge pinned-cell left-14"
          >
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
          <TableHead className="sticky top-0 z-[2] bg-background">Next event</TableHead>
          <TableHead className="sticky top-0 z-[2] bg-background">Notes</TableHead>
          {/* Pinned to the right edge: the action stays in view while the table scrolls. */}
          <TableHead className="pinned-cell sticky top-0 right-0 z-[2] bg-background pr-6">
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
            <TableCell className="pinned-cell left-0 pl-6">
              <Checkbox
                checked={selected.has(app.id)}
                onCheckedChange={() => toggleOne(app.id)}
                aria-label={`Select ${app.company}`}
              />
            </TableCell>
            <TableCell className="pinned-cell-edge pinned-cell left-14">
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
            {/* A wish has no date applied yet: show when it was added. */}
            <TableCell>
              {formatDate(app.appliedAt ?? toDateTimeLocal(app.createdAt).slice(0, 10)) ?? EMPTY}
            </TableCell>
            <TableCell className="truncate tabular-nums">
              {formatSalary(app.salaryMin, app.salaryMax, app.currency) ?? EMPTY}
            </TableCell>
            <TableCell className="truncate">
              {app.source ? <span className="text-muted-foreground">{app.source}</span> : EMPTY}
            </TableCell>
            <TableCell>
              <NextEvent app={app} />
            </TableCell>
            <TableCell className="relative max-w-0">
              <NoteCell notes={app.notes} />
            </TableCell>
            <TableCell className="pinned-cell right-0 pr-6 text-right">
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
