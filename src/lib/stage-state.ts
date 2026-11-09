import type { StageState } from "./domain";

/** One palette for event states: the badge in the progress card, the state menu, the "next" frame. */
export const STATE_BADGE_CLASSES: Record<StageState, string> = {
  planned: "bg-status-sent-bg text-status-sent",
  done: "bg-status-offer-bg text-status-offer",
  failed: "bg-status-rejected-bg text-status-rejected",
  cancelled: "bg-status-withdrawn-bg text-status-withdrawn",
};

/**
 * The badge colours at 60% for the dashed frame around the next event: the pale background tones
 * were nearly invisible on a white card, the full text colours too heavy.
 */
export const STATE_BORDER_CLASSES: Record<StageState, string> = {
  planned: "border-status-sent/60",
  done: "border-status-offer/60",
  failed: "border-status-rejected/60",
  cancelled: "border-status-withdrawn/60",
};
