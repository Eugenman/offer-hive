export const APPLICATION_STATUSES = [
  "sent",
  "interview",
  "test_task",
  "offer",
  "rejected",
  "withdrawn",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  sent: "Отправлен",
  interview: "Интервью",
  test_task: "Тестовое",
  offer: "Оффер",
  rejected: "Отказ",
  withdrawn: "Отказался",
};

// Statuses that may carry an optional reason.
export const STATUSES_WITH_REASON: readonly ApplicationStatus[] = ["rejected", "withdrawn"];

export const WORK_FORMATS = ["office", "hybrid", "remote"] as const;
export type WorkFormat = (typeof WORK_FORMATS)[number];

export const WORK_FORMAT_LABELS: Record<WorkFormat, string> = {
  office: "Офис",
  hybrid: "Гибрид",
  remote: "Удалёнка",
};

export const STAGE_TYPES = ["interview", "test_task", "other"] as const;
export type StageType = (typeof STAGE_TYPES)[number];

export const STAGE_TYPE_LABELS: Record<StageType, string> = {
  interview: "Интервью",
  test_task: "Тестовое",
  other: "Другое",
};

export const INTERVIEW_KINDS = ["technical", "team", "manager", "final"] as const;
export type InterviewKind = (typeof INTERVIEW_KINDS)[number];

export const INTERVIEW_KIND_LABELS: Record<InterviewKind, string> = {
  technical: "техническое",
  team: "с командой",
  manager: "с руководителем",
  final: "финальное",
};

export const STAGE_STATES = ["planned", "done", "cancelled"] as const;
export type StageState = (typeof STAGE_STATES)[number];

export const STAGE_STATE_LABELS: Record<StageState, string> = {
  planned: "Запланирован",
  done: "Пройден",
  cancelled: "Отменён",
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
  /** Running number among stages of the same type and kind: "Интервью · техническое #2". */
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
  noteCount: number;
  latestNote: Note | null;
};

/** Everything shown on the application page. */
export type ApplicationDetails = Application & {
  stages: Stage[];
  notes: Note[];
  statusChanges: StatusChange[];
};
