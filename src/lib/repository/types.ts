import type {
  Application,
  ApplicationDetails,
  ApplicationStatus,
  ApplicationSummary,
  Note,
  Stage,
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

  create(input: ApplicationInput): Promise<Application>;
  update(id: string, patch: ApplicationPatch): Promise<Application>;
  /**
   * Same status again is a no-op; every real change is written to the status log.
   * Only moves allowed by `canChangeStatus`; `ignoreRules` is for imports, which take statuses as they are.
   */
  changeStatus(ids: string[], input: StatusChangeInput, options?: { ignoreRules?: boolean }): Promise<void>;
  /** Undoes the last status change: the previous status comes back and the log entry is removed. */
  revertStatus(ids: string[]): Promise<void>;
  /** Soft delete; `restore` brings the records back (used by the "Undo" toast). */
  remove(ids: string[]): Promise<void>;
  restore(ids: string[]): Promise<void>;

  addStage(applicationId: string, input: StageInput): Promise<Stage>;
  updateStage(stageId: string, patch: StagePatch): Promise<Stage>;
  removeStage(stageId: string): Promise<void>;

  addNote(applicationId: string, input: NoteInput): Promise<Note>;
  updateNote(noteId: string, patch: NotePatch): Promise<Note>;
  removeNote(noteId: string): Promise<void>;

  /** Deletes every application, stage, note and status change. Cannot be undone. */
  clear(): Promise<void>;

  /** Called after every change, so views can refetch. Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void;
}

export class StatusTransitionError extends Error {
  constructor(from: string, to: string) {
    super(`Status change not allowed: ${from} → ${to}`);
    this.name = "StatusTransitionError";
  }
}

export class NotFoundError extends Error {
  constructor(what: string, id: string) {
    super(`${what} not found: ${id}`);
    this.name = "NotFoundError";
  }
}
