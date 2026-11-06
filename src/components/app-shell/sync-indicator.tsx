"use client";

import { useEffect, useState } from "react";
import { CloudOff, TriangleAlert } from "lucide-react";
import { Ring } from "@/components/loading-ui/ring";
import { useSyncStatus } from "@/lib/repository/provider";
import type { SyncStatus } from "@/lib/sync/sync-storage";

const LABELS: Record<Exclude<SyncStatus, "idle">, string> = {
  syncing: "Saving changes…",
  offline: "You’re offline. Changes will be saved when you’re back online.",
  error: "Can’t reach the server. Trying again…",
};

// A quick save finishes before the spinner would even be noticed: show it only if it takes longer.
const SPINNER_DELAY_MS = 400;

/** Bottom-right corner: a spinner while saving, an icon while changes wait; hidden when all is saved. */
export function SyncIndicator() {
  const status = useSyncStatus();
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (status !== "syncing") return;
    const timer = setTimeout(() => setSlow(true), SPINNER_DELAY_MS);
    return () => {
      clearTimeout(timer);
      setSlow(false);
    };
  }, [status]);

  const visible = status === "offline" || status === "error" || (status === "syncing" && slow);
  const label = status === "idle" ? "All changes saved" : LABELS[status];

  return (
    <div role="status" className="fixed right-4 bottom-4 z-40">
      <span className="sr-only">{visible ? label : ""}</span>
      {visible ? (
        <span
          title={label}
          className="flex size-9 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm"
        >
          {status === "syncing" ? (
            <Ring className="size-4" aria-hidden />
          ) : status === "offline" ? (
            <CloudOff className="size-4" aria-hidden />
          ) : (
            <TriangleAlert className="size-4 text-destructive" aria-hidden />
          )}
        </span>
      ) : null}
    </div>
  );
}
