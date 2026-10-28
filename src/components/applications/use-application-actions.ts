"use client";

import { toast } from "sonner";
import { type ApplicationStatus, STATUS_LABELS } from "@/lib/domain";
import { StatusTransitionError } from "@/lib/repository/types";
import { buildApplicationsCsv, downloadFile, exportFileName } from "@/lib/export/applications-csv";
import { APPLICATION_WORDS, pluralRu } from "@/lib/plural";
import { useRepository } from "@/lib/repository/provider";
import type { ApplicationsQuery } from "@/lib/repository/types";

const UNDO_DURATION_MS = 10_000;

function countLabel(count: number) {
  return `${count} ${pluralRu(count, APPLICATION_WORDS)}`;
}

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
        cause instanceof StatusTransitionError
          ? `Нельзя перевести в «${STATUS_LABELS[status]}»`
          : "Не удалось сменить статус",
      )();
      return;
    }
    if (changedIds.length === 0) return;
    toast.success(
      ids.length === 1
        ? `Статус: ${STATUS_LABELS[status]}`
        : `Статус «${STATUS_LABELS[status]}» — ${countLabel(changedIds.length)}`,
      {
        duration: UNDO_DURATION_MS,
        action: {
          label: "Отменить",
          onClick: () => {
            repository.revertStatus(changedIds).catch(reportError("Не удалось отменить смену статуса"));
          },
        },
      },
    );
  }

  /** Undo of the last status change, e.g. one made by mistake. */
  async function revertStatus(id: string, to: ApplicationStatus) {
    try {
      await repository.revertStatus([id]);
      toast.success(`Статус возвращён: ${STATUS_LABELS[to]}`);
    } catch {
      reportError("Не удалось вернуть статус")();
    }
  }

  async function remove(ids: string[], name?: string) {
    try {
      await repository.remove(ids);
    } catch {
      reportError("Не удалось удалить")();
      return;
    }
    toast(ids.length === 1 && name ? `Удалён отклик «${name}»` : `Удалено: ${countLabel(ids.length)}`, {
      duration: UNDO_DURATION_MS,
      action: {
        label: "Отменить",
        onClick: () => {
          repository.restore(ids).catch(reportError("Не удалось восстановить"));
        },
      },
    });
  }

  async function exportCsv(target: { ids: string[] } | { query: ApplicationsQuery }) {
    try {
      const details =
        "ids" in target
          ? (await Promise.all(target.ids.map((id) => repository.get(id)))).filter((app) => app !== null)
          : await repository.listDetailed(target.query);
      if (details.length === 0) {
        toast("Нечего выгружать");
        return;
      }
      downloadFile(buildApplicationsCsv(details), exportFileName(), "text/csv;charset=utf-8");
      toast.success(`Выгружено: ${countLabel(details.length)}`);
    } catch {
      reportError("Не удалось выгрузить таблицу")();
    }
  }

  return { changeStatus, revertStatus, remove, exportCsv };
}
