"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useIsPhone } from "@/lib/use-is-phone";
import { useAxisLockScroll } from "@/lib/use-axis-lock";
import { cn } from "@/lib/utils";
import { type ApplicationDetails, type ApplicationStatus, STATUS_LABELS } from "@/lib/domain";
import { columnKeyOf } from "@/lib/column-colors";
import { shortStageTitle, stageTitle } from "@/lib/stage-title";
import { formatDate, toDateTimeLocal } from "@/lib/format";
import { CompanyAvatar } from "../company-avatar";

const DAY = 86_400_000;
const FINAL: readonly ApplicationStatus[] = [
  "offer",
  "offer_discussion",
  "accepted",
  "rejected",
  "withdrawn",
];

/**
 * Bars carry the column colour, one step more saturated than the board tint, with a matching
 * border: on a white page a borderless pastel rectangle dissolves. Values follow the palette the
 * rest of the product uses (blue = applied, amber = in process, green = offer, teal = accepted,
 * slate = closed), with dark-mode tints of the same hues.
 */
const BAR_STYLES: Record<string, string> = {
  wishlist: "border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800/70",
  applied: "border-blue-200 bg-blue-100 dark:border-blue-800 dark:bg-blue-950/70",
  in_process: "border-orange-200 bg-orange-100 dark:border-orange-800 dark:bg-orange-950/70",
  offer: "border-green-200 bg-green-100 dark:border-green-800 dark:bg-green-950/70",
  accepted: "border-teal-200 bg-teal-100 dark:border-teal-800 dark:bg-teal-950/70",
  closed: "border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800/70",
};

// The today line splits past from future: it gets the accent colour, not a grey hairline.
const TODAY_LINE = "bg-indigo-600";
const TODAY_BADGE = "bg-indigo-600 text-white";

const dayOf = (iso: string) => Date.parse(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
const isoDay = (time: number) => new Date(time).toISOString().slice(0, 10);
// A date applied in the future is bad data; the bar still must not claim a negative length.
const days = (from: number, to: number) => Math.max(0, Math.round((to - from) / DAY));
/**
 * Phones get a popover on tap: a tooltip there opens on touchstart and closes on touchend, so it
 * only flashes. A mouse gets the usual tooltip on hover.
 */
function BarTip({ label, children }: { label: string; children: React.ReactNode }) {
  const isPhone = useIsPhone();
  const text = <span className="text-xs leading-snug whitespace-pre-line">{label}</span>;
  if (!isPhone) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent>{text}</TooltipContent>
      </Tooltip>
    );
  }
  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-auto max-w-72 px-3 py-2">{text}</PopoverContent>
    </Popover>
  );
}

type TimelineStage = ApplicationDetails["stages"][number];
type StageGroup = { key: string; at: number; stages: TimelineStage[] };

/** Local calendar day of a timestamp: the same day the tooltip prints. */
const localDay = (iso: string) => toDateTimeLocal(iso)?.slice(0, 10) ?? iso.slice(0, 10);

/** Events of one application grouped by their day, oldest first. */
function groupStagesByDay(stages: TimelineStage[]): StageGroup[] {
  const groups = new Map<string, StageGroup>();
  for (const stage of stages) {
    if (!stage.scheduledAt) continue;
    const key = localDay(stage.scheduledAt);
    const at = Date.parse(stage.scheduledAt);
    const group = groups.get(key);
    if (group) {
      group.stages.push(stage);
      group.at = Math.min(group.at, at);
    } else {
      groups.set(key, { key, at, stages: [stage] });
    }
  }
  for (const group of groups.values()) {
    group.stages.sort((a, b) => Date.parse(a.scheduledAt!) - Date.parse(b.scheduledAt!));
  }
  return [...groups.values()].sort((a, b) => a.at - b.at);
}

const timeOf = (iso: string) =>
  new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(iso));

/**
 * Always two levels: the day on top, the events under it — one per line, with a bullet and a count
 * only when the day holds more than one.
 */
function groupLabel(group: StageGroup, now: number): string {
  const first = group.stages[0]!;
  const many = group.stages.length > 1;
  const day = formatDate(localDay(first.scheduledAt!)) ?? "";
  const header = many ? `${day} (${group.stages.length} events)` : day;
  const lines = group.stages.map((stage) => {
    const bullet = many ? "• " : "";
    return `${bullet}${timeOf(stage.scheduledAt!)} — ${stageName(stage)} (${stageOutcome(stage, now)})`;
  });
  return `${header}\n${lines.join("\n")}`;
}

/**
 * Whether an event is behind us. The date decides, but a stage marked done is history as well:
 * a done stage whose date slipped into the future must not look like a hollow "upcoming" ring.
 */
