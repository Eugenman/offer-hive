"use client";

import { useId } from "react";
import Link from "next/link";
import { ChartColumn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { countApplications } from "@/lib/plural";
import { useRepositoryQuery } from "@/lib/repository/provider";
import { computeStatistics, type Statistics } from "@/lib/stats";

const percent = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 0 });
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
    <section aria-labelledby={id} className="rounded-xl p-4 ring-1 ring-border">
      <h2 id={id} className="mb-4 text-sm font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

// "sent" and the offer steps use the badge backgrounds (var(--status-*-bg)); the rest are muted status hues.
const FUNNEL_COLORS: Record<string, string> = {
  sent: "bg-status-sent-bg",
  screening: "bg-status-screening/55",
  interview: "bg-status-interview/55",
  technical: "bg-status-technical/55",
  test_task: "bg-status-test/55",
  offer: "bg-status-offer-bg",
  offer_discussion: "bg-status-discussion-bg",
};

type BarRow = { key: string; label: string; count: number; share: number; color: string };

function BarRows({ rows }: { rows: BarRow[] }) {
  return (
    <ol className="grid gap-3">
      {rows.map((row) => (
        <li
          key={row.key}
          className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)_auto] items-center gap-3 text-sm"
        >
          <span className="text-muted-foreground">{row.label}</span>
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
      ))}
    </ol>
  );
}

/** Progress through hiring, then how many ended in a refusal (badge-background colors). */
function Funnel({ stats }: { stats: Statistics }) {
  const share = (count: number) => (stats.total === 0 ? 0 : count / stats.total);
  return (
    <div className="grid gap-4">
      <BarRows rows={stats.funnel.map((step) => ({ ...step, color: FUNNEL_COLORS[step.key] }))} />
      <div className="border-t pt-4">
        <BarRows
          rows={[
            {
              key: "rejected",
              label: "Rejected",
              count: stats.outcomes.rejected,
              share: share(stats.outcomes.rejected),
              color: "bg-status-rejected-bg",
            },
            {
              key: "withdrawn",
              label: "Withdrawn",
              count: stats.outcomes.withdrawn,
              share: share(stats.outcomes.withdrawn),
              color: "bg-status-withdrawn-bg",
            },
          ]}
        />
      </div>
    </div>
  );
}

function Weeks({ stats }: { stats: Statistics }) {
  const max = Math.max(1, ...stats.weeks.map((week) => week.count));
  return (
    <ol className="flex h-44 items-end gap-2" aria-label="Applications per week">
      {stats.weeks.map((week) => {
        // "Oct 12, 2026" → "Oct 12"
        const label = formatDate(week.weekStart)?.replace(/,? \d{4}$/, "");
        const short = label;
        return (
          <li
            key={week.weekStart}
            className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
            aria-label={`Week of ${label}: ${countApplications(week.count)}`}
          >
            <span aria-hidden className="text-xs tabular-nums">
              {week.count || ""}
            </span>
            <span
              aria-hidden
              className="w-full max-w-10 rounded-t-md bg-status-sent/55"
              style={{ height: `${(week.count / max) * 100}%`, minHeight: week.count ? 4 : 1 }}
            />
            <span aria-hidden className="text-xs text-muted-foreground tabular-nums">
              {short}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Sources({ stats }: { stats: Statistics }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-sm">
        <thead className="text-left text-xs text-muted-foreground">
          <tr className="border-b">
            <th className="py-2 pr-3 font-medium">Source</th>
            <th className="py-2 pr-3 text-right font-medium">Applications</th>
            <th className="py-2 pr-3 text-right font-medium">Screening</th>
            <th className="py-2 pr-3 text-right font-medium">Interview</th>
            <th className="py-2 pr-3 text-right font-medium">Offers</th>
            <th className="py-2 text-right font-medium">Reached screening</th>
          </tr>
        </thead>
        <tbody>
          {stats.sources.map((row) => (
            <tr key={row.source} className="border-b last:border-0">
              <td className="py-2 pr-3">{row.source}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{row.total}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{row.screenings}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{row.interviews}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{row.offers}</td>
              <td className="py-2 text-right tabular-nums">{pct(row.screenings, row.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StatisticsView() {
  const { data: stats, error } = useRepositoryQuery("statistics", async (repository) =>
    computeStatistics(await repository.listDetailed(), new Date().toLocaleDateString("sv-SE")),
  );

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
        <Button asChild className="mt-5">
          <Link href="/dashboard?add=manual">Add application</Link>
        </Button>
      </div>
    );
  }

  const step = (key: string) => stats.funnel.find((item) => item.key === key)!;
  const screened = step("screening");
  const offered = step("offer");
  return (
    <div className="grid gap-6 px-6 py-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Applications" value={stats.total} />
        <Metric label="In progress" value={stats.inProgress} note="Before an offer" />
        <Metric
          label="Reached screening"
          value={percent.format(screened.share)}
          note={`${screened.count} of ${stats.total}`}
        />
        <Metric label="Offers" value={offered.count} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Funnel">
          <Funnel stats={stats} />
        </Section>
        <Section title="Applications per week">
          <Weeks stats={stats} />
        </Section>
      </div>
      <Section title="Sources">
        <Sources stats={stats} />
      </Section>
    </div>
  );
}
