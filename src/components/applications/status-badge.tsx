import { cn } from "@/lib/utils";
import { type ApplicationStatus, STATUS_LABELS } from "@/lib/domain";

const STATUS_CLASSES: Record<ApplicationStatus, string> = {
  sent: "bg-status-sent-bg text-status-sent",
  interview: "bg-status-interview-bg text-status-interview",
  test_task: "bg-status-test-bg text-status-test",
  offer: "bg-status-offer-bg text-status-offer",
  rejected: "bg-status-rejected-bg text-status-rejected",
  withdrawn: "bg-status-withdrawn-bg text-status-withdrawn",
};

export function StatusBadge({ status, className }: { status: ApplicationStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-md px-2 text-xs font-medium whitespace-nowrap",
        STATUS_CLASSES[status],
        className,
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
