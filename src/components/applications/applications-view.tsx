"use client";

import { useEffect, useState } from "react";
import type { ApplicationStatus, ApplicationSummary } from "@/lib/domain";
import { useRepositoryQuery } from "@/lib/repository/provider";
import { ApplicationsTable, type TableSort } from "./applications-table";
import { ApplicationsToolbar } from "./applications-toolbar";
import { BulkActionsBar } from "./bulk-actions-bar";
import { NoApplications, NoResults } from "./empty-states";
import { TableFooter } from "./table-footer";
import { useApplicationActions } from "./use-application-actions";
import { useApplicationsUrlState } from "./use-applications-url-state";

const ROW_PLACEHOLDERS = 6;

export function TableSkeleton() {
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
  const url = useApplicationsUrlState();
  const actions = useApplicationActions();
  const queryKey = JSON.stringify(url.query);

  const { data, error } = useRepositoryQuery(queryKey, (repository) => repository.list(url.query));
  const { data: totalAll } = useRepositoryQuery(
    "total",
    async (repository) => (await repository.list({ pageSize: 1 })).total,
  );
  const { data: sources = [] } = useRepositoryQuery("sources", (repository) => repository.listSources());

  // Selection belongs to the current view: changing search, filter, sort or page clears it.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectionKey, setSelectionKey] = useState(queryKey);
  if (selectionKey !== queryKey) {
    setSelectionKey(queryKey);
    setSelected(new Set());
  }

  // The repository clamps the page (e.g. after deleting the last row on the last page).
  const { setPage } = url;
  const requestedPage = url.state.page;
  useEffect(() => {
    if (data && data.page !== requestedPage) setPage(data.page);
  }, [data, requestedPage, setPage]);

  const sort: TableSort = url.query.sort ?? null;

  function deleteIds(ids: string[], name?: string) {
    setSelected((current) => new Set([...current].filter((id) => !ids.includes(id))));
    void actions.remove(ids, name);
  }

  let content: React.ReactNode;
  if (error) {
    content = (
      <p role="alert" className="px-6 py-8 text-sm text-destructive">
        Не удалось загрузить отклики. Обновите страницу.
      </p>
    );
  } else if (!data || totalAll === undefined) {
    content = (
      <>
        <span className="sr-only" role="status">
          Загружаем отклики
        </span>
        <TableSkeleton />
      </>
    );
  } else if (totalAll === 0) {
    content = <NoApplications />;
  } else if (data.total === 0) {
    content = <NoResults onReset={url.resetFilters} />;
  } else {
    content = (
      <>
        <ApplicationsTable
          applications={data.items}
          sort={sort}
          onSort={(next) => url.setSort(next?.field ?? null, next?.direction ?? "asc")}
          selected={selected}
          onSelectionChange={setSelected}
          onChangeStatus={(id, status) => void actions.changeStatus([id], status)}
          onDelete={(app: ApplicationSummary) => deleteIds([app.id], app.company)}
        />
        <TableFooter
          page={data.page}
          pageSize={url.state.size}
          total={data.total}
          onPageChange={url.setPage}
          onPageSizeChange={url.setPageSize}
        />
      </>
    );
  }

  const selectedIds = [...selected];

  return (
    <>
      {totalAll === 0 ? null : (
        <ApplicationsToolbar
          search={url.state.q}
          statuses={url.state.status}
          sources={url.state.source}
          availableSources={sources}
          onSearchChange={url.setSearch}
          onStatusesChange={url.setStatuses}
          onSourcesChange={url.setSources}
          onResetFilters={url.resetFilters}
          onExport={() => void actions.exportCsv({ query: url.query })}
          exportDisabled={!data || data.total === 0}
        />
      )}
      {content}
      {selectedIds.length > 0 ? (
        <>
          {/* Room for the floating bar so it never covers the last row or the pager. */}
          <div aria-hidden className="h-20" />
          <BulkActionsBar
            count={selectedIds.length}
            onChangeStatus={(status: ApplicationStatus) => void actions.changeStatus(selectedIds, status)}
            onExport={() => void actions.exportCsv({ ids: selectedIds })}
            onDelete={() => deleteIds(selectedIds)}
            onClear={() => setSelected(new Set())}
          />
        </>
      ) : null}
    </>
  );
}
