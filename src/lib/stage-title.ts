import { INTERVIEW_KIND_LABELS, STAGE_TYPE_LABELS, type Stage } from "./domain";

/** "Интервью · техническое #2", or the user's own title with its number. */
export function stageTitle(stage: Pick<Stage, "title" | "type" | "interviewKind" | "seq">) {
  const base = stage.title ?? STAGE_TYPE_LABELS[stage.type];
  const kind = stage.interviewKind ? ` · ${INTERVIEW_KIND_LABELS[stage.interviewKind]}` : "";
  return `${base}${kind} #${stage.seq}`;
}
