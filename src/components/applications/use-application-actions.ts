"use client";

import { toast } from "sonner";
import { type ApplicationStatus, STATUS_LABELS } from "@/lib/domain";
import { isRepositoryError } from "@/lib/repository/types";
import { markBackedUp } from "@/lib/backup";
import { backupFileName, buildBackup } from "@/lib/export/backup-file";
import {
  buildApplicationsCsv,
  buildApplicationsXlsx,
  downloadFile,
  type ExportFormat,
  exportFileName,
} from "@/lib/export/applications-csv";
import { countApplications } from "@/lib/plural";
import { useRepository } from "@/lib/repository/provider";
import type { ApplicationsQuery } from "@/lib/repository/types";

const UNDO_DURATION_MS = 10_000;

const countLabel = countApplications;

function reportError(message: string) {
  return () => toast.error(message);
}

/** User-facing actions over applications, with toasts. Shared by the table, kanban and card. */
export function useApplicationActions() {
  const repository = useRepository();

  async function changeStatus(ids: string[], status: ApplicationStatus, reason?: string) {
    // Only records that really change can be undone; the rest already had this status.
    let changedIds: string[] = [];
    try {
      const before = await Promise.all(ids.map((id) => repository.get(id)));
      changedIds = before.filter((app) => app && app.status !== status).map((app) => app!.id);
      await repository.changeStatus(ids, { status, reason });
    } catch (cause) {
      reportError(
        isRepositoryError(cause, "status_transition")
          ? `Can’t move to ${STATUS_LABELS[status]}`
          : "Couldn’t change the status",
      )();
      return;
    }
    if (changedIds.length === 0) return;
    toast.success(
      ids.length === 1
        ? `Status: ${STATUS_LABELS[status]}`
        : `${STATUS_LABELS[status]}: ${countLabel(changedIds.length)}`,
      {
        duration: UNDO_DURATION_MS,
        action: {
          label: "Undo",
          onClick: () => {
            repository.revertStatus(changedIds).catch(reportError("Couldn’t undo the status change"));
          },
        },
      },
    );
  }

  /** Undo of the last status change, e.g. one made by mistake. */
  async function revertStatus(id: string, to: ApplicationStatus) {
    try {
      await repository.revertStatus([id]);
      toast.success(`Status back to ${STATUS_LABELS[to]}`);
    } catch {
      reportError("Couldn’t undo the status change")();
    }
  }

  async function remove(ids: string[], name?: string) {
    try {
      await repository.remove(ids);
    } catch {
      reportError("Couldn’t move to the archive")();
      return;
    }
    toast(
      ids.length === 1 && name
        ? `Moved ${name} to the archive`
        : `Moved ${countLabel(ids.length)} to the archive`,
      {
        duration: UNDO_DURATION_MS,
        action: {
          label: "Undo",
          onClick: () => {
            repository.restore(ids).catch(reportError("Couldn’t restore"));
          },
        },
      },
    );
  }

  /** Downloads a CSV or Excel file; true when a file was saved. */
  async function exportApplications(
    target: { ids: string[] } | { query: ApplicationsQuery },
    format: ExportFormat = "csv",
  ) {
    try {
      const details =
        "ids" in target
          ? (await Promise.all(target.ids.map((id) => repository.get(id)))).filter((app) => app !== null)
          : await repository.listDetailed(target.query);
      if (details.length === 0) {
        toast("Nothing to export");
        return false;
      }
      if (format === "xlsx") {
        downloadFile(
          await buildApplicationsXlsx(details),
          exportFileName("xlsx"),
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        );
      } else {
        downloadFile(buildApplicationsCsv(details), exportFileName("csv"), "text/csv;charset=utf-8");
      }
      toast.success(`Exported ${countLabel(details.length)}`);
      return true;
    } catch {
      reportError("Couldn’t export")();
      return false;
    }
  }

  /** Downloads everything as one backup file; this is what resets the weekly reminder. */
  async function downloadBackup() {
    try {
      const snapshot = await repository.exportSnapshot();
      downloadFile(buildBackup(snapshot), backupFileName(), "application/json");
      markBackedUp();
      toast.success("Backup downloaded");
      return true;
    } catch {
      reportError("Couldn’t create the backup")();
      return false;
    }
  }

  return { changeStatus, revertStatus, remove, exportApplications, downloadBackup };
}
