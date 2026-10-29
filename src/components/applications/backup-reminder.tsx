"use client";

import { useState } from "react";
import { Download, HardDrive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isBackupDue, snoozeBackupReminder } from "@/lib/backup";
import { useRepositoryQuery } from "@/lib/repository/provider";
import { useApplicationActions } from "./use-application-actions";

/** A quiet weekly nudge to download a copy: the data lives only in this browser. */
export function BackupReminder() {
  const actions = useApplicationActions();
  const [hidden, setHidden] = useState(false);
  const { data: oldest } = useRepositoryQuery("oldest-application", async (repo) => {
    const { items } = await repo.list({ pageSize: Number.MAX_SAFE_INTEGER });
    return items.reduce<string | null>(
      (min, app) => (min === null || app.createdAt < min ? app.createdAt : min),
      null,
    );
  });

  if (hidden || oldest === undefined || !isBackupDue(oldest)) return null;

  return (
    <div
      role="status"
      className="mx-6 mb-4 flex flex-wrap items-center gap-3 rounded-lg border bg-muted/40 px-4 py-3 text-sm"
    >
      <HardDrive className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <p className="min-w-0 flex-1">
        Your applications are stored only in this browser. It’s been a week since the last backup.
      </p>
      <div className="flex gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            snoozeBackupReminder();
            setHidden(true);
          }}
        >
          Later
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            if (await actions.downloadBackup()) setHidden(true);
          }}
        >
          <Download aria-hidden />
          Download backup
        </Button>
      </div>
    </div>
  );
}
