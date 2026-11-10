import { type ApplicationStatus, BOARD_COLUMNS } from "./domain";

/**
 * One palette for the whole product: a column has a colour, and every status inside it wears the
 * same one. The board reads left to right, from a quiet backlog to a loud finish, and the table,
 * the timeline and the reports agree with it.
 */
export const COLUMN_BG: Record<string, string> = {
  wishlist: "bg-column-wishlist",
  applied: "bg-column-applied",
  in_process: "bg-column-process",
  offer: "bg-column-offer",
  accepted: "bg-column-accepted",
  closed: "bg-column-closed",
};

export const COLUMN_TEXT: Record<string, string> = {
  wishlist: "text-column-wishlist-fg",
  applied: "text-column-applied-fg",
  in_process: "text-column-process-fg",
  offer: "text-column-offer-fg",
  accepted: "text-column-accepted-fg",
  closed: "text-column-closed-fg",
};

export const COLUMN_RING: Record<string, string> = {
  wishlist: "ring-column-wishlist-fg/30",
  applied: "ring-column-applied-fg/30",
  in_process: "ring-column-process-fg/30",
  offer: "ring-column-offer-fg/30",
  accepted: "ring-column-accepted-fg/30",
  closed: "ring-column-closed-fg/30",
};

/**
 * In process holds five stages, Offer two. Each has its own hue so the column shows progress from
 * the first call to the final round; the badge is a barely visible tint of that hue, the zone label
 * a thin bar.
 * The classes are written out: Tailwind only sees class names that exist in the source.
 */
const ZONE_BADGE: Partial<Record<ApplicationStatus, string>> = {
  screening: "bg-zone-screening/10 text-zone-screening",
  interview: "bg-zone-interview/10 text-zone-interview",
  technical: "bg-zone-technical/10 text-zone-technical",
  test_task: "bg-zone-test/10 text-zone-test",
  fit: "bg-zone-fit/10 text-zone-fit",
  offer: "bg-zone-offer/10 text-zone-offer",
  offer_discussion: "bg-zone-negotiation/10 text-zone-negotiation",
  rejected: "bg-zone-rejected/10 text-zone-rejected",
  withdrawn: "bg-zone-withdrawn/10 text-zone-withdrawn",
};

const ZONE_BAR: Partial<Record<ApplicationStatus, string>> = {
  screening: "bg-zone-screening",
  interview: "bg-zone-interview",
  technical: "bg-zone-technical",
  test_task: "bg-zone-test",
  fit: "bg-zone-fit",
  offer: "bg-zone-offer",
  offer_discussion: "bg-zone-negotiation",
  rejected: "bg-zone-rejected",
  withdrawn: "bg-zone-withdrawn",
};

/** The thin colour bar next to a zone label, or null for statuses outside In process. */
export function zoneBarClass(status: ApplicationStatus): string | null {
  return ZONE_BAR[status] ?? null;
}

/** The column a status belongs to, as a palette key. */
export function columnKeyOf(status: ApplicationStatus): string {
  return BOARD_COLUMNS.find((column) => column.zones.includes(status))?.key ?? "applied";
}

/** "bg-… text-…" for a status badge. */
export function statusColors(status: ApplicationStatus): string {
  const zone = ZONE_BADGE[status];
  if (zone) return zone;
  const key = columnKeyOf(status);
  return `${COLUMN_BG[key]} ${COLUMN_TEXT[key]}`;
}
