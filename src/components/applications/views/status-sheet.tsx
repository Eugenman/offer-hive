"use client";

import { useEffect, useRef } from "react";
import { XIcon } from "lucide-react";
import { STATUS_LABELS, type ApplicationStatus, type ApplicationSummary } from "@/lib/domain";
import { StatusBadge } from "../../applications/status-badge";
import { groupStatuses } from "../../applications/status-menu-groups";

/**
 * The status picker on a phone: a sheet from the bottom with the statuses grouped by column.
 *
 * Dragging a card with a finger was invisible (nobody knows a card is draggable) and fought with
 * scrolling, so a phone changes the status here, from a button on the card.
 *
 * Plain markup, not a dialog primitive: the panel is mounted all the time so its slide has a
 * "before" position, and a modal primitive would keep the page locked behind an always-mounted
 * panel — the board stopped scrolling.
 */
export function StatusSheet({
  app,
  open,
  statuses,
  onPick,
  onClose,
}: {
  /** Kept while the panel slides down: an emptying panel would collapse instead of leaving. */
  app: ApplicationSummary | null;
  open: boolean;
  statuses: readonly ApplicationStatus[];
  onPick: (status: ApplicationStatus) => void;
  onClose: () => void;
}) {
  const groups = groupStatuses(statuses);
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

  return (
    <>
      <div
        aria-hidden
        onClick={onClose}
        className="fixed inset-0 z-50 bg-foreground/20 transition-opacity duration-[180ms] ease-out"
        style={{ opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none" }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={app ? `Change status: ${app.company}` : "Change status"}
        aria-hidden={!open}
        inert={!open}
        tabIndex={-1}
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[80dvh] flex-col rounded-t-2xl bg-popover pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-12px_40px_rgb(0_0_0_/_0.18)] transition-transform duration-[260ms] ease-[cubic-bezier(.32,.72,0,1)] outline-none"
        style={{
          transform: open ? "translateY(0)" : "translateY(100%)",
          pointerEvents: open ? "auto" : "none",
        }}
      >
        <header className="flex flex-none items-center gap-2 border-b px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{app ? app.company : ""}</p>
            <p className="truncate text-xs text-muted-foreground">
              {app ? `${app.position} · now ${STATUS_LABELS[app.status]}` : null}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto flex size-8 flex-none items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <XIcon className="size-4" aria-hidden />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
          {groups.map((group) => (
            <section key={group.key} className="mb-2 rounded-xl border p-2 last:mb-0">
              <h3 className="px-1 pb-1.5 text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase">
                {group.title}
              </h3>
              <ul className="flex flex-col gap-1">
                {group.zones.map((status) => (
                  <li key={status}>
                    <button
                      type="button"
                      disabled={app?.status === status}
                      onClick={() => onPick(status)}
                      className="flex w-full items-center rounded-lg px-1 py-1 text-left transition-colors hover:bg-muted disabled:opacity-45"
                    >
                      <StatusBadge status={status} className="w-full justify-center" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
