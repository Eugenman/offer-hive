import { BriefcaseBusiness, SearchX, Upload, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

/** No applications at all — the first thing a new user sees. */
export function NoApplications({ onAdd, onImport }: { onAdd: () => void; onImport: () => void }) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl bg-muted" aria-hidden>
        <BriefcaseBusiness className="size-6 text-muted-foreground" />
      </span>
      <h2 className="mt-4 text-base font-semibold">Начните отслеживать отклики</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Добавьте первый отклик вручную или загрузите таблицу, которую вели раньше в Excel, Google Sheets
        или Numbers.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Button onClick={onAdd}>
          <Plus aria-hidden />
          Добавить отклик
        </Button>
        <Button variant="outline" onClick={onImport}>
          <Upload aria-hidden />
          Импорт таблицы
        </Button>
      </div>
    </div>
  );
}

/** Applications exist, but the search or filter hides all of them. */
export function NoResults({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl bg-muted" aria-hidden>
        <SearchX className="size-6 text-muted-foreground" />
      </span>
      <h2 className="mt-4 text-base font-semibold">Ничего не найдено</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Попробуйте изменить запрос или сбросить фильтр.
      </p>
      <Button variant="outline" className="mt-5" onClick={onReset}>
        Сбросить поиск и фильтр
      </Button>
    </div>
  );
}
