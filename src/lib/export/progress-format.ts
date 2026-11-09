import type { Stage, StatusChange } from "@/lib/domain";

/**
 * How progress travels in a backup file. One line per event or status change, fields joined by "|",
 * so a cell stays a single CSV cell and parses back without guessing:
 *
 *   interview|technical|2|2026-11-19T09:00:00.000Z|planned|Техническое интервью
 *   sent|interview|2026-11-09T10:04:00.000Z|
 *
 * Empty fields mean "nothing": no kind, no date, no title, no previous status, no reason.
 */
export const EVENTS_HEADER = "Events";
export const HISTORY_HEADER = "Status history";

export type ExportedEvent = {
  type: Stage["type"];
  interviewKind: Stage["interviewKind"];
  title: string | null;
  scheduledAt: string | null;
  state: Stage["state"];
};

export type ExportedChange = {
  fromStatus: StatusChange["fromStatus"];
  toStatus: StatusChange["toStatus"];
  changedAt: string;
  reason: string | null;
};

const SEPARATOR = "|";

/** A cell never contains the field separator or a line break: both would break the format. */
const clean = (value: string | null | undefined) =>
  (value ?? "").replaceAll(SEPARATOR, "/").replace(/\r?\n/g, " ").trim();

export function encodeEvents(stages: Stage[]): string | null {
  if (stages.length === 0) return null;
  return [...stages]
    .sort((a, b) => a.seq - b.seq)
    .map((stage) =>
      [
        stage.type,
        clean(stage.interviewKind),
        stage.seq,
        stage.scheduledAt ?? "",
        stage.state,
        clean(stage.title),
      ].join(SEPARATOR),
    )
    .join("\n");
}

export function encodeHistory(changes: StatusChange[]): string | null {
  if (changes.length === 0) return null;
  return [...changes]
    .sort((a, b) => a.changedAt.localeCompare(b.changedAt))
    .map((change) =>
      [clean(change.fromStatus), change.toStatus, change.changedAt, clean(change.reason)].join(SEPARATOR),
    )
    .join("\n");
}

/** Lines that do not parse are skipped: a backup with one broken line still restores the rest. */
export function decodeEvents(cell: string | null): ExportedEvent[] {
  if (!cell) return [];
  return cell
    .split(/\r?\n/)
    .map((line) => line.split(SEPARATOR))
    .filter((parts) => parts.length >= 5)
    .map(([type, kind, , scheduledAt, state, title = ""]) => ({
      type: type as ExportedEvent["type"],
      interviewKind: (kind || null) as ExportedEvent["interviewKind"],
      title: title.trim() || null,
      scheduledAt: scheduledAt || null,
      state: state as ExportedEvent["state"],
    }))
    .filter((event) => event.type && event.state);
}

export function decodeHistory(cell: string | null): ExportedChange[] {
  if (!cell) return [];
  return cell
    .split(/\r?\n/)
    .map((line) => line.split(SEPARATOR))
    .filter((parts) => parts.length >= 3)
    .map(([from, to, changedAt, reason = ""]) => ({
      fromStatus: (from || null) as ExportedChange["fromStatus"],
      toStatus: to as ExportedChange["toStatus"],
      changedAt,
      reason: reason.trim() || null,
    }))
    .filter((change) => change.toStatus && change.changedAt);
}
