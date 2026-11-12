import { APPLICATION_STATUSES, type ApplicationStatus, isReturn } from "./domain";

/**
 * What a drop on the board means.
 *
 * `over.id` is not always a status: dnd-kit reports whatever collides with the pointer, and on a
 * phone the finger often lands on a column header or on the card itself. Only a real status may be
 * written down — anything else is "nothing", not a failed status change.
 */
export type Drop =
  | { kind: "none" }
  /** Back where it came from: undo the last change instead of logging a new one. */
  | { kind: "revert"; status: ApplicationStatus }
  /** A step back (another round after an offer): ask first. */
  | { kind: "return"; status: ApplicationStatus }
  | { kind: "move"; status: ApplicationStatus };

export function statusFromDrop(overId: unknown): ApplicationStatus | null {
  const value = String(overId ?? "");
  return (APPLICATION_STATUSES as readonly string[]).includes(value) ? (value as ApplicationStatus) : null;
}

export function resolveDrop(
  app: { status: ApplicationStatus; previousStatus?: ApplicationStatus | null },
  overId: unknown,
): Drop {
  const status = statusFromDrop(overId);
  if (status === null || status === app.status) return { kind: "none" };
  if (status === app.previousStatus) return { kind: "revert", status };
  if (isReturn(app.status, status)) return { kind: "return", status };
  return { kind: "move", status };
}
