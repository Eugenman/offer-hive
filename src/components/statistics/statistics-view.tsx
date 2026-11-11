"use client";

import { useId, useState } from "react";
import { ChartColumn } from "lucide-react";
import { formatDate } from "@/lib/format";
import { countApplications } from "@/lib/plural";
import { useRepositoryQuery } from "@/lib/repository/provider";
import { computeStatistics, stepConversion, weekStart, type Statistics } from "@/lib/stats";
import { SourceDrawer } from "./source-drawer";
import { COLUMN_BG } from "@/lib/column-colors";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const percent = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 0 });
// Conversions keep one decimal: 80.5% tells more than 81%.
const precise = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const pct = (part: number, total: number) => (total === 0 ? "—" : percent.format(part / total));

function Metric({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="rounded-xl bg-muted/60 p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {note ? <p className="mt-0.5 text-xs text-muted-foreground">{note}</p> : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col rounded-xl p-4 ring-1 ring-border">
      <h2 id={id} className="mb-4 text-sm font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

// "sent" and the offer steps use the badge backgrounds (var(--status-*-bg)); the rest are muted status hues.
const FUNNEL_COLORS: Record<string, string> = {
  ...COLUMN_BG,
};
type BarRow = {
  key: string;
  label: string;
  count: number;
  share: number;
  color: string;
  /** What the row means in words, shown on hover. */
  hint?: React.ReactNode;
};

function BarRows({ rows }: { rows: BarRow[] }) {
  return (
    // The label column is just wide enough for "Negotiation": a fixed width keeps both groups
    // (the funnel and the outcomes) aligned, and the gap to the bar stays small.
    <ol className="grid grid-cols-[6rem_minmax(0,1fr)_5.5rem] items-center gap-x-3 gap-y-3 text-sm">
      {rows.map((row) => {
        const line = (
          <li key={row.key} className="col-span-3 grid cursor-default grid-cols-subgrid items-center">
            <span className="truncate text-muted-foreground">{row.label}</span>
            <span aria-hidden className="h-6 overflow-hidden rounded-md bg-muted">
              <span
                className={`block h-full rounded-md ${row.color}`}
                style={{ width: `${Math.max(row.share * 100, row.count ? 2 : 0)}%` }}
              />
            </span>
            <span className="text-right tabular-nums">
              {row.count} <span className="text-muted-foreground">· {percent.format(row.share)}</span>
            </span>
          </li>
        );
        if (!row.hint) return line;
        return (
          <Tooltip key={row.key}>
            <TooltipTrigger asChild>{line}</TooltipTrigger>
            <TooltipContent className="max-w-64 flex-col gap-1 px-3 py-2 text-xs">{row.hint}</TooltipContent>
          </Tooltip>
        );
      })}
    </ol>
  );
}

/** The most frequent reasons, at most three: a tooltip is not a report. */
function ReasonList({ rows, empty }: { rows: { reason: string; count: number }[]; empty: string }) {
  if (rows.length === 0) return <p className="text-background/70">{empty}</p>;
  return (
    <ul className="text-background/70">
      {rows.map((row) => (
        <li key={row.reason}>
          • {row.reason} ({row.count})
        </li>
      ))}
    </ul>
  );
}

/** A day shifted by whole days, as YYYY-MM-DD: the end of a week for the tooltip. */
function addDays(day: string, days: number) {
  const date = new Date(`${day}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString("sv-SE");
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** The sentence of a step-to-step tooltip: "33 of 41 applied jobs reached a real conversation". */
function conversionText(key: string, moved: number, previous: number) {
  switch (key) {
    case "applied":
      return `${moved} of ${previous} saved vacancies became applications`;
    case "in_process":
      return `${moved} of ${previous} applied jobs reached a real conversation`;
    case "offer":
      return `${moved} of ${previous} interviewed jobs resulted in an offer`;
    case "accepted":
      return `${moved} of ${previous} received offers were accepted`;
    default:
      return `${moved} of ${previous} moved on`;
  }
}

/** What a funnel row means, in words rather than in a label. */
function funnelHint(step: { key: string; count: number }) {
  const count = step.count;
  switch (step.key) {
    case "wishlist":
      return `${plural(count, "vacancy", "vacancies")} in your backlog`;
    case "applied":
      return `${plural(count, "application", "applications")} sent`;
    case "in_process":
      return `${plural(count, "application", "applications")} reached a real conversation`;
    case "offer":
      return `${plural(count, "offer", "offers")} received`;
    case "accepted":
      return `${plural(count, "offer", "offers")} accepted — the finish line`;
    default:
      return `${count} applications`;
  }
}

/** Progress through the board, then how the applications ended. */
function Funnel({ stats }: { stats: Statistics }) {
  // Step-to-step conversion is what the funnel is really asked: "where does it leak?".
  const stepFromPrevious = (key: string) => {
    const pair = stats.conversions[key];
    if (!pair) return null;
    const share = stepConversion(pair.moved, pair.previous);
    if (share === null) return null;
    return `${conversionText(key, pair.moved, pair.previous)} · ${precise.format(share)}`;
  };
  // The Closed column only: Accepted lives in the funnel above, so it is not part of this base.
  const closed = stats.outcomes.rejected + stats.outcomes.withdrawn;
  const ofClosed = (count: number) => (closed === 0 ? 0 : count / closed);
  return (
    <div className="grid gap-4">
      <BarRows
        rows={stats.funnel.map((step) => {
          const conversion = stepFromPrevious(step.key);
          return {
            ...step,
            color: FUNNEL_COLORS[step.key],
            hint: (
              <>
                <p className="font-medium">{funnelHint(step)}</p>
                {conversion ? <p className="text-background/70">{conversion}</p> : null}
              </>
            ),
          };
        })}
      />
      <div className="border-t pt-4">
        {/* A share of finished processes, not of every application: the bars answer "how did it end". */}
        <p className="mb-3 text-xs text-muted-foreground">
          {closed === 0 ? "No closed processes yet" : `Of ${closed} closed processes`}
        </p>
        <BarRows
          rows={[
            {
              key: "rejected",
              label: "Rejected",
              count: stats.outcomes.rejected,
              share: ofClosed(stats.outcomes.rejected),
              color: COLUMN_BG.closed,
              hint: (
                <>
                  <p className="font-medium">Refused by the company: {stats.outcomes.rejected}</p>
                  <ReasonList rows={stats.reasons.rejected} empty="No reasons written down" />
                </>
              ),
            },
            {
              key: "withdrawn",
              label: "Withdrawn",
              count: stats.outcomes.withdrawn,
              share: ofClosed(stats.outcomes.withdrawn),
              color: COLUMN_BG.wishlist,
              hint: (
                <>
                  <p className="font-medium">You pulled out: {stats.outcomes.withdrawn}</p>
                  <ReasonList rows={stats.reasons.withdrawn} empty="No reasons written down" />
                </>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}

function Weeks({ stats }: { stats: Statistics }) {
  const max = Math.max(1, ...stats.weeks.map((week) => week.count));
  const thisWeek = weekStart(new Date().toLocaleDateString("sv-SE"));
  const total = stats.weeks.reduce((sum, week) => sum + week.count, 0);
  // Up to five grid lines: one per value while the scale is small, otherwise an even step.
  const step = Math.max(1, Math.ceil(max / 4));
  const ticks: number[] = [];
  for (let value = 0; value <= max; value += step) ticks.push(value);
  if (ticks[ticks.length - 1] !== max) ticks.push(max);

  return (
    <div className="flex flex-1 flex-col">
      {/* Room above the plot: the top axis label must not sit on the section title. */}
      <div className="flex min-h-44 flex-1 gap-2 pt-4">
        {/* Y axis: the numbers sit on the same levels as the grid lines. */}
        <div aria-hidden className="relative w-4 shrink-0 text-[11px] leading-none tabular-nums">
          {ticks.map((value) => (
            <span
              key={value}
              className={cn(
                "absolute right-0 -translate-y-1/2 tabular-nums",
                value === 0 ? "text-muted-foreground/70" : "text-muted-foreground",
              )}
              style={{ bottom: `${(value / max) * 100}%` }}
            >
              {value}
            </span>
          ))}
        </div>
        <div className="relative flex-1">
          {/* The grid gives the bars something to stand on: dashed and quiet, behind the bars. */}
          {ticks
            .filter((value) => value > 0)
            .map((value) => (
              <span
                key={value}
                aria-hidden
                className="absolute inset-x-0 border-t border-dashed border-border/70"
                style={{ bottom: `${(value / max) * 100}%` }}
              />
            ))}
          <span aria-hidden className="absolute inset-x-0 bottom-0 border-t border-border" />
          <ol className="relative flex h-full items-end gap-2" aria-label="Applications per week">
            {stats.weeks.map((week) => {
              // "Oct 12, 2026" → "Oct 12"
              const label = formatDate(week.weekStart)?.replace(/,? \d{4}$/, "");
              const current = week.weekStart === thisWeek;
              return (
                <li
                  key={week.weekStart}
                  className={cn(
                    "flex h-full min-w-0 flex-1 flex-col",
                    // The running week is dimmed as a whole: its own layers keep their real colors.
                    current && "opacity-55",
                  )}
                  aria-label={`Week of ${label}: ${countApplications(week.count)}`}
                >
                  <div className="relative flex w-full flex-1 flex-col items-center justify-end">
                    <span
                      aria-hidden
                      // A fixed dark tone: the number must read over any layer below it.
                      className="absolute inset-x-0 text-center text-xs leading-none font-medium text-foreground tabular-nums"
                      // Six pixels clear of the rounded top: the number never sits on the fill.
                      style={{ bottom: `calc(${(week.count / max) * 100}% + 6px)` }}
                    >
                      {week.count || ""}
                    </span>
                    {/* The tooltip hangs over the bar itself, not over the empty space above it. */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          aria-hidden
                          className={cn(
                            "relative w-full max-w-10 shrink-0 overflow-hidden rounded-t-md",
                            // Base: a quiet grey — applications alone are not an achievement.
                            "bg-column-wishlist",
                          )}
                          style={{
                            height: `${(week.count / max) * 100}%`,
                            minHeight: week.count ? 4 : 1,
                          }}
                        >
                          {/* Filled: the part of that week's applications that got a conversation. */}
                          <span
                            className="absolute inset-x-0 bottom-0 bg-zone-interview"
                            style={{
                              height: week.count ? `${(week.interviews / week.count) * 100}%` : 0,
                            }}
                          />
                        </span>
                      </TooltipTrigger>
                      {/* Clears the number above the bar: 6 px gap plus the 12 px line. */}
                      <TooltipContent sideOffset={22} className="flex-col gap-1 px-3 py-2 text-xs">
                        <p className="font-medium">
                          Week: {label} – {formatDate(addDays(week.weekStart, 6))?.replace(/,? \d{4}$/, "")}
                          {current ? " · this week" : ""}
                        </p>
                        <p className="text-background/70">{countApplications(week.count)} sent</p>
                        <p className="text-background/70">
                          {week.interviews} reached In process
                          {week.count > 0
                            ? ` · ${precise.format(week.interviews / week.count)} conversion`
                            : ""}
                        </p>
                        {week.screening > 0 ? (
                          <p className="text-background/70">{week.screening} reached screening</p>
                        ) : null}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <span
                    aria-hidden
                    className={cn(
                      "pt-1 pb-2 text-center text-xs tabular-nums",
                      current ? "font-medium text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {label}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
      {/* The window is eight weeks: the rest is stated instead of silently missing. */}
      {stats.olderThanWindow > 0 ? (
        <p className="mt-1 pl-6 text-xs text-muted-foreground">
          {countApplications(stats.olderThanWindow)} older than this window, {total} shown
        </p>
      ) : null}
    </div>
  );
}

function Sources({ stats, onOpenSource }: { stats: Statistics; onOpenSource: (source: string) => void }) {
  // Sorted by volume by default; a header click sorts by that column instead.
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "total", desc: true });
  const rows = [...stats.sources].sort((a, b) => {
    if (sort.key === "source") {
      return (sort.desc ? -1 : 1) * a.source.localeCompare(b.source, "en");
    }
    const left = sort.key === "success" ? rateOf(a) : a[sort.key];
    const right = sort.key === "success" ? rateOf(b) : b[sort.key];
    // A tie on the chosen column falls to the success rate, then to the name: the most useful
    // source stays on top instead of an alphabetical accident.
    return (sort.desc ? -1 : 1) * (left - right) || rateOf(b) - rateOf(a) || a.source.localeCompare(b.source);
  });
  const header = (key: SortKey, label: string, title?: string) => (
    <th className="py-2 pr-3 text-right font-medium whitespace-nowrap">
      <button
        type="button"
        title={title}
        onClick={() => setSort((current) => ({ key, desc: current.key === key ? !current.desc : true }))}
        className={cn(
          // The arrow sits before the label: after it, the arrow would push the text away from the
          // right edge and the header would no longer line up with the numbers below.
          "flex w-full items-center justify-end gap-1 rounded py-0.5 whitespace-nowrap transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
          sort.key === key && "text-foreground",
        )}
        aria-label={`Sort by ${label}`}
      >
        {sort.key === key ? (
          <span aria-hidden className="text-[10px]">
            {sort.desc ? "▼" : "▲"}
          </span>
        ) : null}
        {label}
      </button>
    </th>
  );
  return (
    <div className="overflow-x-auto">
      {/* The table fills the card, but the numeric columns keep fixed shares: the numbers stay
          in a tight block on the right, right under their labels. */}
      <table className="w-full min-w-[560px] text-sm">
        <thead className="text-left text-xs text-muted-foreground">
          <tr className="border-b">
            <th className="py-2 pr-3 text-left font-medium whitespace-nowrap">
              <button
                type="button"
                onClick={() =>
                  setSort((current) => ({
                    key: "source",
                    desc: current.key === "source" ? !current.desc : false,
                  }))
                }
                className={cn(
                  "inline-flex items-center gap-1 rounded py-0.5 transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  sort.key === "source" && "text-foreground",
                )}
                aria-label="Sort by source"
              >
                Source
                {sort.key === "source" ? (
                  <span aria-hidden className="text-[10px]">
                    {sort.desc ? "▼" : "▲"}
                  </span>
                ) : null}
              </button>
            </th>
            {header("total", "Applications")}
            {header("screenings", "Screening")}
            {header("interviews", "Interview")}
            {header("technical", "Technical & tests")}
            {header("offers", "Offers")}
            {header("success", "Success rate", "Offers ÷ applications")}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.source}
              className="cursor-pointer border-b transition-colors last:border-0 hover:bg-muted/40"
              onClick={() => onOpenSource(row.source)}
              // A row is a button: the keyboard opens the same panel.
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onOpenSource(row.source);
                }
              }}
            >
              <td className="py-2 pr-3">{row.source}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{row.total}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{row.screenings}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{row.interviews}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{row.technical}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{row.offers}</td>
              {/* Same right padding as the header: the percent sits exactly under "Success rate". */}
              <td className="py-2 pr-3 text-right tabular-nums">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-default">{pct(row.offers, row.total)}</span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-64 px-3 py-2 text-xs">{successHint(row)}</TooltipContent>
                </Tooltip>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type SortKey = "source" | "total" | "screenings" | "interviews" | "technical" | "offers" | "success";

/**
 * What a source really brought. Zero offers is not a dead channel: say how far it did get.
 */
function successHint(row: { offers: number; interviews: number; total: number }) {
  if (row.total === 0) return "No applications from this source yet";
  if (row.offers > 0) return `${pct(row.offers, row.total)} of applications ended in an offer`;
  if (row.interviews > 0) {
    return `No offers yet, but ${pct(row.interviews, row.total)} of applications reached an interview`;
  }
  return "No offers and no interviews yet — early days for this source";
}

/** Offers per application: what a source really brought. */
const rateOf = (row: { offers: number; total: number }) => (row.total === 0 ? 0 : row.offers / row.total);

export function StatisticsView() {
  const { data: stats, error } = useRepositoryQuery("statistics", async (repository) =>
    computeStatistics(await repository.listForStatistics(), new Date().toLocaleDateString("sv-SE")),
  );
  // Which source is open, and the moment it was opened: the clock is read in the handler, never
  // during render, so prerendering sees nothing time-dependent.
  const [drawer, setDrawer] = useState<{ source: string; now: number } | null>(null);
  const openSource = (value: string) => setDrawer({ source: value, now: Date.now() });

  if (error) {
    return (
      <p role="alert" className="px-6 py-8 text-sm text-destructive">
        Couldn’t calculate statistics. Reload the page.
      </p>
    );
  }
  if (!stats) return <div aria-hidden className="h-96" />;

  if (stats.total === 0) {
    return (
      <div className="flex flex-col items-center px-6 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-xl bg-muted" aria-hidden>
          <ChartColumn className="size-6 text-muted-foreground" />
        </span>
        <h2 className="mt-4 text-base font-semibold">Nothing to count yet</h2>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Once you add applications, this page shows where they stand: how far each one got, how many you sent
          per week, and which sources bring responses.
        </p>
      </div>
    );
  }

  // The funnel is keyed by board column now; a missing key must not crash the page.
  const step = (key: string, label: string) =>
    stats.funnel.find((item) => item.key === key) ?? { key, label, count: 0, share: 0 };
  const inProcess = step("in_process", "In process");
  const offered = step("offer", "Offers");
  return (
    <div className="grid gap-6 px-6 py-6">
      <div className="grid grid-cols-2 gap-3 desktop:grid-cols-4">
        <Metric
          label="Applications"
          value={stats.total}
          note={
            [
              stats.archived ? `${stats.archived} in the archive` : null,
              stats.deleted ? `${stats.deleted} deleted` : null,
            ]
              .filter(Boolean)
              .join(", ") || undefined
          }
        />
        <Metric
          label="In process"
          value={stats.inProgress}
          note={
            typeof stats.avgDaysInProcess === "number"
              ? `avg ${stats.avgDaysInProcess} days in the current step`
              : undefined
          }
        />
        <Metric
          label="Reached in process"
          value={percent.format(inProcess.share)}
          note={`${inProcess.count} of ${stats.total}`}
        />
        <Metric label="Offers" value={offered.count} />
      </div>
      <div className="grid gap-6 desktop:grid-cols-2">
        <Section title="Funnel">
          <Funnel stats={stats} />
        </Section>
        <Section title="Applications per week">
          <Weeks stats={stats} />
        </Section>
      </div>
      <Section title="Sources">
        <Sources stats={stats} onOpenSource={openSource} />
      </Section>
      <SourceDrawer
        source={drawer?.source ?? null}
        entries={stats.entries}
        now={drawer?.now ?? 0}
        onClose={() => setDrawer(null)}
      />
    </div>
  );
}
