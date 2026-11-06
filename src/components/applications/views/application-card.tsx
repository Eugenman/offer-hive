"use client";

import Link from "next/link";
import { Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ApplicationSummary } from "@/lib/domain";
import { formatDate, formatSalary } from "@/lib/format";
import { CompanyAvatar } from "../company-avatar";
import { NoteCell } from "../note-cell";

type ApplicationCardProps = {
  app: ApplicationSummary;
  className?: string;
};

/** Compact card used by the kanban board. Open via the eye button (the board adds double-click / Enter). */
export function ApplicationCard({ app, className }: ApplicationCardProps) {
  const salary = formatSalary(app.salaryMin, app.salaryMax, app.currency);
  const applied = formatDate(app.appliedAt);
  return (
    <article
      className={cn("relative rounded-lg bg-card p-3 text-sm shadow-xs ring-1 ring-border", className)}
    >
      <div className="flex items-start gap-2.5 pr-8">
        <CompanyAvatar name={app.company} className="size-7 text-xs" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{app.company}</p>
          <p className="truncate text-muted-foreground">{app.position}</p>
        </div>
      </div>
      <Link
        href={`/applications/${app.id}`}
        aria-label={`Open ${app.company}`}
        title="Open"
        // Keeps a press on the button from starting a drag of the whole card.
        onPointerDown={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
        className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Eye className="size-4" aria-hidden />
      </Link>
      {salary || applied ? (
        <p className="mt-2 flex flex-wrap gap-x-3 text-xs text-muted-foreground tabular-nums">
          {applied ? <span>{applied}</span> : null}
          {salary ? <span>{salary}</span> : null}
        </p>
      ) : null}
      {app.notes.length > 0 ? (
        // The notes button covers this row: hovering it shows every note, as in the table.
        <div className="relative mt-2">
          <NoteCell notes={app.notes} />
        </div>
      ) : null}
    </article>
  );
}
