"use client";

import { useEffect, useRef, useState } from "react";
import type { ApplicationDetails, ApplicationStatus, ApplicationSummary } from "@/lib/domain";
import { useRepositoryQuery } from "@/lib/repository/provider";
import type { ApplicationsPage, ApplicationsRepository } from "@/lib/repository/types";
import { AddApplicationDialog } from "./add/add-application-dialog";
import { useAddDialog } from "./add/use-add-dialog";
import { rememberListPosition, takeReturnFocus } from "./detail/return-to-list";
import { ApplicationsTable, type TableSort } from "./applications-table";
import { ApplicationsToolbar } from "./applications-toolbar";
import { BulkActionsBar } from "./bulk-actions-bar";
import { NoApplications, NoResults } from "./empty-states";
import { TableFooter } from "./table-footer";
import { useApplicationActions } from "./use-application-actions";
import { type ViewMode, useApplicationsUrlState } from "./use-applications-url-state";
import { rememberView, useViewMode } from "./use-view-mode";
import { ApplicationsTimeline } from "./views/applications-timeline";
import { KanbanBoard } from "./views/kanban-board";

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

type ViewData =
  | { kind: "page"; page: ApplicationsPage }
  | { kind: "summaries"; items: ApplicationSummary[] }
  | { kind: "details"; items: ApplicationDetails[]; now: number };

const ALL = Number.MAX_SAFE_INTEGER;

export function ApplicationsView() {
  const url = useApplicationsUrlState();
  const view = useViewMode(url.state.view, url.restoreView);
  const actions = useApplicationActions();
  const addDialog = useAddDialog();

  // Table pages and sorts; the other views show every matching application.
  const filters = { search: url.query.search, statuses: url.query.statuses, sources: url.query.sources };
  const queryKey = JSON.stringify({ view, query: view === "table" ? url.query : filters });

  const { data, error } = useRepositoryQuery<ViewData>(queryKey, async (repository: ApplicationsRepository) => {
    if (view === "table") return { kind: "page", page: await repository.list(url.query) };
    if (view === "timeline") {
      return { kind: "details", items: await repository.listDetailed(filters), now: Date.now() };
    }
    return { kind: "summaries", items: (await repository.list({ ...filters, pageSize: ALL })).items };
  });
  const { data: totalAll } = useRepositoryQuery(
    "total",
    async (repository) => (await repository.list({ pageSize: 1 })).total,
  );
  const { data: sources = [] } = useRepositoryQuery("sources", (repository) => repository.listSources());

  // Selection belongs to the current table view: changing view, search, filter, sort or page clears it.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectionKey, setSelectionKey] = useState(queryKey);
  if (selectionKey !== queryKey) {
    setSelectionKey(queryKey);
    setSelected(new Set());
  }

  // The repository clamps the page (e.g. after deleting the last row on the last page).
  const { setPage } = url;
  const requestedPage = url.state.page;
  const clampedPage = data?.kind === "page" ? data.page.page : null;
  useEffect(() => {
    if (clampedPage !== null && clampedPage !== requestedPage) setPage(clampedPage);
  }, [clampedPage, requestedPage, setPage]);

  // Coming back from an application: focus the row or card the user opened.
  const containerRef = useRef<HTMLDivElement>(null);
  const focusRestored = useRef(false);
  // Next.js keeps this page alive in <Activity> while it is hidden: refs survive, effects re-run on show.
  useEffect(
    () => () => {
      focusRestored.current = false;
    },
    [],
  );
  useEffect(() => {
    if (!data || focusRestored.current) return;
    focusRestored.current = true;
    const id = takeReturnFocus();
    if (!id) return;
    const item = containerRef.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(id)}"]`);
    const target = item?.matches("[tabindex='0']") ? item : item?.querySelector<HTMLElement>("a[href]");
    target?.focus();
    target?.scrollIntoView({ block: "center" });
  }, [data]);

  // Any link to an application remembers where the list was (view, filters, page).
  function rememberOpenedApplication(event: React.MouseEvent) {
    const link = (event.target as Element).closest<HTMLAnchorElement>('a[href^="/applications/"]');
    if (link) rememberListPosition(link.pathname.split("/").pop() ?? "");
  }

  function changeView(next: ViewMode) {
    rememberView(next);
    url.setView(next);
  }

  function deleteIds(ids: string[], name?: string) {
    setSelected((current) => new Set([...current].filter((id) => !ids.includes(id))));
    void actions.remove(ids, name);
  }

  const changeStatus = (id: string, status: ApplicationStatus) => void actions.changeStatus([id], status);
  const deleteOne = (app: ApplicationSummary) => deleteIds([app.id], app.company);
  const shownCount = !data ? 0 : data.kind === "page" ? data.page.total : data.items.length;

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
    content = (
      <NoApplications onAdd={() => addDialog.open("manual")} onImport={() => addDialog.open("import")} />
    );
  } else if (shownCount === 0) {
    content = <NoResults onReset={url.resetFilters} />;
  } else if (data.kind === "page") {
    const sort: TableSort = url.query.sort ?? null;
    content = (
      <>
        <ApplicationsTable
          applications={data.page.items}
          sort={sort}
          onSort={(next) => url.setSort(next?.field ?? null, next?.direction ?? "asc")}
          selected={selected}
          onSelectionChange={setSelected}
          onChangeStatus={changeStatus}
          onDelete={deleteOne}
        />
        <TableFooter
          page={data.page.page}
          pageSize={url.state.size}
          total={data.page.total}
          onPageChange={url.setPage}
          onPageSizeChange={url.setPageSize}
        />
      </>
    );
  } else if (data.kind === "details") {
    content = <ApplicationsTimeline applications={data.items} now={data.now} />;
  } else {
    content = <KanbanBoard applications={data.items} onChangeStatus={changeStatus} onDelete={deleteOne} />;
  }

  const selectedIds = [...selected];

  return (
    <div ref={containerRef} onClickCapture={rememberOpenedApplication}>
      {totalAll === 0 ? null : (
        <ApplicationsToolbar
          view={view}
          onViewChange={changeView}
          search={url.state.q}
          statuses={url.state.status}
          sources={url.state.source}
          availableSources={sources}
          onSearchChange={url.setSearch}
          onStatusesChange={url.setStatuses}
          onSourcesChange={url.setSources}
          onResetFilters={url.resetFilters}
          onExport={() => void actions.exportCsv({ query: filters })}
          exportDisabled={shownCount === 0}
          onAdd={() => addDialog.open("manual")}
        />
      )}
      {content}
      <AddApplicationDialog />
      {view === "table" && selectedIds.length > 0 ? (
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
    </div>
  );
}
