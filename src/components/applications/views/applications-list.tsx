"use client";

import { useId } from "react";
import Link from "next/link";
import { MessageSquareText } from "lucide-react";
import {
  APPLICATION_STATUSES,
  type ApplicationStatus,
  type ApplicationSummary,
} from "@/lib/domain";
import { formatDate, formatSalary } from "@/lib/format";
import { CompanyAvatar } from "../company-avatar";
import { RowActions } from "../row-actions";
import { StatusBadge } from "../status-badge";

type ApplicationsListProps = {
  applications: ApplicationSummary[];
  onChangeStatus: (id: string, status: ApplicationStatus) => void;
  onDelete: (app: ApplicationSummary) => void;
};

/** Compact list grouped by status — later the default view on phones. */
export function ApplicationsList({ applications, onChangeStatus, onDelete }: ApplicationsListProps) {
  const idPrefix = useId();
  const groups = APPLICATION_STATUSES.map((status) => ({
    status,
    items: applications.filter((app) => app.status === status),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="grid gap-6 px-6 pt-1 pb-6">
      {groups.map(({ status, items }) => (
        <section key={status} aria-labelledby={`${idPrefix}-${status}`}>
          <h2 id={`${idPrefix}-${status}`} className="mb-1 flex items-center gap-2">
            <StatusBadge status={status} />
            <span className="text-sm font-normal text-muted-foreground tabular-nums">{items.length}</span>
          </h2>
          <ul className="divide-y rounded-lg ring-1 ring-border">
            {items.map((app) => {
              const salary = formatSalary(app.salaryMin, app.salaryMax, app.currency);
              const applied = formatDate(app.appliedAt);
              return (
                <li key={app.id} data-id={app.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                  <CompanyAvatar name={app.company} className="size-7 text-xs" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate">
                      <Link
                        href={`/applications/${app.id}`}
                        className="font-medium hover:underline focus-visible:rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                      >
                        {app.company}
                      </Link>
                      <span className="text-muted-foreground"> · {app.position}</span>
                    </p>
                    {app.latestNote ? (
                      <p className="mt-0.5 flex gap-1.5 text-xs text-muted-foreground">
                        <MessageSquareText className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                        <span className="shrink-0 tabular-nums" aria-label={`Заметок: ${app.noteCount}`}>
                          {app.noteCount}
                        </span>
                        <span className="line-clamp-2">{app.latestNote.body}</span>
                      </p>
                    ) : null}
                  </div>
                  <span className="hidden w-40 truncate text-right text-muted-foreground tabular-nums md:block">
                    {salary}
                  </span>
                  <span className="hidden w-28 text-right text-muted-foreground tabular-nums sm:block">
                    {applied}
                  </span>
                  <RowActions
                    id={app.id}
                    company={app.company}
                    status={app.status}
                    onChangeStatus={(next) => onChangeStatus(app.id, next)}
                    onDelete={() => onDelete(app)}
                  />
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
