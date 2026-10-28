"use client";

import { ArrowRight, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type ApplicationDetails, STATUS_LABELS } from "@/lib/domain";
import { formatDateTime } from "@/lib/format";
import { StatusBadge } from "../status-badge";
import { useApplicationActions } from "../use-application-actions";
import { DetailCard } from "./detail-card";

/**
 * Every status change with its system time and, for "Отказ / Отказался", the reason.
 * The newest change can be undone: going back is only allowed to fix a mistake.
 */
export function StatusLog({ app }: { app: ApplicationDetails }) {
  const actions = useApplicationActions();
  const previous = app.previousStatus;
  return (
    <DetailCard title="Журнал статусов">
      <ol className="grid gap-2">
        {app.statusChanges.map((change, index) => (
          <li key={change.id} className="text-sm">
            <div className="flex flex-wrap items-center gap-1.5">
              {change.fromStatus ? (
                <>
                  <StatusBadge status={change.fromStatus} />
                  <ArrowRight className="size-3.5 text-muted-foreground" aria-label="на" />
                </>
              ) : (
                <span className="text-muted-foreground">Создан со статусом</span>
              )}
              <StatusBadge status={change.toStatus} />
              {index === 0 && previous ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto h-7 text-muted-foreground"
                  onClick={() => void actions.revertStatus(app.id, previous)}
                >
                  <Undo2 aria-hidden />
                  Вернуть «{STATUS_LABELS[previous]}»
                </Button>
              ) : null}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              <time dateTime={change.changedAt}>{formatDateTime(change.changedAt)}</time>
            </p>
            {change.reason ? <p className="mt-0.5 text-sm">Причина: {change.reason}</p> : null}
          </li>
        ))}
      </ol>
    </DetailCard>
  );
}
