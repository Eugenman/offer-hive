"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { Download, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useApplicationActions } from "@/components/applications/use-application-actions";
import { THEME_OPTIONS, useTheme } from "@/hooks/use-theme";
import { APPLICATION_WORDS, pluralRu } from "@/lib/plural";
import { useRepository, useRepositoryQuery } from "@/lib/repository/provider";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="grid gap-4 border-b pb-8 last:border-0">
      <h2 id={id} className="text-base font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Setting({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="max-w-md">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}

function ThemePicker() {
  const [theme, setTheme] = useTheme();
  return (
    <div role="radiogroup" aria-label="Тема оформления" className="grid grid-cols-3 gap-3 sm:max-w-md">
      {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(value)}
            className={cn(
              "flex flex-col items-center gap-2 rounded-xl p-4 text-sm ring-1 ring-border transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              active && "bg-muted font-medium ring-2 ring-primary/70",
            )}
          >
            <Icon className="size-5" aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function SettingsView() {
  const repository = useRepository();
  const actions = useApplicationActions();
  const [confirmClear, setConfirmClear] = useState(false);
  const { data: total = 0 } = useRepositoryQuery("total", async (repo) => (await repo.list({ pageSize: 1 })).total);

  async function clearAll() {
    try {
      await repository.clear();
      toast.success("Все данные удалены");
    } catch {
      toast.error("Не удалось удалить данные");
    }
  }

  return (
    <div className="grid max-w-3xl gap-8 px-6 py-6">
      <Section title="Внешний вид">
        <ThemePicker />
      </Section>

      <Section title="Данные">
        <Setting title="Экспорт" description="Все отклики одной таблицей — откроется в Excel, Numbers и LibreOffice.">
          <Button variant="outline" disabled={total === 0} onClick={() => void actions.exportCsv({ query: {} })}>
            <Download aria-hidden />
            Скачать таблицу
          </Button>
        </Setting>
        <Setting title="Импорт" description="Загрузите таблицу с откликами, которую вели раньше.">
          <Button variant="outline" asChild>
            <Link href="/dashboard?add=import">
              <Upload aria-hidden />
              Импорт таблицы
            </Link>
          </Button>
        </Setting>
        <Setting
          title="Удалить все данные"
          description={`Отклики, этапы, заметки и журнал статусов: сейчас ${total} ${pluralRu(total, APPLICATION_WORDS)}.`}
        >
          <Button variant="destructive" disabled={total === 0} onClick={() => setConfirmClear(true)}>
            <Trash2 aria-hidden />
            Удалить всё
          </Button>
        </Setting>
      </Section>

      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить все данные?</AlertDialogTitle>
            <AlertDialogDescription>
              Будут удалены {total} {pluralRu(total, APPLICATION_WORDS)} со всеми этапами и заметками. Это нельзя
              отменить — сначала скачайте таблицу, если данные могут понадобиться.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void clearAll()}>
              Удалить всё
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
