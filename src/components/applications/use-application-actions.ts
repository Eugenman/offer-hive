"use client";

import { toast } from "sonner";
import { type ApplicationStatus, STATUS_LABELS } from "@/lib/domain";
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

  async function changeStatus(ids: string[], status: ApplicationStatus) {
    try {
      await repository.changeStatus(ids, { status });
      toast.success(
        ids.length === 1
          ? `Статус: ${STATUS_LABELS[status]}`
          : `Статус «${STATUS_LABELS[status]}» — ${countLabel(ids.length)}`,
      );
    } catch {
      reportError("Не удалось сменить статус")();
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

  return { changeStatus, remove, exportCsv };
}
