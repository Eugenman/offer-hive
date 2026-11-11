export const APPLICATION_STATUSES = [
  "wishlist",
  "sent",
  "screening",
  "interview",
  "technical",
  "test_task",
  "fit",
  "offer",
  "offer_discussion",
  "accepted",
  "rejected",
  "withdrawn",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  wishlist: "Wishlist",
  sent: "Applied",
  screening: "Screening",
  interview: "Interview",
  technical: "Technical",
  test_task: "Take-home",
  fit: "Fit",
  offer: "Offer",
  offer_discussion: "Negotiation",
  accepted: "Accepted",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

/**
 * The board: a few stable columns, each with one or more statuses inside. The column is the
 * stage; the statuses in it are equal variants ("screening" and "technical" are both the same
 * process, only at a different point), so moving between them is not a step backwards.
 */
export const BOARD_COLUMNS: readonly {
  key: string;
  title: string;
  zones: readonly ApplicationStatus[];
}[] = [
  { key: "wishlist", title: "Wishlist", zones: ["wishlist"] },
  { key: "applied", title: "Applied", zones: ["sent"] },
  {
    key: "in_process",
    title: "In process",
    zones: ["screening", "interview", "technical", "test_task", "fit"],
  },
  { key: "offer", title: "Offers", zones: ["offer", "offer_discussion"] },
  { key: "accepted", title: "Accepted", zones: ["accepted"] },
  { key: "closed", title: "Closed", zones: ["rejected", "withdrawn"] },
];

/** The statuses a live application can stand in, in board order. Used for sorting and reports. */
export const PIPELINE_STATUSES = [
  "wishlist",
  "sent",
  "screening",
  "interview",
  "technical",
  "test_task",
  "fit",
  "offer",
  "offer_discussion",
] as const satisfies readonly ApplicationStatus[];

/** Final outcomes that close an application. Leaving them is only possible by undoing the change. */
export const OUTCOME_STATUSES = ["rejected", "withdrawn"] as const satisfies readonly ApplicationStatus[];

/** The application is finished: accepted, rejected or withdrawn. */
export const TERMINAL_STATUSES = [
  "accepted",
  "rejected",
  "withdrawn",
] as const satisfies readonly ApplicationStatus[];

const isTerminal = (status: ApplicationStatus) => (TERMINAL_STATUSES as readonly string[]).includes(status);

/** The column a status belongs to, and its place in the board. */
export function columnFor(status: ApplicationStatus): readonly ApplicationStatus[] {
  return BOARD_COLUMNS.find((column) => column.zones.includes(status))!.zones;
}

function columnIndex(status: ApplicationStatus): number {
  return BOARD_COLUMNS.findIndex((column) => column.zones.includes(status));
}

/**
 * Where an application may move from `from`: any status of a later column (optional steps may be
 * skipped), any other status of its own column, and an outcome. Accepted is the finish line of an
 * offer: only the Offer column can reach it. Going back to an earlier column is not a transition:
 * it is undoing the last change (see `revertStatus`).
 */
export function nextStatuses(from: ApplicationStatus): ApplicationStatus[] {
  if (isTerminal(from)) return [];
  const own = columnFor(from);
  const later = BOARD_COLUMNS.slice(columnIndex(from) + 1).flatMap((column) => column.zones);
  // Accepted and Negotiation belong to the offer stage: only an offer leads there.
  const reachable = later.filter(
    (status) =>
      (status !== "accepted" || own.includes("offer")) &&
      (status !== "offer_discussion" || own.includes("offer")),
  );
  return [...own.filter((status) => status !== from), ...(RETURN_TARGETS[from] ?? []), ...reachable];
}

/**
 * A real step back: after an offer the company may ask for another round, and that is not a
 * misclick to undo — it is a new change with its own date in the history.
 */
const RETURN_TARGETS: Partial<Record<ApplicationStatus, ApplicationStatus[]>> = {
  offer: ["screening", "interview", "technical", "test_task", "fit"],
  offer_discussion: ["screening", "interview", "technical", "test_task", "fit"],
};

/**
 * Where a closed application may come back to. Reopening is a deliberate action on the card, never
 * a drag on the board: a closed process that starts again is a decision, not a misclick.
 */
export function reopenTargets(from: ApplicationStatus): ApplicationStatus[] {
  const closed = columnFor(from);
  if (closed[0] !== "rejected") return [];
  return ["screening", "interview", "technical", "test_task", "fit"];
}

/** True when the move goes to an earlier column: the board asks before logging it. */
export function isReturn(from: ApplicationStatus, to: ApplicationStatus) {
  return columnIndex(to) < columnIndex(from);
}

/**
 * Where a card may go: the same as `nextStatuses`, plus the other statuses of its own column for a
 * finished application — Rejected and Withdrawn share the Closed column, so a drag between them is
 * a switch, not a way back.
 */
export function statusTargets(from: ApplicationStatus): ApplicationStatus[] {
  if (isTerminal(from)) return columnFor(from).filter((status) => status !== from);
  return nextStatuses(from);
}

export function canChangeStatus(from: ApplicationStatus, to: ApplicationStatus) {
  return statusTargets(from).includes(to);
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

/**
 * The event a status schedules. Interview, Technical and Take-home have their own kind; every other
 * status — Applied, Screening, Offer, even the outcomes — carries free-form events: a call with a
 * recruiter, a follow-up, anything dated.
 */
export function stageForStatus(status: ApplicationStatus): {
  type: StageType;
  interviewKind: InterviewKind | null;
} | null {
  // A wish is a link with a note: nothing has happened yet, so there is nothing to schedule.
  if (status === "wishlist") return null;
  if (status === "interview") return { type: "interview", interviewKind: null };
  if (status === "technical") return { type: "interview", interviewKind: "technical" };
  if (status === "test_task") return { type: "test_task", interviewKind: null };
  if (status === "fit") return { type: "interview", interviewKind: "team" };
  return { type: "other", interviewKind: null };
}

export const STAGE_STATES = ["planned", "done", "failed", "cancelled"] as const;
export type StageState = (typeof STAGE_STATES)[number];

export const STAGE_STATE_LABELS: Record<StageState, string> = {
  planned: "Planned",
  done: "Done",
  failed: "Failed",
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

/**
 * What Statistics knows about one application. It covers the whole job search, so it outlives the
 * application: deleting an application for good keeps this entry, with the company and the steps.
 */
export type StatisticsEntry = {
  id: string;
  company: string;
  position: string;
  source: string | null;
  appliedAt: IsoDate | null;
  /** Status at the moment the entry was taken (for deleted applications: when deleted). */
  status: ApplicationStatus;
  /** Every status the application ever had. */
  reached: ApplicationStatus[];
  /** When the current status started: the reports use it for "how long in this step". */
  statusChangedAt?: IsoDateTime;
  /** Why the application was refused or withdrawn, if the reason was written down. */
  reasons?: { status: ApplicationStatus; reason: string }[];
  /** Salary and events, so a source can list its applications without a second request. */
  salaryMin?: number | null;
  salaryMax?: number | null;
  currency?: string | null;
  events?: { scheduledAt: string | null; state: StageState }[];
  state: "active" | "archived" | "deleted";
};

/** A row in table / kanban / list views. */
/** The light form of an event shown on a card: its title, kind, number and date. */
export type SummaryStage = {
  type: StageType;
  interviewKind: InterviewKind | null;
  title: string | null;
  seq: number;
  scheduledAt: IsoDateTime | null;
  state: StageState;
};

export type ApplicationSummary = Application & {
  /** Status before the last change: the one "undo" returns to. null when nothing to undo. */
  previousStatus: ApplicationStatus | null;
  /** Newest first. */
  notes: Note[];
  /** Every event, so a card can list the progress without loading the whole application. */
  events: SummaryStage[];
};

/** Everything shown on the application page. */
export type ApplicationDetails = Application & {
  previousStatus: ApplicationStatus | null;
  stages: Stage[];
  notes: Note[];
  statusChanges: StatusChange[];
};
