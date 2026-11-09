import { STAGE_TYPE_LABELS, type Stage } from "./domain";

/** "Interview #2", or the user's own title with its number: "Техническое интервью #1". */
export function stageTitle(stage: Pick<Stage, "title" | "type" | "seq">) {
  const base = stage.title ?? STAGE_TYPE_LABELS[stage.type];
  return `${base} #${stage.seq}`;
}
