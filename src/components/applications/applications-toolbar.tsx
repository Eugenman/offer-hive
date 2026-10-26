import { Download, ListFilter, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ApplicationsToolbar() {
  return (
    <div className="flex flex-wrap items-center gap-2 px-6 py-4">
      <div className="relative w-full max-w-72">
        <Search
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          placeholder="Компания или должность"
          aria-label="Поиск по откликам"
          className="pl-8"
        />
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Button variant="outline">
          <ListFilter aria-hidden />
          Фильтр
        </Button>
        <Button variant="outline">
          <Download aria-hidden />
          Экспорт
        </Button>
        <Button>
          <Plus aria-hidden />
          Добавить отклик
        </Button>
      </div>
    </div>
  );
}
