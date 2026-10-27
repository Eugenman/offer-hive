"use client";

import {
  debounce,
  parseAsArrayOf,
  parseAsInteger,
  parseAsNumberLiteral,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from "nuqs";
import { APPLICATION_STATUSES } from "@/lib/domain";
import { SORT_FIELDS, type ApplicationsQuery } from "@/lib/repository/types";

export const VIEWS = ["table", "kanban", "list", "timeline"] as const;
export type ViewMode = (typeof VIEWS)[number];

export const PAGE_SIZES = [10, 25, 50] as const;
export type PageSize = (typeof PAGE_SIZES)[number];

const parsers = {
  view: parseAsStringLiteral(VIEWS),
  q: parseAsString.withDefault(""),
  status: parseAsArrayOf(parseAsStringLiteral(APPLICATION_STATUSES)).withDefault([]),
  source: parseAsArrayOf(parseAsString).withDefault([]),
  sort: parseAsStringLiteral(SORT_FIELDS),
  dir: parseAsStringLiteral(["asc", "desc"] as const).withDefault("asc"),
  page: parseAsInteger.withDefault(1),
  size: parseAsNumberLiteral(PAGE_SIZES).withDefault(25),
};

/**
 * View state lives in the URL (?view=&q=&status=&source=&sort=&dir=&page=&size=),
 * so a link or a page reload opens the same view. Updates are shallow: data is client-side.
 */
export function useApplicationsUrlState() {
  const [state, setState] = useQueryStates(parsers, { clearOnDefault: true });

  const query: ApplicationsQuery = {
    search: state.q,
    statuses: state.status,
    sources: state.source,
    sort: state.sort ? { field: state.sort, direction: state.dir } : undefined,
    page: state.page,
    pageSize: state.size,
  };

  // Any change of what is shown starts again from the first page.
  const resetPage = { page: null };

  return {
    state,
    query,
    setSearch: (q: string) =>
      setState({ q: q || null, ...resetPage }, { limitUrlUpdates: q ? debounce(300) : undefined }),
    setStatuses: (status: typeof state.status) => setState({ status, ...resetPage }),
    setSources: (source: string[]) => setState({ source, ...resetPage }),
    resetFilters: () => setState({ q: null, status: null, source: null, ...resetPage }),
    setSort: (sort: (typeof SORT_FIELDS)[number] | null, dir: "asc" | "desc") =>
      setState({ sort, dir: sort ? dir : null, ...resetPage }),
    setView: (view: ViewMode) => setState({ view }),
    restoreView: (view: ViewMode) => setState({ view }, { history: "replace" }),
    setPage: (page: number) => setState({ page }),
    setPageSize: (size: PageSize) => setState({ size, ...resetPage }),
  };
}
