"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type ApplicationStatus,
  BOARD_COLUMNS,
  STATUS_LABELS,
  TERMINAL_STATUSES,
  type StatisticsEntry,
  columnFor,
} from "@/lib/domain";
import { formatDate, formatSalary, toDateTimeLocal } from "@/lib/format";
import { StatusBadge } from "../applications/status-badge";

/** The nearest planned event still ahead, or null when nothing is scheduled. */
function nextPlanned(entry: StatisticsEntry, now: number) {
  const planned = (entry.events ?? [])
    .filter((event) => event.state === "planned" && event.scheduledAt !== null)
    .map((event) => Date.parse(event.scheduledAt!))
    .filter((time) => time >= now)
    .sort((a, b) => a - b);
  return planned[0] ?? null;
}

const initials = (value: string) => value.trim().charAt(0).toUpperCase() || "?";

/** The thin colour bar of a group: the zone palette the board already uses. */
function zoneBarOf(status: ApplicationStatus) {
  const column = columnFor(status)[0];
  switch (column) {
    case "wishlist":
      return "bg-column-wishlist-fg";
    case "sent":
      return "bg-column-applied-fg";
    case "screening":
      return "bg-zone-screening";
    case "offer":
      return "bg-zone-offer";
    case "accepted":
      return "bg-column-accepted-fg";
    default:
      return "bg-column-closed-fg";
  }
}

/**
 * Everything one source brought, grouped by the board column it stands in.
 *
 * The panel is mounted all the time and parked off-screen, exactly like the preview page: the
 * position is one class, and a transition carries it in and out. Nothing is mounted or unmounted to
 * open it, so the transition always has a "before" state.
 */
export function SourceDrawer({
  source,
  entries,
  now,
  onClose,
}: {
  source: string | null;
  entries?: StatisticsEntry[];
  now: number;
  onClose: () => void;
}) {
  const open = source !== null;
  const panelRef = useRef<HTMLDivElement>(null);

  // Escape closes; the panel takes focus when it opens so the keyboard stays inside it.
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [open, onClose]);

  const all = entries ?? [];
  const ofSource =
    open && source !== null ? all.filter((entry) => (entry.source ?? "Not specified") === source) : [];

  const time = (entry: StatisticsEntry) => (entry.statusChangedAt ? Date.parse(entry.statusChangedAt) : 0);
  const isTerminal = (status: ApplicationStatus) => (TERMINAL_STATUSES as readonly string[]).includes(status);

  const groups = BOARD_COLUMNS.map((column) => ({
    ...column,
    items: ofSource.filter((entry) => column.zones.includes(entry.status)),
  })).filter((group) => group.items.length > 0);

  return (
    <>
      {/* The scrim is a plain layer: it fades with the panel and never catches clicks while closed. */}
      <div
        aria-hidden
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-50 bg-foreground/10 transition-opacity duration-200",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="source-drawer-title"
        aria-hidden={!open}
        tabIndex={-1}
        className={cn(
          "fixed top-0 right-0 z-50 flex h-dvh w-full max-w-[26rem] flex-col bg-background outline-none",
          // The shadow belongs to an open panel only: a parked one would still paint its shadow
          // into the right edge of the screen.
          // `all`, because the panel moves with `translate` and its shadow is toggled too: naming
          // properties by hand missed one of them twice.
          "transition-all duration-200 ease-out",
          open
            ? "translate-x-0 shadow-[-12px_0_40px_rgb(0_0_0_/_0.12)]"
            : "pointer-events-none translate-x-full shadow-none",
        )}
      >
        <header className="flex flex-none items-center gap-2 border-b px-4 py-3.5">
          <h2 id="source-drawer-title" className="text-sm font-semibold">
            {source ?? ""} <span className="font-normal text-muted-foreground">({ofSource.length})</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <XIcon className="size-4" aria-hidden />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-2 pb-6">
          {groups.map((group) => {
            const sorted = [...group.items].sort((a, b) => {
              // A stage with something ahead is a queue of what to prepare: nearest first.
              const aNext = nextPlanned(a, now);
              const bNext = nextPlanned(b, now);
              if (aNext !== null && bNext !== null) return aNext - bNext;
              if (aNext !== null) return -1;
              if (bNext !== null) return 1;
              // Everything else reads newest first.
              return time(b) - time(a);
            });
            return (
              <section key={group.key} className="mt-4 first:mt-2">
                <h3 className="mb-1.5 flex items-center gap-1.5 px-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                  <span className={cn("h-3 w-[3px] rounded-full", zoneBarOf(group.zones[0]))} aria-hidden />
                  {group.title}
                  <span className="ml-auto font-medium tabular-nums">{group.items.length}</span>
                </h3>
                <ul>
                  {sorted.map((entry) => (
                    <li key={entry.id}>
                      <Link
                        href={`/applications/${entry.id}`}
                        className="flex items-start gap-2.5 rounded-lg p-2.5 transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                      >
                        <span className="flex size-7 flex-none items-center justify-center rounded-md bg-muted text-xs font-semibold">
                          {initials(entry.company)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{entry.company}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {entry.position}
                          </span>
                          <span className="mt-1 flex flex-wrap gap-x-2 text-[11px] text-muted-foreground tabular-nums">
                            {formatSalary(
                              entry.salaryMin ?? null,
                              entry.salaryMax ?? null,
                              entry.currency ?? null,
                            ) ? (
                              <span>
                                {formatSalary(
                                  entry.salaryMin ?? null,
                                  entry.salaryMax ?? null,
                                  entry.currency ?? null,
                                )}
                              </span>
                            ) : null}
                            {entry.statusChangedAt ? (
                              <span>
                                {formatDate(toDateTimeLocal(entry.statusChangedAt).slice(0, 10))?.replace(
                                  /, \d{4}$/,
                                  "",
                                )}
                              </span>
                            ) : null}
                          </span>
                        </span>
                        <StatusBadge
                          status={entry.status}
                          label={isTerminal(entry.status) ? undefined : STATUS_LABELS[entry.status]}
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
          {open && ofSource.length === 0 ? (
            <p className="px-2 py-6 text-sm text-muted-foreground">Nothing from this source yet.</p>
          ) : null}
        </div>
      </div>
    </>
  );
}
