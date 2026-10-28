"use client";

import { useId } from "react";
import Link from "next/link";
import { ChartColumn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { APPLICATION_WORDS, pluralRu } from "@/lib/plural";
import { useRepositoryQuery } from "@/lib/repository/provider";
import { computeStatistics, type Statistics } from "@/lib/stats";

const percent = new Intl.NumberFormat("ru-RU", { style: "percent", maximumFractionDigits: 0 });
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

function Funnel({ stats }: { stats: Statistics }) {
  return (
    <ol className="grid gap-3">
      {stats.funnel.map((step) => (
        <li key={step.key} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto] items-center gap-3 text-sm">
          <span className="text-muted-foreground">{step.label}</span>
          <span aria-hidden className="h-6 overflow-hidden rounded-md bg-muted">
            <span
              className="block h-full rounded-md bg-primary/80"
              style={{ width: `${Math.max(step.share * 100, step.count ? 2 : 0)}%` }}
            />
          </span>
          <span className="text-right tabular-nums">
            {step.count} <span className="text-muted-foreground">· {percent.format(step.share)}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

function Weeks({ stats }: { stats: Statistics }) {
  const max = Math.max(1, ...stats.weeks.map((week) => week.count));
  return (
    <ol className="flex h-44 items-end gap-2" aria-label="Отклики по неделям">
      {stats.weeks.map((week) => {
        const label = formatDate(week.weekStart)?.replace(/ \d{4}$/, "");
        const short = `${week.weekStart.slice(8, 10)}.${week.weekStart.slice(5, 7)}`;
        return (
          <li
            key={week.weekStart}
            className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
            aria-label={`Неделя с ${label}: ${week.count} ${pluralRu(week.count, APPLICATION_WORDS)}`}
          >
            <span aria-hidden className="text-xs tabular-nums">
              {week.count || ""}
            </span>
            <span
              aria-hidden
              className="w-full max-w-10 rounded-t-md bg-primary/80"
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
            <th className="py-2 pr-3 font-medium">Источник</th>
            <th className="py-2 pr-3 text-right font-medium">Откликов</th>
            <th className="py-2 pr-3 text-right font-medium">Ответили</th>
            <th className="py-2 pr-3 text-right font-medium">Интервью</th>
            <th className="py-2 pr-3 text-right font-medium">Офферы</th>
            <th className="py-2 text-right font-medium">Доля ответов</th>
          </tr>
        </thead>
        <tbody>
          {stats.sources.map((row) => (
            <tr key={row.source} className="border-b last:border-0">
              <td className="py-2 pr-3">{row.source}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{row.total}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{row.responses}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{row.interviews}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{row.offers}</td>
              <td className="py-2 text-right tabular-nums">{pct(row.responses, row.total)}</td>
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
        Не удалось посчитать статистику. Обновите страницу.
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
        <h2 className="mt-4 text-base font-semibold">Пока нечего считать</h2>
        <Button asChild className="mt-5">
          <Link href="/dashboard?add=manual">Добавить отклик</Link>
        </Button>
      </div>
    );
  }

  const [, responded, , offered] = stats.funnel;
  return (
    <div className="grid gap-6 px-6 py-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Всего откликов" value={stats.total} />
        <Metric label="В работе" value={stats.inProgress} note="Отправлен, тестовое, интервью" />
        <Metric label="Получили ответ" value={percent.format(responded.share)} note={`${responded.count} из ${stats.total}`} />
        <Metric label="Офферы" value={offered.count} note={`Отказов: ${stats.outcomes.rejected} · отказался сам: ${stats.outcomes.withdrawn}`} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Воронка">
          <Funnel stats={stats} />
        </Section>
        <Section title="Отклики по неделям">
          <Weeks stats={stats} />
        </Section>
      </div>
      <Section title="Источники">
        <Sources stats={stats} />
      </Section>
    </div>
  );
}
