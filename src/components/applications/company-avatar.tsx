import { cn } from "@/lib/utils";

const PALETTE = [
  "bg-status-sent-bg text-status-sent",
  "bg-status-interview-bg text-status-interview",
  "bg-status-test-bg text-status-test",
  "bg-status-offer-bg text-status-offer",
  "bg-status-rejected-bg text-status-rejected",
];

function pickColor(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.codePointAt(0)!) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

// Colored initials instead of fetched logos: no third-party requests, no layout shift.
export function CompanyAvatar({ name, className }: { name: string; className?: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-semibold",
        pickColor(name),
        className,
      )}
    >
      {initial}
    </span>
  );
}
