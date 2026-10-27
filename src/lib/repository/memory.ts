import { APPLICATION_STATUSES } from "@/lib/domain";
import type {
  Application,
  ApplicationDetails,
  ApplicationSummary,
  Note,
  Stage,
  StatusChange,
} from "@/lib/domain";
import {
  applicationInputSchema,
  applicationPatchSchema,
  noteInputSchema,
  notePatchSchema,
  stageInputSchema,
  stagePatchSchema,
  statusChangeInputSchema,
} from "@/lib/schemas";
import {
  type ApplicationsPage,
  type ApplicationsQuery,
  type ApplicationsRepository,
  NotFoundError,
} from "./types";

type StoredApplication = Application & { deletedAt: string | null };

export type MemorySeed = {
  applications: Application[];
  stages: Stage[];
  notes: Note[];
  statusChanges: StatusChange[];
};

const DEFAULT_PAGE_SIZE = 25;

const now = () => new Date().toISOString();
const newId = () => crypto.randomUUID();
const copy = <T>(value: T): T => structuredClone(value);

function normalize(value: string) {
  return value.toLocaleLowerCase("ru").replaceAll("ё", "е").trim();
}

/** Newest first; on equal timestamps the later-inserted record wins (sort is stable). */
function newestFirst<T>(items: T[], timestamp: (item: T) => string): T[] {
  return [...items].reverse().sort((a, b) => timestamp(b).localeCompare(timestamp(a)));
}

function compareNullable<T>(a: T | null, b: T | null, compare: (x: T, y: T) => number) {
  if (a === null && b === null) return 0;
  if (a === null) return 1; // empty values always go last
  if (b === null) return -1;
  return compare(a, b);
}

/** Keeps everything in memory: data resets on reload. Used while the UI is built (stage 1). */
export class MemoryApplicationsRepository implements ApplicationsRepository {
  private applications = new Map<string, StoredApplication>();
  private stages = new Map<string, Stage>();
  private notes = new Map<string, Note>();
  private statusChanges: StatusChange[] = [];
  private listeners = new Set<() => void>();

