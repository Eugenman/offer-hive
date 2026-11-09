"use client";

import { useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";
import {
  type ApplicationDetails,
  type ApplicationStatus,
  type ApplicationSummary,
  type InterviewKind,
  type StageType,
  commonNextStatuses,
  stageForStatus,
} from "@/lib/domain";
import { useRepository, useRepositoryQuery } from "@/lib/repository/provider";
import type { ApplicationsPage, ApplicationsRepository } from "@/lib/repository/types";
import { AddApplicationDialog } from "./add/add-application-dialog";
import { useAddDialog } from "./add/use-add-dialog";
import { rememberListPosition, takeReturnFocus } from "./detail/return-to-list";
import { useFileDrop } from "@/hooks/use-file-drop";
import { RepeatEventDialog } from "./detail/repeat-event-dialog";
import { ApplicationsTable, type TableSort } from "./applications-table";
import { ApplicationsToolbar } from "./applications-toolbar";
import { BulkActionsBar } from "./bulk-actions-bar";
import { NoApplications, NoResults } from "./empty-states";
import { countApplications } from "@/lib/plural";
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

  const { data, error } = useRepositoryQuery<ViewData>(
    queryKey,
    async (repository: ApplicationsRepository) => {
      if (view === "table") return { kind: "page", page: await repository.list(url.query) };
      if (view === "timeline") {
        return { kind: "details", items: await repository.listDetailed(filters), now: Date.now() };
      }
      return { kind: "summaries", items: (await repository.list({ ...filters, pageSize: ALL })).items };
    },
  );
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

  // Every archive goes through one confirmation: the table's checked rows, a kanban column, the whole board.
  const [pendingArchive, setPendingArchive] = useState<{ ids: string[]; name?: string } | null>(null);
  function requestArchive(ids: string[], name?: string) {
    if (ids.length === 0) return;
    setPendingArchive({ ids, name });
  }

  function deleteIds(ids: string[], name?: string) {
    setSelected((current) => new Set([...current].filter((id) => !ids.includes(id))));
    void actions.remove(ids, name);
  }

  const changeStatus = (id: string, status: ApplicationStatus) => void actions.changeStatus([id], status);
  const revertStatus = (app: ApplicationSummary) => {
    if (app.previousStatus) void actions.revertStatus(app.id, app.previousStatus);
  };
  const deleteOne = (app: ApplicationSummary) => requestArchive([app.id], app.company);
  const shownCount = !data ? 0 : data.kind === "page" ? data.page.total : data.items.length;
  const filtered =
    Boolean(url.query.search) ||
    (url.query.statuses?.length ?? 0) > 0 ||
    (url.query.sources?.length ?? 0) > 0;

  // On an empty list a dropped spreadsheet replaces the empty state and opens the import with it.
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  // Which status gets another dated event, prefilled from its current one.
  const [repeat, setRepeat] = useState<{
    app: ApplicationSummary;
    type: StageType;
    interviewKind: InterviewKind | null;
    after: string | null;
    notBefore: string;
  } | null>(null);
  const repository = useRepository();
  async function scheduleRepeat(app: ApplicationSummary) {
    const mapped = stageForStatus(app.status);
    if (!mapped) return;
    const details = await repository.get(app.id);
    const same =
      details?.stages.filter(
        (stage) => stage.type === mapped.type && stage.interviewKind === mapped.interviewKind,
      ) ?? [];
    const latest = same.at(-1);
    setRepeat({
      app,
      type: mapped.type,
      interviewKind: mapped.interviewKind,
      after: latest?.scheduledAt ?? null,
      notBefore: app.appliedAt ?? app.createdAt,
    });
  }
  const draggingFile = useFileDrop(addDialog.tab === null, (file) => {
    setPendingFile(file);
    addDialog.open("import");
  });

  let content: React.ReactNode;
  if (error) {
    content = (
      <p role="alert" className="px-6 py-8 text-sm text-destructive">
        Couldn’t load applications. Reload the page.
      </p>
    );
  } else if (!data || totalAll === undefined) {
    content = (
      <>
        <span className="sr-only" role="status">
          Loading applications
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
          onRevertStatus={revertStatus}
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
    content = (
      <KanbanBoard
        applications={data.items}
        onChangeStatus={changeStatus}
        onRevertStatus={revertStatus}
        onDelete={deleteOne}
        onArchiveColumn={(ids) => requestArchive(ids)}
        onRepeat={(app) => void scheduleRepeat(app)}
      />
    );
  }

  const selectedIds = [...selected];
  // Selection lives on the current table page, so the statuses are known from its rows.
  const selectedStatuses =
    data?.kind === "page"
      ? data.page.items.filter((app) => selected.has(app.id)).map((app) => app.status)
      : [];

  return (
    <div ref={containerRef} onClickCapture={rememberOpenedApplication} className="relative">
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
          onAdd={() => addDialog.open("manual")}
          onExport={(format) => void actions.exportApplications({ query: url.query }, format)}
          exportDisabled={shownCount === 0}
          archive={
            view === "table"
              ? {
                  count: selectedIds.length,
                  label: selectedIds.length
                    ? `Archive selected: ${selectedIds.length}`
                    : "Select applications to archive",
                  onArchive: () => {
                    const only =
                      selectedIds.length === 1 && data?.kind === "page"
                        ? data.page.items.find((app) => app.id === selectedIds[0])
                        : undefined;
                    requestArchive(selectedIds, only?.company);
                  },
                }
              : view === "kanban" && data?.kind === "summaries"
                ? {
                    count: data.items.length,
                    label: `Archive all shown: ${data.items.length}`,
                    onArchive: () => requestArchive(data.items.map((app) => app.id)),
                  }
                : undefined
          }
        />
      )}
      {content}
      {draggingFile ? (
        <div className="import-drop-overlay pointer-events-none fixed right-0 bottom-0 z-40 flex bg-background/85 p-3 backdrop-blur-[1px]">
          <div className="flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-primary/50">
            <span className="flex size-12 items-center justify-center rounded-xl bg-muted" aria-hidden>
              <Upload className="size-6 text-muted-foreground" />
            </span>
            <p className="mt-4 text-base font-semibold">Drop the spreadsheet here</p>
            <p className="mt-1 max-w-sm px-6 text-center text-sm text-muted-foreground">
              Excel, LibreOffice, Numbers, CSV or TSV. The file is read in your browser and never uploaded.
            </p>
          </div>
        </div>
      ) : null}
      <AddApplicationDialog initialFile={pendingFile} onFileConsumed={() => setPendingFile(null)} />
      {repeat ? (
        <RepeatEventDialog
          open
          onOpenChange={(open) => {
            if (!open) setRepeat(null);
          }}
          app={repeat.app}
          type={repeat.type}
          interviewKind={repeat.interviewKind}
          after={repeat.after}
          notBefore={repeat.notBefore}
        />
      ) : null}

      <AlertDialog
        open={pendingArchive !== null}
        onOpenChange={(open) => {
          if (open) return;
          setPendingArchive(null);
          // Cancelling in the table also clears the checkboxes, so the next attempt starts from zero.
          if (view === "table") setSelected(new Set());
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move to the archive?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingArchive ? (
                <>
                  {countApplications(pendingArchive.ids.length)} will move to the archive.
                  {filtered
                    ? ` That is ${pendingArchive.ids.length} of ${countApplications(totalAll ?? 0)} — only what matches the current search and filters.`
                    : ""}{" "}
                  You can restore {pendingArchive.ids.length === 1 ? "it" : "them"} from Archive within 30
                  days.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const pending = pendingArchive;
                setPendingArchive(null);
                if (pending) deleteIds(pending.ids, pending.name);
              }}
            >
              Move to the archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {view === "table" && selectedIds.length > 0 ? (
        <>
          {/* Room for the floating bar so it never covers the last row or the pager. */}
          <div aria-hidden className="h-20" />
          <BulkActionsBar
            count={selectedIds.length}
            statuses={commonNextStatuses(selectedStatuses)}
            onChangeStatus={(status: ApplicationStatus) => void actions.changeStatus(selectedIds, status)}
            onExport={(format) => void actions.exportApplications({ ids: selectedIds }, format)}
            onClear={() => setSelected(new Set())}
          />
        </>
      ) : null}
    </div>
  );
}
