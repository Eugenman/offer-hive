/** The exact moment matters for the state menu: an event later today has not happened yet. */
export const isFutureInstant = (value: string | null, now: Date = new Date()) =>
  value !== null && Date.parse(value) > now.getTime();
import type { StageState } from "./domain";

/**
 * A stage can be finished only after its day has come. The editor already hides the state menu for
 * future events; these helpers keep the same rule on the write path and let a repair script find
 * the rows that slipped in through an import.
 */
export const isFinishedState = (state: StageState) => state === "done" || state === "failed";

export function isStageStateConsistent(
  state: StageState,
  scheduledAt: string | null,
  now: Date = new Date(),
): boolean {
  if (!scheduledAt || !isFinishedState(state)) return true;
  return !isFutureInstant(scheduledAt, now);
}

/**
 * What the stage should say instead: a finished stage dated in the future is really a plan, so it
 * becomes "planned" — the date is kept, only the claim about the outcome is dropped.
 */
export function repairedStageState<T extends { state: StageState; scheduledAt: string | null }>(
  stage: T,
  now: Date = new Date(),
): StageState | null {
  if (isStageStateConsistent(stage.state, stage.scheduledAt, now)) return null;
  return "planned";
}
