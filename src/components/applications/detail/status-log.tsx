"use client";

import { useId } from "react";
import { ArrowRight } from "lucide-react";
import type { ApplicationDetails } from "@/lib/domain";
import { formatDateTime } from "@/lib/format";
import { StatusBadge } from "../status-badge";

/** Every status change with its system time and, for "Отказ / Отказался", the reason. */
export function StatusLog({ app }: { app: ApplicationDetails }) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId}>
      <h2 id={titleId} className="mb-2 text-sm font-semibold">
        Журнал статусов
      </h2>
      <ol className="grid gap-2">
        {app.statusChanges.map((change) => (
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
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              <time dateTime={change.changedAt}>{formatDateTime(change.changedAt)}</time>
            </p>
            {change.reason ? <p className="mt-0.5 text-sm">Причина: {change.reason}</p> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