function isPastStage(stage: ApplicationDetails["stages"][number], now: number): boolean {
  if (stage.state === "done") return true;
  return Boolean(stage.scheduledAt && dayOf(stage.scheduledAt) < now);
}

/** The words in the tooltip, derived from the same rule as the marker's look. */
function stageOutcome(stage: ApplicationDetails["stages"][number], now: number): string {
  const past = isPastStage(stage, now);
  if (stage.state === "failed") return "failed";
  if (stage.state === "cancelled") return "cancelled";
  if (past) return stage.state === "done" ? "done" : "past, no outcome recorded";
  return stage.state === "planned" ? "planned" : "planned, marked done ahead of time";
}

/**
 * How one day's marker looks. The day holds one or more events, and any of them may be cancelled;
 * a day is "upcoming" only when a live event still lies ahead, and a day whose events were all
 * cancelled or failed is muted — never an indigo ring, never the NEXT halo.
 */
function markerLook(
  group: StageGroup,
  now: number,
  nextId: string | null,
): { classes: string; tone: "past" | "done" | "upcoming" | "muted"; pulse?: boolean } {
  const live = group.stages.filter((stage) => stage.state !== "cancelled" && stage.state !== "failed");
  // Every colour here is the one the state badge in the progress card uses, so a dot on the chart
  // and a badge in the card always read as the same state.
  if (live.length === 0) {
    const failed = group.stages.some((stage) => stage.state === "failed");
    return {
      tone: "muted",
      classes: failed
        ? // The double ring of the "next" marker, in red: a failed day always stands out a little.
          "border-2 border-status-rejected bg-background text-status-rejected ring-4 ring-status-rejected/20"
        : "border-2 border-status-withdrawn bg-background text-status-withdrawn",
    };
  }
  const ahead = live.some((stage) => !isPastStage(stage, now));
  const isNext = group.stages.some((stage) => stage.id === nextId);
  if (ahead) {
    return {
      tone: "upcoming",
      // Only a day that still lies ahead breathes; a plan whose date has passed is a plain ring.
      pulse: isNext && ahead,
      classes: "border-2 border-status-sent bg-background text-status-sent",
    };
  }
  // A finished day wears the same hollow ring as an upcoming one, in its own green.
  if (live.some((stage) => stage.state === "done")) {
    return { tone: "done", classes: "border-2 border-status-offer bg-background text-status-offer" };
  }
  // Planned but the day is gone and nobody marked an outcome: the same ring, a paler blue.
  return {
    tone: "past",
    classes: "border-2 border-status-sent/50 bg-background text-status-sent/70",
  };
}

/**
 * Markers live on three fixed levels, one per outcome of the day: upcoming on top, finished in the
 * middle, cancelled or failed at the bottom. Same status always shares a line, so a row reads from
 * top to bottom like a schedule and two different events never hide each other.
 */
const LANES = 3;
const LANE_OF = { upcoming: 0, done: 1, past: 1, muted: 2 } as const;
/** Vertical position of a lane inside the row, as a percentage of its height. */
const laneTop = (lane: number) => `${((lane + 0.5) / LANES) * 100}%`;

/** The latest event still ahead of us, or null when everything is in the past. */
function lastPlannedAt(app: ApplicationDetails, now: number): number | null {
  const future = app.stages
    .flatMap((stage) => (stage.scheduledAt ? [Date.parse(stage.scheduledAt)] : []))
    .filter((time) => time > now);
  return future.length ? Math.max(...future) : null;
}

/** The nearest planned stage: the one the eye should land on first. */
function nextStageId(app: ApplicationDetails, now: number): string | null {
  const planned = app.stages
    .filter(
      (stage) =>
        stage.scheduledAt &&
        !isPastStage(stage, now) &&
        stage.state !== "cancelled" &&
        stage.state !== "failed",
    )
    .sort((a, b) => Date.parse(a.scheduledAt!) - Date.parse(b.scheduledAt!));
  return planned[0]?.id ?? null;
}

