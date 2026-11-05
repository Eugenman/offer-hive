"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { ArchiveRestore, HardDriveDownload, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ImportDialog } from "@/components/applications/add/import-dialog";
import { ExportMenu } from "@/components/applications/export-menu";
import { useApplicationActions } from "@/components/applications/use-application-actions";
import { type ParsedBackup, parseBackup } from "@/lib/export/backup-file";
import { formatDate } from "@/lib/format";
import { countApplications } from "@/lib/plural";
import { useRepository, useRepositoryQuery } from "@/lib/repository/provider";
import { Section, Setting } from "./section";

/** Settings → Data: export, import, backup, and deleting everything. */
export function DataSettings() {
  const repository = useRepository();
  const actions = useApplicationActions();
  const [confirmClear, setConfirmClear] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [pendingRestore, setPendingRestore] = useState<Extract<ParsedBackup, { ok: true }> | null>(null);
  const backupInput = useRef<HTMLInputElement>(null);
  // Next.js keeps hidden pages alive (<Activity>): close transient dialogs when leaving.
  useLayoutEffect(
    () => () => {
      setConfirmClear(false);
      setImportOpen(false);
      setPendingRestore(null);
    },
    [],
  );
  const { data: total = 0 } = useRepositoryQuery(
    "total",
    async (repo) => (await repo.list({ pageSize: 1 })).total,
  );
  // "Delete all" also covers the archive and statistics of deleted applications.
  const { data: everything = 0 } = useRepositoryQuery(
    "statistics-total",
    async (repo) => (await repo.listForStatistics()).length,
  );

  async function chooseBackup(file: File | undefined) {
    if (!file) return;
    const backup = parseBackup(await file.text());
    if (backup.ok) setPendingRestore(backup);
    else toast.error("This file isn’t an Offerhive backup");
  }

  async function restore() {
    if (!pendingRestore) return;
    const { snapshot } = pendingRestore;
    setPendingRestore(null);
    try {
      await repository.restoreSnapshot(snapshot);
      toast.success("Backup restored");
    } catch {
      toast.error("Couldn’t restore the backup");
    }
  }

  async function clearAll() {
    try {
      await repository.clear();
      toast.success("All data deleted");
    } catch {
      toast.error("Couldn’t delete the data");
    }
  }

  return (
    <div className="grid gap-8">
      <Section title="Data">
        <p className="-mt-2 max-w-xl text-sm text-muted-foreground">
          Your applications are saved to your account. Download a backup to keep a copy of your own.
        </p>
        <Setting
          title="Export"
          description="All applications in one spreadsheet. Opens in Excel, Numbers and LibreOffice."
        >
          <ExportMenu
            label="Download spreadsheet"
            disabled={total === 0}
            onExport={(format) => void actions.exportApplications({ query: {} }, format)}
          />
        </Setting>
        <Setting title="Import" description="Upload the spreadsheet you kept your applications in.">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload aria-hidden />
            Import spreadsheet
          </Button>
        </Setting>
        <Setting title="Backup" description="Everything in one file, including the archive and statistics.">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={everything === 0}
              onClick={() => void actions.downloadBackup()}
            >
              <HardDriveDownload aria-hidden />
              Download backup
            </Button>
            <Button variant="outline" onClick={() => backupInput.current?.click()}>
              <ArchiveRestore aria-hidden />
              Restore backup
            </Button>
            <input
              ref={backupInput}
              type="file"
              accept=".json,application/json"
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(event) => {
                void chooseBackup(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </div>
        </Setting>
        <Setting
          danger
          title="Delete all data"
          description={`Applications, the archive and statistics: ${countApplications(everything)} counted now.`}
        >
          <Button variant="destructive" disabled={everything === 0} onClick={() => setConfirmClear(true)}>
            <Trash2 aria-hidden />
            Delete all
          </Button>
        </Setting>
      </Section>

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />

      <AlertDialog open={pendingRestore !== null} onOpenChange={(open) => !open && setPendingRestore(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore this backup?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRestore
                ? `The backup from ${formatDate(pendingRestore.exportedAt.slice(0, 10))} has ${countApplications(pendingRestore.applications)}. `
                : ""}
              It replaces everything in this browser, including the archive and statistics. This can’t be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void restore()}>Restore backup</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete all data?</AlertDialogTitle>
            <AlertDialogDescription>
              Every application, the archive and all statistics will be deleted. This can’t be undone.
              Download a backup first if you may need the data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void clearAll()}>
              Delete all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
