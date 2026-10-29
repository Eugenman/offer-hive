export const APPLICATION_STATUSES = [
  "sent",
  "screening",
  "interview",
  "technical",
  "test_task",
  "offer",
  "offer_discussion",
  "rejected",
  "withdrawn",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  sent: "Applied",
  screening: "Screening",
  interview: "Interview",
  technical: "Technical",
  test_task: "Take-home",
  offer: "Offer",
  offer_discussion: "Negotiation",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

/** Hiring steps in order. Every new application starts at "sent". */
export const PIPELINE_STATUSES = [
  "sent",
  "screening",
  "interview",
  "technical",
  "test_task",
  "offer",
  "offer_discussion",
] as const satisfies readonly ApplicationStatus[];

/** Final outcomes, reachable from any step. Leaving them is only possible by undoing the change. */
export const OUTCOME_STATUSES = ["rejected", "withdrawn"] as const satisfies readonly ApplicationStatus[];

const isOutcome = (status: ApplicationStatus) => (OUTCOME_STATUSES as readonly string[]).includes(status);

/**
 * Where an application may move from `from`: forward to any later step (optional steps may be skipped)
 * or to an outcome. "Negotiation" only follows "Offer", which cannot be skipped.
 * Going back is not a transition: it is undoing the last change (see `revertStatus`).
 */
export function nextStatuses(from: ApplicationStatus): ApplicationStatus[] {
  if (isOutcome(from)) return [];
  const later = PIPELINE_STATUSES.slice(
    PIPELINE_STATUSES.indexOf(from as (typeof PIPELINE_STATUSES)[number]) + 1,
  );
  return [
    ...later.filter((status) => status !== "offer_discussion" || from === "offer"),
    ...OUTCOME_STATUSES,
  ];
}

export function canChangeStatus(from: ApplicationStatus, to: ApplicationStatus) {
  return nextStatuses(from).includes(to);
}

/** Statuses every one of `current` may move to (bulk change). */
export function commonNextStatuses(current: ApplicationStatus[]): ApplicationStatus[] {
  if (current.length === 0) return [];
  return APPLICATION_STATUSES.filter((to) =>
    current.every((from) => from === to || canChangeStatus(from, to)),
  );
}

// Statuses that may carry an optional reason.
export const STATUSES_WITH_REASON: readonly ApplicationStatus[] = ["rejected", "withdrawn"];

export const WORK_FORMATS = ["office", "hybrid", "remote"] as const;
export type WorkFormat = (typeof WORK_FORMATS)[number];

export const WORK_FORMAT_LABELS: Record<WorkFormat, string> = {
  office: "Office",
  hybrid: "Hybrid",
  remote: "Remote",
};

export const STAGE_TYPES = ["interview", "test_task", "other"] as const;
export type StageType = (typeof STAGE_TYPES)[number];

export const STAGE_TYPE_LABELS: Record<StageType, string> = {
  interview: "Interview",
  test_task: "Take-home",
  other: "Other",
};

export const INTERVIEW_KINDS = ["technical", "team", "manager", "final"] as const;
export type InterviewKind = (typeof INTERVIEW_KINDS)[number];

export const INTERVIEW_KIND_LABELS: Record<InterviewKind, string> = {
  technical: "technical",
  team: "team",
  manager: "hiring manager",
  final: "final",
};

export const STAGE_STATES = ["planned", "done", "cancelled"] as const;
export type StageState = (typeof STAGE_STATES)[number];

export const STAGE_STATE_LABELS: Record<StageState, string> = {
  planned: "Planned",
  done: "Done",
  cancelled: "Cancelled",
};

/** ISO date without time, e.g. "2026-10-12". */
export type IsoDate = string;
/** ISO timestamp, e.g. "2026-10-12T09:30:00.000Z". */
export type IsoDateTime = string;

export type Application = {
  id: string;
  company: string;
  position: string;
  status: ApplicationStatus;
  statusChangedAt: IsoDateTime;
  appliedAt: IsoDate | null;
  url: string | null;
  location: string | null;
  workFormat: WorkFormat | null;
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string | null;
  contactName: string | null;
  contactInfo: string | null;
  source: string | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
};

export type Stage = {
  id: string;
  applicationId: string;
  type: StageType;
  interviewKind: InterviewKind | null;
  title: string | null;
  /** Running number among stages of the same type and kind: "Interview · technical #2". */
  seq: number;
  scheduledAt: IsoDateTime | null;
  state: StageState;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
};

export type Note = {
  id: string;
  applicationId: string;
  /** null — the note belongs to the whole application. */
  stageId: string | null;
  body: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
};

export type StatusChange = {
  id: string;
  applicationId: string;
  fromStatus: ApplicationStatus | null;
  toStatus: ApplicationStatus;
  reason: string | null;
  changedAt: IsoDateTime;
};

/** A row in table / kanban / list views. */
export type ApplicationSummary = Application & {
  /** Status before the last change: the one "undo" returns to. null when nothing to undo. */
  previousStatus: ApplicationStatus | null;
  noteCount: number;
  latestNote: Note | null;
};

/** Everything shown on the application page. */
export type ApplicationDetails = Application & {
  previousStatus: ApplicationStatus | null;
  stages: Stage[];
  notes: Note[];
  statusChanges: StatusChange[];
};