/** The user's own title wins; the generated one already ends with "#2", so it is not repeated. */
const stageName = (stage: ApplicationDetails["stages"][number]) =>
  stage.title?.trim() || (stage.scheduledAt ? shortStageTitle(stage) : stageTitle(stage));

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
  // `start` matters too: an application dated in the future draws its bar there, and the axis
  // must reach it, or the grid and the dates stop while the marks keep going right.
  const max = Math.max(...rows.map((row) => Math.max(row.start, row.end)), ...stageTimes, today) + 3 * DAY;
  const span = max - min;
  /** One mapping for ticks, the today line, bars and dots: exact milliseconds, no rounding. */
  const dateToX = (time: number) => `${((time - min) / span) * 100}%`;
  const left = dateToX;

  // Weekly ticks on Mondays.
  const ticks: number[] = [];
  const first = new Date(min);
  first.setUTCDate(first.getUTCDate() + ((8 - first.getUTCDay()) % 7));
  for (let t = first.getTime(); t < max; t += 7 * DAY) ticks.push(t);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  // Weeks go sideways, rows go down: one gesture is not allowed to do both.
  useAxisLockScroll(scrollerRef, true);

  // Open on the present, not on last August: the today line sits at about 70% of the viewport, so
  // both the elapsed bars and the upcoming dots are in sight. Without this a phone showed the
  // oldest weeks and the rows looked empty.
  useEffect(() => {
    const scroller = scrollerRef.current;
    const content = scroller?.firstElementChild as HTMLElement | null;
    if (!scroller || !content) return;
    const todayX = ((today - min) / span) * content.offsetWidth;
    scroller.scrollLeft = Math.max(0, todayX - scroller.clientWidth * 0.7);
  }, [today, min, span]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <style>{`
        @keyframes timeline-pulse {
          0% { transform: scale(1); opacity: 0.8; }
          70%, 100% { transform: scale(2.3); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .timeline-pulse { animation: none !important; opacity: 0.3; }
        }
      `}</style>
      {/* What the symbols mean, in one quiet line above the axis. */}
      <div className="flex flex-none flex-wrap items-center justify-end gap-x-4 gap-y-1 px-6 pt-1 pb-2 text-xs text-muted-foreground max-[480px]:px-4">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-full border-2 border-status-offer" /> done
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-full border-2 border-status-sent" /> upcoming
        </span>
        <span className="inline-flex items-center gap-1.5 max-[480px]:hidden">
          <span aria-hidden className="size-2.5 rounded-full border-2 border-status-withdrawn" /> cancelled
        </span>
        <span className="inline-flex items-center gap-1.5 max-[480px]:hidden">
          <span aria-hidden className={cn("h-2.5 w-6 rounded-full border", BAR_STYLES.applied)} />
          applied
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className={cn("h-2.5 w-6 rounded-full border", BAR_STYLES.in_process)} />
          in process
        </span>
        <span className="inline-flex items-center gap-1.5 max-[480px]:hidden">
          <span aria-hidden className={cn("h-2.5 w-6 rounded-full border", BAR_STYLES.offer)} />
          offer
        </span>
        <span className="inline-flex items-center gap-1.5 max-[480px]:hidden">
          <span aria-hidden className={cn("h-2.5 w-6 rounded-full border", BAR_STYLES.accepted)} />
          accepted
        </span>
        <span className="inline-flex items-center gap-1.5 max-[480px]:hidden">
          <span aria-hidden className={cn("h-2.5 w-6 rounded-full border", BAR_STYLES.closed)} />
          closed
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className={cn("size-2.5 rounded-full", TODAY_LINE)} /> today
        </span>
      </div>
      <div
        ref={scrollerRef}
        onScroll={(event) => setScrolled(event.currentTarget.scrollLeft > 1)}
        // Phones start flush left (every pixel counts); wider screens keep the page gutter.
        className="min-h-0 flex-1 overflow-auto pr-6 pb-6 min-[481px]:pl-6"
      >
        <div className="min-w-[900px]">
          <div className="sticky top-0 z-20 grid grid-cols-[14rem_1fr] items-end bg-background pt-1 pb-2 text-xs text-muted-foreground shadow-[0_6px_8px_-6px_rgba(0,0,0,0.10)] max-[480px]:grid-cols-[9.5rem_1fr]">
            {/* Row one: the today badge — just the date, the line above says the rest. */}
            <span aria-hidden className="h-5" />
            <div className="relative h-5">
              <span
                className={cn(
                  "absolute top-0 -translate-x-1/2 rounded px-1.5 py-0.5 text-[10px] leading-none font-semibold tracking-wide whitespace-nowrap",
                  TODAY_BADGE,
                )}
                style={{ left: left(today) }}
                aria-label={`Today, ${formatDate(isoDay(today))}`}
                title="Today"
              >
                {formatDate(isoDay(today))?.replace(/,? \d{4}$/, "")}
              </span>
            </div>
            {/* Row two: names and dates share one baseline. */}
            <span
              className={cn(
                "sticky left-0 z-10 h-5 bg-background pr-3 leading-5 max-[480px]:pl-3",
                scrolled && "border-r border-border shadow-[4px_0_8px_-4px_rgba(0,0,0,0.08)]",
              )}
            >
              Application
            </span>
            <div className="relative mx-6 h-5 leading-5">
              {ticks.map((tick) => (
                <span
                  key={tick}
                  className="absolute top-0 -translate-x-1/2 whitespace-nowrap"
                  style={{ left: left(tick) }}
                >
                  {formatDate(isoDay(tick))?.replace(/,? \d{4}$/, "")}
                </span>
              ))}
            </div>
          </div>
          <ul>
            {rows.map(({ app, start, end }) => {
              const groups = groupStagesByDay(app.stages);
              return (
                <li
                  key={app.id}
                  data-id={app.id}
                  className="grid grid-cols-[14rem_1fr] items-stretch border-b py-2 max-[480px]:grid-cols-[9.5rem_1fr]"
                >
                  <Link
                    href={`/applications/${app.id}`}
                    className={cn(
                      "group flex min-w-0 items-center gap-2 bg-background pr-3 text-sm focus-visible:rounded-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none max-[480px]:pl-3",
                      // The names stay put while the weeks scroll under them.
                      "sticky left-0 z-10",
                      scrolled && "border-r border-border shadow-[4px_0_8px_-4px_rgba(0,0,0,0.08)]",
                    )}
                  >
                    <CompanyAvatar name={app.company} className="size-6 text-xs" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium group-hover:underline">{app.company}</span>
                      <span className="block truncate text-xs text-muted-foreground">{app.position}</span>
                    </span>
                  </Link>
                  {/* Three levels: upcoming, finished, cancelled. */}
                  <div className="relative mx-6" style={{ height: LANES * 18 }}>
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
                      className={cn("absolute inset-y-0 w-px", TODAY_LINE)}
                      style={{ left: left(today) }}
                    />
                    <BarTip
                      label={[
                        formatDate(isoDay(start)) ?? "",
                        `${app.company} · ${FINAL.includes(app.status) ? STATUS_LABELS[app.status].toLowerCase() : "in process"} ${days(start, end)} days`,
                        ...(app.stages.length
                          ? [
                              `current stage: ${shortStageTitle(app.stages.reduce((latest, stage) => (stage.seq > latest.seq ? stage : latest))).replace(/ #\d+$/, "")}`,
                            ]
                          : []),
                      ].join("\n")}
                    >
                      <button
                        type="button"
                        aria-label={`${app.company}: ${STATUS_LABELS[app.status]}, since ${formatDate(isoDay(start))}`}
                        className={cn(
                          "absolute top-1/2 h-4 -translate-y-1/2 rounded-full border focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                          BAR_STYLES[columnKeyOf(app.status)],
                        )}
                        style={{ left: left(start), width: `max(0.75rem, ${((end - start) / span) * 100}%)` }}
                      />
                    </BarTip>
                    {/* Planned events sit right of the today line; the dashed tail ties them to the
                      bar instead of leaving them floating. */}
                    {lastPlannedAt(app, now) !== null && lastPlannedAt(app, now)! > end ? (
                      <span
                        aria-hidden
                        className={cn(
                          "pointer-events-none absolute top-1/2 h-4 -translate-y-1/2 rounded-r-full border border-dashed opacity-40",
                          BAR_STYLES[columnKeyOf(app.status)],
                        )}
                        style={{
                          left: left(end),
                          width: `${((lastPlannedAt(app, now)! - end) / span) * 100}%`,
                        }}
                      />
                    ) : null}
                    {/* Events that fall on the same day collapse into one marker with a count: two
                      circles on top of each other say nothing and hide each other. */}
                    {groups.map((group) => {
                      const look = markerLook(group, now, nextStageId(app, now));
                      const lane = LANE_OF[look.tone];
                      const single = group.stages.length === 1;
                      return (
                        <Fragment key={group.key}>
                          {/* The next event breathes: a ring grows out of the dot and fades, so the
                              upcoming date is found without reading anything. It sits beside the
                              trigger: `asChild` accepts exactly one child element. */}
                          {look.tone === "upcoming" && look.pulse ? (
                            <span
                              aria-hidden
                              className="timeline-pulse pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-status-sent/70"
                              style={{
                                left: left(group.at),
                                top: laneTop(lane),
                                width: single ? 12 : 20,
                                height: single ? 12 : 20,
                                animation: "timeline-pulse 2s ease-out infinite",
                              }}
                            />
                          ) : null}
                          <BarTip label={groupLabel(group, now)}>
                            <button
                              type="button"
                              aria-label={groupLabel(group, now).replace(/\n/g, ", ")}
                              className={cn(
                                "absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full ring-2 ring-background focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                                single ? "size-3" : "size-5",
                                !single && "text-[9px] font-semibold",
                                look.classes,
                              )}
                              style={{ left: left(group.at), top: laneTop(lane) }}
                            >
                              {single ? null : group.stages.length}
                            </button>
                          </BarTip>
                        </Fragment>
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
