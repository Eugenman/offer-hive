"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
import { useIsPhone } from "@/lib/use-is-phone";
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
  /** The toolbar folds the name column down to the avatar. */
  namesFolded?: boolean;
};

// Controls inside a row handle their own clicks; a double click on them must not open the application.
const INTERACTIVE = "a, button, input, [role=checkbox], [role=menuitem]";

/** The fold mode straight from the address bar: available before any state settles. */
function readsFolded(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("names") === "folded";
}

export function ApplicationsTable({
  applications,
  sort,
  onSort,
  selected,
  onSelectionChange,
  onChangeStatus,
  onRevertStatus,
  namesFolded = false,
}: ApplicationsTableProps) {
  const router = useRouter();
  const isPhone = useIsPhone();
  // The toolbar button folds the first column down to the avatar, so the row keeps its width for
  // the data; the same button brings the names back.
  const tableRef = useRef<HTMLTableElement | null>(null);
  const headerCellRef = useRef<HTMLTableCellElement | null>(null);
  const [nameTip, setNameTip] = useState<string | null>(null);
  // A table column has no width transition, so the collapse is animated frame by frame.
  // Seeded from the address bar, not from the prop: the prop arrives a render later (the URL is
  // read on the client), and that gap was the flash on reload. `?names=folded` is known at once.
  const [nameWidth, setNameWidth] = useState<number | null>(() => (namesFolded || readsFolded() ? 56 : null));
  const widthFrame = useRef(0);
  // Only a real change of the prop animates: the first run (mount, or a re-render while the URL
  // settles) would otherwise animate the column and flash the wide state after a reload.
  const lastFolded = useRef(namesFolded);
  // A drag of the table must not also click the status badge under the finger.
  const pressStart = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  // Double tap opens the application on a phone: one tap is too easy to hit while scrolling.
  const lastTap = useRef<{ id: string; at: number } | null>(null);
  // The avatar opens the hint on one click and the application on two. Radix owns the first
  // click, so the second is counted here rather than waiting for a `dblclick` it may swallow.
  const lastAvatarClick = useRef<{ id: string; at: number } | null>(null);
  // Phones get no checkbox and no eye column: the checkboxes were hard to hit and the eye took
  // the width the position needs. A double tap opens the application instead.
  const withSelection = !isPhone;
  // While the column animates, its width decides what fits: the avatar only until it is wide.
  const folded = nameWidth !== null ? nameWidth <= 96 : namesFolded;
  const withActions = !isPhone;
  const pageIds = applications.map((app) => app.id);
  const selectedOnPage = pageIds.filter((id) => selected.has(id)).length;
  const allChecked =
    selectedOnPage === 0 ? false : selectedOnPage === pageIds.length ? true : ("indeterminate" as const);

  // Fold and unfold the first column: 56 px for the avatar, otherwise the original width.
  useLayoutEffect(() => {
    const changed = lastFolded.current !== namesFolded;
    lastFolded.current = namesFolded;
    if (!changed) return;
    const start = headerCellRef.current?.getBoundingClientRect().width ?? (namesFolded ? 208 : 56);
    const full = window.matchMedia("(min-width: 1024px)").matches ? 256 : 208;
    const end = namesFolded ? 56 : full;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (Math.abs(start - end) < 1 || reduce) {
      // Same width or reduced motion: land on the target on the next frame, not mid-render.
      widthFrame.current = requestAnimationFrame(() => setNameWidth(end));
      return () => cancelAnimationFrame(widthFrame.current);
    }
    const duration = 200;
    // The clock starts on the first frame: a busy first render must not swallow the animation.
    let began = 0;
    const step = (now: number) => {
      if (began === 0) began = now;
      const progress = Math.min(1, (now - began) / duration);
      // ease-out, so the column settles instead of stopping dead
      const eased = 1 - (1 - progress) ** 3;
      setNameWidth(Math.round(start + (end - start) * eased));
      if (progress < 1) widthFrame.current = requestAnimationFrame(step);
    };
    cancelAnimationFrame(widthFrame.current);
    widthFrame.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(widthFrame.current);
  }, [namesFolded]);

  // A hint closes on a press anywhere else, or on Escape.
  useEffect(() => {
    if (!nameTip) return;
    const close = (event: Event) => {
      const target = event.target as Element | null;
      if (target?.closest("[data-avatar-tip-trigger]")) return;
      setNameTip(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNameTip(null);
    };
    document.addEventListener("pointerdown", close, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", close, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [nameTip]);

  useEffect(() => {
    const scroller = tableRef.current?.closest<HTMLElement>("[data-table-scroller]");
    if (!scroller) return;
    const update = () => {
      // A hint that is already open belongs to the folded column: scrolling closes it.
      if (scroller.scrollLeft > 4) setNameTip(null);
    };
    update();
    scroller.addEventListener("scroll", update, { passive: true });
    return () => scroller.removeEventListener("scroll", update);
  }, []);

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
      ref={(element) => {
        tableRef.current = element;
        return trackHorizontalScroll(element);
      }}
      onPointerDownCapture={(event) => {
        const scroller = (event.currentTarget as HTMLElement).closest<HTMLElement>("[data-table-scroller]");
        pressStart.current = {
          x: event.clientX,
          y: event.clientY,
          left: scroller?.scrollLeft ?? 0,
          top: scroller?.scrollTop ?? 0,
        };
      }}
      onClickCapture={(event) => {
        const start = pressStart.current;
        if (!start) return;
        pressStart.current = null;
        const scroller = (event.currentTarget as HTMLElement).closest<HTMLElement>("[data-table-scroller]");
        const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y);
        const scrolled =
          Math.abs((scroller?.scrollLeft ?? 0) - start.left) > 4 ||
          Math.abs((scroller?.scrollTop ?? 0) - start.top) > 4;
        // Scrolling moves the finger and the table; the tap that ends a scroll is not a click.
        if (moved > 10 || scrolled) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
      className={cn(
        "table-fixed",
        withActions
          ? "min-w-[1622px] desktop:min-w-[max(100%,calc(100%_+_1870px_-_100vw))]"
          : "min-w-[1502px]",
      )}
    >
      <colgroup>
        {withSelection ? <col className="w-14" /> : null}
        <col
          className={nameWidth === null ? "w-52 desktop:w-64" : undefined}
          style={nameWidth !== null ? { width: nameWidth } : undefined}
        />
        <col className="w-36" />
        <col className="w-36" />
        <col className="w-48" />
        <col className="w-36" />
        <col className="w-44" />
        <col />
        {withActions ? <col className="w-16" /> : null}
      </colgroup>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          {withSelection ? (
            <TableHead className="pinned-cell sticky top-0 left-0 z-[3] bg-background pl-6 max-[480px]:pl-3">
              <Checkbox
                checked={allChecked}
                onCheckedChange={toggleAll}
                aria-label="Select all applications on this page"
              />
            </TableHead>
          ) : null}
          <SortableHead
            field="company"
            sort={sort}
            onSort={onSort}
            className={cn(
              // `z-[3]`: the other headers scroll under this cell, they must not paint over it.
              "pinned-cell-edge pinned-cell z-[3] border-r border-border select-none",
              withSelection ? "left-14" : "left-0 pl-6 max-[480px]:pl-3",
            )}
          >
            {folded ? <span className="sr-only">Company and position</span> : "Company and position"}
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
          {withActions ? (
            <TableHead className="pinned-cell sticky top-0 right-0 z-[2] bg-background pr-6">
              <span className="sr-only">Actions</span>
            </TableHead>
          ) : null}
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
            // Phones: two taps open the application, one is too easy to hit while scrolling.
            onClick={(event) => {
              if (!isPhone) return;
              if ((event.target as Element).closest("button, [role=checkbox]")) return;
              const now = Date.now();
              const previous = lastTap.current;
              if (previous && previous.id === app.id && now - previous.at < 400) {
                lastTap.current = null;
                open(app.id);
                return;
              }
              lastTap.current = { id: app.id, at: now };
            }}
          >
            {withSelection ? (
              <TableCell className="pinned-cell left-0 pl-6 max-[480px]:pl-3">
                <Checkbox
                  checked={selected.has(app.id)}
                  onCheckedChange={() => toggleOne(app.id)}
                  aria-label={`Select ${app.company}`}
                />
              </TableCell>
            ) : null}
            <TableCell
              className={cn(
                "pinned-cell-edge pinned-cell border-r border-border select-none",
                withSelection ? "left-14" : "left-0 pl-6 max-[480px]:pl-3",
              )}
            >
              {folded ? (
                // Folded: the avatar alone. One click shows who it is, two open the application.
                // The hint is a plain element, not a popover: a popover's dismiss layer swallows
                // the second click, so a double click never reached the button.
                <div className="relative flex items-center">
                  <button
                    type="button"
                    data-avatar-tip-trigger=""
                    aria-label={`${app.company}, ${app.position}. Open the application with a double click`}
                    onClick={() => {
                      const now = Date.now();
                      const previous = lastAvatarClick.current;
                      lastAvatarClick.current = { id: app.id, at: now };
                      if (previous && previous.id === app.id && now - previous.at < 400) {
                        lastAvatarClick.current = null;
                        setNameTip(null);
                        open(app.id);
                        return;
                      }
                      setNameTip(app.id);
                    }}
                    className="flex h-10 items-center rounded-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <CompanyAvatar name={app.company} />
                  </button>
                  {nameTip === app.id ? (
                    <span
                      role="tooltip"
                      className="pointer-events-none absolute top-1/2 left-full z-30 ml-4 flex h-10 w-max max-w-64 -translate-y-1/2 flex-col justify-center gap-0.5 rounded-lg bg-popover px-3 text-popover-foreground shadow-md ring-1 ring-foreground/10"
                    >
                      <span className="text-sm leading-tight font-medium">{app.company}</span>
                      <span className="text-xs leading-tight text-muted-foreground">{app.position}</span>
                    </span>
                  ) : null}
                </div>
              ) : isPhone ? (
                // No link: a single tap must not open anything, the row handles a double tap.
                <div className="flex h-10 min-w-0 items-center gap-3">
                  <CompanyAvatar name={app.company} />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{app.company}</span>
                    <span className="block truncate text-muted-foreground">{app.position}</span>
                  </span>
                </div>
              ) : (
                <Link
                  href={`/applications/${app.id}`}
                  className="group flex h-10 min-w-0 items-center gap-3 rounded-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <CompanyAvatar name={app.company} />
                  <span className="min-w-0">
                    <span className="block truncate font-medium group-hover:underline">{app.company}</span>
                    <span className="block truncate text-muted-foreground">{app.position}</span>
                  </span>
                </Link>
              )}
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
            {withActions ? (
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
            ) : null}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
