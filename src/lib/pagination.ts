/**
 * A page of a list, as the table footers show it.
 *
 * The page number is clamped instead of trusted: rows can disappear (an application is restored,
 * a search narrows the list) while the page number stays in the URL or in state, and an empty page
 * would look like an empty archive.
 */
export type Page<T> = {
  items: T[];
  page: number;
  size: number;
  total: number;
  /** Number of pages, at least 1: an empty list still has its first page. */
  last: number;
};

export function paginate<T>(items: readonly T[], page: number, size: number): Page<T> {
  const total = items.length;
  const last = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(1, Math.trunc(page) || 1), last);
  const from = (current - 1) * size;
  return { items: items.slice(from, from + size), page: current, size, total, last };
}
