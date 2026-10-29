import type {
  Application,
  ApplicationDetails,
  ApplicationStatus,
  ApplicationSummary,
  Note,
  Stage,
  StatisticsEntry,
} from "@/lib/domain";
import type {
  ApplicationInput,
  ApplicationPatch,
  NoteInput,
  NotePatch,
  StageInput,
  StagePatch,
  StatusChangeInput,
} from "@/lib/schemas";

export const SORT_FIELDS = ["company", "status", "appliedAt", "salary", "source", "updatedAt"] as const;
export type SortField = (typeof SORT_FIELDS)[number];
export type SortDirection = "asc" | "desc";

export type ApplicationsQuery = {
  search?: string;
  statuses?: ApplicationStatus[];
  sources?: string[];
  sort?: { field: SortField; direction: SortDirection };
  page?: number;
  pageSize?: number;
};

/** An application in the archive: deleted, restorable until `erasedAt`. */
export type DeletedApplication = Application & { deletedAt: string; erasedAt: string };

/** An archived application with everything attached, shown read-only. */
export type ArchivedApplicationDetails = ApplicationDetails & { deletedAt: string; erasedAt: string };

export type ApplicationsPage = {
  items: ApplicationSummary[];
  total: number;
  page: number;
  pageSize: number;
};

/**
 * The only way UI code reaches application data.
 * Stage 1: in memory. Stage 2: IndexedDB. Stage 5: server actions.
 * All methods are async so implementations can be swapped without touching callers.
 */
export interface ApplicationsRepository {
  list(query?: ApplicationsQuery): Promise<ApplicationsPage>;
  /** All matching applications with stages and notes, no paging (kanban, timeline, export). */
  listDetailed(query?: Omit<ApplicationsQuery, "page" | "pageSize">): Promise<ApplicationDetails[]>;
  get(id: string): Promise<ApplicationDetails | null>;
  listSources(): Promise<string[]>;
  /** The archive: deleted applications, newest first. They are erased for good after 30 days. */
  listDeleted(): Promise<DeletedApplication[]>;
  /**
   * Everything Statistics counts: active, archived and deleted-for-good applications. The numbers
   * cover the whole job search, not only what is in the list right now.
   */
  listForStatistics(): Promise<StatisticsEntry[]>;
  /** One archived application with progress, notes and status history; null if it isn't archived. */
  getArchived(id: string): Promise<ArchivedApplicationDetails | null>;

  create(input: ApplicationInput): Promise<Application>;
  update(id: string, patch: ApplicationPatch): Promise<Application>;
  /**
   * Same status again is a no-op; every real change is written to the status log.
   * Only moves allowed by `canChangeStatus`; `ignoreRules` is for imports, which take statuses as they are.
   */
  changeStatus(ids: string[], input: StatusChangeInput, options?: { ignoreRules?: boolean }): Promise<void>;
  /** Undoes the last status change: the previous status comes back and the log entry is removed. */
  revertStatus(ids: string[]): Promise<void>;
  /** Moves to the archive; `restore` brings the records back (the "Undo" toast, the Archive page). */
  remove(ids: string[]): Promise<void>;
  restore(ids: string[]): Promise<void>;
  /**
   * Erases archived applications for good, with their progress, notes and status history.
   * Statistics keep their entries (`listForStatistics`).
   */
  erase(ids: string[]): Promise<void>;

  addStage(applicationId: string, input: StageInput): Promise<Stage>;
  updateStage(stageId: string, patch: StagePatch): Promise<Stage>;
  removeStage(stageId: string): Promise<void>;

  addNote(applicationId: string, input: NoteInput): Promise<Note>;
  updateNote(noteId: string, patch: NotePatch): Promise<Note>;
  removeNote(noteId: string): Promise<void>;

  /** Deletes every application, stage, note, status change and statistics entry. Cannot be undone. */
  clear(): Promise<void>;

  /** false when the browser blocks storage and data lives only until the tab is closed. */
  isPersistent(): Promise<boolean>;

  /** Called after every change, so views can refetch. Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void;
}

/** What went wrong, so the UI can pick a message: a record is gone, or a move breaks the status rules. */
export type RepositoryErrorKind = "not_found" | "status_transition";

export type RepositoryError = Error & { kind: RepositoryErrorKind };

function repositoryError(kind: RepositoryErrorKind, message: string): RepositoryError {
  return Object.assign(new Error(message), { kind });
}

export const notFound = (what: string, id: string) =>
  repositoryError("not_found", `${what} not found: ${id}`);

export const statusTransitionError = (from: string, to: string) =>
  repositoryError("status_transition", `Status change not allowed: ${from} → ${to}`);

export function isRepositoryError(error: unknown, kind: RepositoryErrorKind): error is RepositoryError {
  return error instanceof Error && (error as Partial<RepositoryError>).kind === kind;
}
