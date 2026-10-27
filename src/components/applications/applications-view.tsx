"use client";

import { useRepositoryQuery } from "@/lib/repository/provider";
import type { ApplicationsQuery } from "@/lib/repository/types";
import { ApplicationsTable } from "./applications-table";
import { TableFooter } from "./table-footer";

const ROW_PLACEHOLDERS = 6;

function TableSkeleton() {
  return (
    <div aria-hidden className="px-6">
      {Array.from({ length: ROW_PLACEHOLDERS }, (_, index) => (
        <div key={index} className="flex h-15 items-center gap-4 border-b">
          <div className="size-8 rounded-lg bg-muted" />
          <div className="h-3 w-48 rounded bg-muted" />
          <div className="ml-auto h-3 w-24 rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

export function ApplicationsView() {
  const query: ApplicationsQuery = { page: 1, pageSize: 25 };
  const { data, error } = useRepositoryQuery(JSON.stringify(query), (repository) =>
    repository.list(query),
  );

  if (error) {
    return (
      <p role="alert" className="px-6 py-8 text-sm text-destructive">
        Не удалось загрузить отклики. Обновите страницу.
      </p>
    );
  }

  if (!data) {
    return (
      <>
        <span className="sr-only" role="status">
          Загружаем отклики
        </span>
        <TableSkeleton />
      </>
    );
  }

  return (
    <>
      <ApplicationsTable applications={data.items} />
      <TableFooter total={data.total} pageSize={data.pageSize} />
    </>
  );
}