  constructor(seed?: MemorySeed) {
    if (!seed) return;
    for (const app of seed.applications) this.applications.set(app.id, { ...copy(app), deletedAt: null });
    for (const stage of seed.stages) this.stages.set(stage.id, copy(stage));
    for (const note of seed.notes) this.notes.set(note.id, copy(note));
    this.statusChanges = copy(seed.statusChanges);
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit() {
    for (const listener of this.listeners) listener();
  }

  private live(id: string): StoredApplication {
    const app = this.applications.get(id);
    if (!app || app.deletedAt) throw new NotFoundError("Application", id);
    return app;
  }

  private notesOf(applicationId: string) {
    return newestFirst(
      [...this.notes.values()].filter((note) => note.applicationId === applicationId),
      (note) => note.createdAt,
    );
  }

  private toPublic(app: StoredApplication): Application {
    const rest: Partial<StoredApplication> = copy(app);
    delete rest.deletedAt;
    return rest as Application;
  }

  private summary(app: StoredApplication): ApplicationSummary {
    const notes = this.notesOf(app.id);
    return { ...this.toPublic(app), noteCount: notes.length, latestNote: notes[0] ? copy(notes[0]) : null };
  }

  async list(query: ApplicationsQuery = {}): Promise<ApplicationsPage> {
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    let rows = [...this.applications.values()].filter((app) => !app.deletedAt);

    if (query.search?.trim()) {
      const needle = normalize(query.search);
      rows = rows.filter(
        (app) => normalize(app.company).includes(needle) || normalize(app.position).includes(needle),
      );
    }
    if (query.statuses?.length) {
      const statuses = new Set(query.statuses);
      rows = rows.filter((app) => statuses.has(app.status));
    }
    if (query.sources?.length) {
      const sources = new Set(query.sources);
      rows = rows.filter((app) => app.source !== null && sources.has(app.source));
    }

    const { field, direction } = query.sort ?? { field: "updatedAt", direction: "desc" };
    const sign = direction === "asc" ? 1 : -1;
    const text = (a: string, b: string) => a.localeCompare(b, "ru");
    rows.sort((a, b) => {
      switch (field) {
        case "company":
          return sign * text(a.company, b.company);
        case "status":
          return sign * (APPLICATION_STATUSES.indexOf(a.status) - APPLICATION_STATUSES.indexOf(b.status));
        case "source":
          return compareNullable(a.source, b.source, (x, y) => sign * text(x, y));
        case "appliedAt":
          return compareNullable(a.appliedAt, b.appliedAt, (x, y) => sign * text(x, y));
        case "salary":
          return compareNullable(
            a.salaryMax ?? a.salaryMin,
            b.salaryMax ?? b.salaryMin,
            (x, y) => sign * (x - y),
          );
        case "updatedAt":
          return sign * text(a.updatedAt, b.updatedAt);
      }
    });

    const total = rows.length;
    const lastPage = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(Math.max(1, query.page ?? 1), lastPage);
    const items = rows.slice((page - 1) * pageSize, page * pageSize).map((app) => this.summary(app));
    return { items, total, page, pageSize };
  }

  async listDetailed(query: ApplicationsQuery = {}): Promise<ApplicationDetails[]> {
    const { items } = await this.list({ ...query, page: 1, pageSize: Number.MAX_SAFE_INTEGER });
    const details = await Promise.all(items.map((item) => this.get(item.id)));
    return details.filter((app): app is ApplicationDetails => app !== null);
  }

  async get(id: string): Promise<ApplicationDetails | null> {
    const app = this.applications.get(id);
    if (!app || app.deletedAt) return null;
    const stages = newestFirst(
      [...this.stages.values()].filter((stage) => stage.applicationId === id),
      (stage) => stage.createdAt,
    );
    const statusChanges = newestFirst(
      this.statusChanges.filter((change) => change.applicationId === id),
      (change) => change.changedAt,
    );
    return { ...this.toPublic(app), stages: copy(stages), notes: copy(this.notesOf(id)), statusChanges: copy(statusChanges) };
  }

  async listSources(): Promise<string[]> {
    const sources = new Set<string>();
    for (const app of this.applications.values()) {
      if (!app.deletedAt && app.source) sources.add(app.source);
    }
    return [...sources].sort((a, b) => a.localeCompare(b, "ru"));
  }

  async create(input: Parameters<ApplicationsRepository["create"]>[0]): Promise<Application> {
    const data = applicationInputSchema.parse(input);
    const timestamp = now();
    const app: StoredApplication = {
      id: newId(),
      company: data.company,
      position: data.position,
      status: data.status ?? "sent",
      statusChangedAt: timestamp,
      appliedAt: data.appliedAt ?? null,
      url: data.url ?? null,
      location: data.location ?? null,
      workFormat: data.workFormat ?? null,
      salaryMin: data.salaryMin ?? null,
      salaryMax: data.salaryMax ?? null,
      currency: data.currency ?? null,
      contactName: data.contactName ?? null,
      contactInfo: data.contactInfo ?? null,
      source: data.source ?? null,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    };
    this.applications.set(app.id, app);
    this.statusChanges.push({
      id: newId(),
      applicationId: app.id,
      fromStatus: null,
      toStatus: app.status,
      reason: null,
      changedAt: timestamp,
    });
    this.emit();
    return this.toPublic(app);
  }

  async update(id: string, patch: Parameters<ApplicationsRepository["update"]>[1]): Promise<Application> {
    const app = this.live(id);
    const data = applicationPatchSchema.parse(patch);
    const next = { ...app, ...data, updatedAt: now() };
    applicationPatchSchema.parse({ salaryMin: next.salaryMin, salaryMax: next.salaryMax });
    this.applications.set(id, next);
    this.emit();
    return this.toPublic(next);
  }

  async changeStatus(ids: string[], input: Parameters<ApplicationsRepository["changeStatus"]>[1]) {
    const { status, reason } = statusChangeInputSchema.parse(input);
    const timestamp = now();
    let changed = false;
    for (const id of ids) {
      const app = this.live(id);
      if (app.status === status) continue;
      this.statusChanges.push({
        id: newId(),
        applicationId: id,
        fromStatus: app.status,
        toStatus: status,
        reason,
        changedAt: timestamp,
      });
      this.applications.set(id, { ...app, status, statusChangedAt: timestamp, updatedAt: timestamp });
      changed = true;
    }
    if (changed) this.emit();
  }

  async remove(ids: string[]) {
    const timestamp = now();
    for (const id of ids) {
      const app = this.live(id);
      this.applications.set(id, { ...app, deletedAt: timestamp });
    }
    this.emit();
  }

  async restore(ids: string[]) {
    for (const id of ids) {
      const app = this.applications.get(id);
      if (app?.deletedAt) this.applications.set(id, { ...app, deletedAt: null });
    }
    this.emit();
  }

  async addStage(applicationId: string, input: Parameters<ApplicationsRepository["addStage"]>[1]) {
    this.live(applicationId);
    const data = stageInputSchema.parse(input);
    const interviewKind = data.type === "interview" ? (data.interviewKind ?? null) : null;
    const seq =
      [...this.stages.values()].filter(
        (stage) =>
          stage.applicationId === applicationId &&
          stage.type === data.type &&
          stage.interviewKind === interviewKind,
      ).length + 1;
    const timestamp = now();
    const stage: Stage = {
      id: newId(),
      applicationId,
      type: data.type,
      interviewKind,
      title: data.title ?? null,
      seq,
      scheduledAt: data.scheduledAt ?? null,
      state: data.state ?? "planned",
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.stages.set(stage.id, stage);
    this.emit();
    return copy(stage);
  }

  async updateStage(stageId: string, patch: Parameters<ApplicationsRepository["updateStage"]>[1]) {
    const stage = this.stages.get(stageId);
    if (!stage) throw new NotFoundError("Stage", stageId);
    const data = stagePatchSchema.parse(patch);
    const next: Stage = {
      ...stage,
      ...data,
      interviewKind: stage.type === "interview" ? (data.interviewKind ?? stage.interviewKind) : null,
      updatedAt: now(),
    };
    this.stages.set(stageId, next);
    this.emit();
    return copy(next);
  }

  async removeStage(stageId: string) {
    if (!this.stages.delete(stageId)) throw new NotFoundError("Stage", stageId);
    for (const note of this.notes.values()) {
      if (note.stageId === stageId) this.notes.set(note.id, { ...note, stageId: null });
    }
    this.emit();
  }

  async addNote(applicationId: string, input: Parameters<ApplicationsRepository["addNote"]>[1]) {
    this.live(applicationId);
    const data = noteInputSchema.parse(input);
    const stageId = data.stageId ?? null;
    if (stageId && this.stages.get(stageId)?.applicationId !== applicationId) {
      throw new NotFoundError("Stage", stageId);
    }
    const timestamp = now();
    const note: Note = { id: newId(), applicationId, stageId, body: data.body, createdAt: timestamp, updatedAt: timestamp };
    this.notes.set(note.id, note);
    this.emit();
    return copy(note);
  }

  async updateNote(noteId: string, patch: Parameters<ApplicationsRepository["updateNote"]>[1]) {
    const note = this.notes.get(noteId);
    if (!note) throw new NotFoundError("Note", noteId);
    const data = notePatchSchema.parse(patch);
    const next = { ...note, body: data.body, updatedAt: now() };
    this.notes.set(noteId, next);
    this.emit();
    return copy(next);
  }

  async removeNote(noteId: string) {
    if (!this.notes.delete(noteId)) throw new NotFoundError("Note", noteId);
    this.emit();
  }
}
