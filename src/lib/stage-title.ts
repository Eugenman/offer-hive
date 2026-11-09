import { INTERVIEW_KIND_LABELS, STAGE_TYPE_LABELS, type Stage } from "./domain";

/** "Interview", "Take-home" or the user's own title: everything but the number. */
export function stageLabel(stage: Pick<Stage, "title" | "type">) {
  return stage.title ?? STAGE_TYPE_LABELS[stage.type];
}

/** "Interview #2", or the user's own title with its number: "Техническое интервью #1". */
export function stageTitle(stage: Pick<Stage, "title" | "type" | "seq">) {
  return `${stageLabel(stage)} #${stage.seq}`;
}

/** "Technical #2": the kind and the number, without the user's own title — for tight places. */
export function shortStageTitle(stage: Pick<Stage, "type" | "interviewKind" | "seq">) {
  const base = stage.interviewKind
    ? INTERVIEW_KIND_LABELS[stage.interviewKind].replace(/^./, (letter) => letter.toUpperCase())
    : STAGE_TYPE_LABELS[stage.type];
  return `${base} #${stage.seq}`;
}
