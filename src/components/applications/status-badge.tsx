import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { type ApplicationStatus, STATUS_LABELS } from "@/lib/domain";

const STATUS_CLASSES: Record<ApplicationStatus, string> = {
  sent: "bg-status-sent-bg text-status-sent",
  screening: "bg-status-screening-bg text-status-screening",
  interview: "bg-status-interview-bg text-status-interview",
  technical: "bg-status-technical-bg text-status-technical",
  test_task: "bg-status-test-bg text-status-test",
  offer: "bg-status-offer-bg text-status-offer",
  offer_discussion: "bg-status-discussion-bg text-status-discussion",
  rejected: "bg-status-rejected-bg text-status-rejected",
  withdrawn: "bg-status-withdrawn-bg text-status-withdrawn",
};

export function StatusBadge({
  status,
  label,
  count,
  checked,
  chevron,
  slot,
  sub,
  className,
}: {
  status: ApplicationStatus;
  /** Text instead of the status name, in the status colors (e.g. a kanban column title). */
  label?: string;
  /** A number shown inside the badge, after the text (kanban column totals). */
  count?: number;
  /**
   * Check mark inside the badge, on the same chip as `count` (the current status in a menu).
   * Passing it at all (true or false) gives the badge a chip slot and lets it fill its parent,
   * so a menu of badges is as wide as the longest one plus the check, whatever the labels are.
   */
  checked?: boolean;
  /**
   * A menu arrow in the chip slot, shown while the parent `group` is hovered, focused or open
   * (a badge that opens the status menu). Fills its parent like `checked`.
   */
  chevron?: boolean;
  /** Anything shown in the chip slot instead of a count: e.g. the time of a change. */
  slot?: React.ReactNode;
  /** A second line inside the badge, under the name: e.g. when the status started. */
  sub?: React.ReactNode;
  className?: string;
}) {
  const text = label ?? STATUS_LABELS[status];
  const withSlot = count !== undefined || checked !== undefined || chevron || slot !== undefined;
  const chip =
    count !== undefined ? (
      count
    ) : checked ? (
      <Check className="size-3" aria-hidden />
    ) : chevron ? (
      <ChevronDown className="size-3" aria-hidden />
    ) : (
      (slot ?? null)
    );

  // One minimum width for every badge (fits the longest label), so they line up in the table,
  // menus and kanban; a longer label added later grows the badge instead of overflowing it.
  const base = cn(
    "h-6 min-w-28 items-center rounded-md px-2 text-xs font-medium whitespace-nowrap",
    STATUS_CLASSES[status],
  );

  if (sub !== undefined) {
    // A two-line badge: the name, then the moment it started.
    return (
      <span
        className={cn(
          base,
          "inline-flex h-auto flex-col justify-center gap-0 px-2 py-0.5 leading-tight",
          className,
        )}
      >
        <span>{text}</span>
        <span className="mt-0.5 rounded-sm bg-background px-0.5 py-0.5 text-[10px] leading-none font-normal tabular-nums">
          {sub}
        </span>
      </span>
    );
  }

  if (!withSlot) {
    return <span className={cn(base, "inline-flex justify-center", className)}>{text}</span>;
  }

  // Three columns: an empty one as wide as the chip, the label, the chip. The side columns are
  // equal, so the label stays centered, and the gap always keeps it clear of the chip.
  return (
    <span
      className={cn(
        base,
        "grid grid-cols-[minmax(1rem,1fr)_auto_minmax(1rem,1fr)] gap-x-1.5 px-1",
        (checked !== undefined || chevron) && "w-full",
        className,
      )}
    >
      <span aria-hidden />
      <span>{text}</span>
      <span className="flex justify-end">
        {chip !== null ? (
          <span
            className={cn(
              "flex h-4 min-w-4 items-center justify-center rounded bg-background px-1 text-[11px] leading-none whitespace-nowrap tabular-nums",
              chevron &&
                "opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 group-data-[state=open]:opacity-100",
            )}
          >
            {chip}
          </span>
        ) : null}
      </span>
    </span>
  );
}
