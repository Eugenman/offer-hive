"use client";

import Link from "next/link";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  type ApplicationDetails,
  type ApplicationStatus,
  STAGE_STATE_LABELS,
  STATUS_LABELS,
} from "@/lib/domain";
import { stageTitle } from "@/lib/stage-title";
import { formatDate } from "@/lib/format";
import { CompanyAvatar } from "../company-avatar";

const DAY = 86_400_000;
const FINAL: readonly ApplicationStatus[] = ["offer", "offer_discussion", "rejected", "withdrawn"];

const BAR_CLASSES: Record<ApplicationStatus, string> = {
  sent: "bg-status-sent-bg ring-status-sent/30",
  screening: "bg-status-screening-bg ring-status-screening/30",
  interview: "bg-status-interview-bg ring-status-interview/30",
  technical: "bg-status-technical-bg ring-status-technical/30",
  test_task: "bg-status-test-bg ring-status-test/30",
  offer: "bg-status-offer-bg ring-status-offer/30",
  offer_discussion: "bg-status-discussion-bg ring-status-discussion/30",
  rejected: "bg-status-rejected-bg ring-status-rejected/30",
  withdrawn: "bg-status-withdrawn-bg ring-status-withdrawn/30",
};

const dayOf = (iso: string) => Date.parse(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
const isoDay = (time: number) => new Date(time).toISOString().slice(0, 10);

/** Applications on a shared date axis: bar = applied → last status change (or today), dots = stages. */
export function ApplicationsTimeline({
  applications,
  now,
}: {
  applications: ApplicationDetails[];
  now: number;
}) {
  const today = dayOf(isoDay(now));
  const rows = applications
    .map((app) => {
      const start = dayOf(app.appliedAt ?? app.createdAt.slice(0, 10));
      const end = FINAL.includes(app.status) ? Math.max(start, dayOf(app.statusChangedAt)) : today;
      return { app, start, end };
    })
    .sort((a, b) => a.start - b.start);

  const stageTimes = applications.flatMap((app) =>
    app.stages.flatMap((stage) => (stage.scheduledAt ? [dayOf(stage.scheduledAt)] : [])),
  );
  const min = Math.min(...rows.map((row) => row.start), today) - 2 * DAY;
  const max = Math.max(...rows.map((row) => row.end), ...stageTimes, today) + 3 * DAY;
  const span = max - min;
  const left = (time: number) => `${((time - min) / span) * 100}%`;

  // Weekly ticks on Mondays.
  const ticks: number[] = [];
  const first = new Date(min);
  first.setUTCDate(first.getUTCDate() + ((8 - first.getUTCDay()) % 7));
  for (let t = first.getTime(); t < max; t += 7 * DAY) ticks.push(t);

  return (
    <div className="overflow-x-auto px-6 pt-1 pb-6">
      <div className="min-w-[900px]">
        <div className="grid grid-cols-[14rem_1fr] border-b pb-2 text-xs text-muted-foreground">
          <span>Application</span>
          <div className="relative h-4">
            {ticks.map((tick) => (
              <span
                key={tick}
                className="absolute -translate-x-1/2 whitespace-nowrap"
                style={{ left: left(tick) }}
              >
                {formatDate(isoDay(tick))?.replace(/,? \d{4}$/, "")}
              </span>
            ))}
          </div>
        </div>
        <ul>
          {rows.map(({ app, start, end }) => (
            <li
              key={app.id}
              data-id={app.id}
              className="grid grid-cols-[14rem_1fr] items-center border-b py-2"
            >
              <Link
                href={`/applications/${app.id}`}
                className="group flex min-w-0 items-center gap-2 pr-3 text-sm focus-visible:rounded-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <CompanyAvatar name={app.company} className="size-6 text-xs" />
                <span className="min-w-0">
                  <span className="block truncate font-medium group-hover:underline">{app.company}</span>
                  <span className="block truncate text-xs text-muted-foreground">{app.position}</span>
                </span>
              </Link>
              <div className="relative h-8">
                {ticks.map((tick) => (
                  <span
                    key={tick}
                    aria-hidden
                    className="absolute inset-y-0 w-px bg-border/60"
                    style={{ left: left(tick) }}
                  />
                ))}
                <span
                  aria-hidden
                  className="absolute inset-y-0 w-px bg-primary/50"
                  style={{ left: left(today) }}
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label={`${app.company}: ${STATUS_LABELS[app.status]}, since ${formatDate(isoDay(start))}`}
                      className={cn(
                        "absolute top-1/2 h-4 -translate-y-1/2 rounded-full ring-1 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                        BAR_CLASSES[app.status],
                      )}
                      style={{ left: left(start), width: `max(0.75rem, ${((end - start) / span) * 100}%)` }}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    {STATUS_LABELS[app.status]} · applied {formatDate(isoDay(start))}
                  </TooltipContent>
                </Tooltip>
                {app.stages.map((stage) =>
                  stage.scheduledAt ? (
                    <Tooltip key={stage.id}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          aria-label={`${stageTitle(stage)}, ${formatDate(stage.scheduledAt.slice(0, 10))}, ${STAGE_STATE_LABELS[stage.state].toLowerCase()}`}
                          className={cn(
                            "absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-background focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                            stage.state === "done" && "bg-foreground",
                            stage.state === "planned" && "border-2 border-foreground bg-background",
                            stage.state === "cancelled" && "bg-muted-foreground/40",
                          )}
                          style={{ left: left(dayOf(stage.scheduledAt)) }}
                        />
                      </TooltipTrigger>
                      <TooltipContent>
                        {stageTitle(stage)} · {formatDate(stage.scheduledAt.slice(0, 10))} ·{" "}
                        {STAGE_STATE_LABELS[stage.state].toLowerCase()}
                      </TooltipContent>
                    </Tooltip>
                  ) : null,
                )}
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="h-2.5 w-6 rounded-full bg-status-sent-bg ring-1 ring-status-sent/30"
            />
            from applying to the last status change, or to today
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-full bg-foreground" /> done
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-full border-2 border-foreground" /> planned
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="h-3 w-px bg-primary/50" /> today
          </span>
        </p>
      </div>
    </div>
  );
}
