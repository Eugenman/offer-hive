import { APPLICATION_STATUSES, canChangeStatus } from "@/lib/domain";
import type {
  Application,
  ApplicationDetails,
  ApplicationSummary,
  Note,
  Stage,
  StatisticsEntry,
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
import { type ApplicationsPage, type ApplicationsRepository, notFound, statusTransitionError } from "./types";

export type StoredApplication = Application & { deletedAt: string | null };
/** `seq` keeps the log order for entries with equal timestamps (e.g. one bulk change). */
export type StoredStatusChange = StatusChange & { seq: number };

/** Starting data, e.g. sample data in tests. */
export type RepositorySeed = {
  applications: Application[];
  stages: Stage[];
  notes: Note[];
  statusChanges: StatusChange[];
};

/** Everything the repository holds, as a storage saves it. */
export type StoreSnapshot = {
  applications: StoredApplication[];
  stages: Stage[];
  notes: Note[];
  statusChanges: StoredStatusChange[];
  /** Statistics entries of applications deleted for good. */
  deletedStatistics: StoredStatisticsEntry[];
};

/** A deleted application's statistics entry, with the moment it was deleted. */
export type StoredStatisticsEntry = StatisticsEntry & { deletedAt: string };

/** Records written or deleted by one operation, per table. */
export type ChangeSet = {
  [T in keyof StoreSnapshot]: { put: StoreSnapshot[T]; delete: string[] };
};

/** Where the data lives between sessions. Without one, the repository keeps data in memory only. */
export type Storage = {
  load(): Promise<StoreSnapshot>;
  save(changes: ChangeSet): Promise<void>;
  /** Calls `reload` when another tab changed the data. Returns an unsubscribe function. */
  onExternalChange?(reload: () => void): () => void;
};

/** Deleted applications stay restorable this long, then they are erased with everything attached. */
export const ARCHIVE_DAYS = 30;

const DAY_MS = 86_400_000;
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

function withoutSeq(change: StoredStatusChange): StatusChange {
  const rest: Partial<StoredStatusChange> = { ...change };
  delete rest.seq;
  return rest as StatusChange;
}

function toPublic(app: StoredApplication): Application {
  const rest: Partial<StoredApplication> = copy(app);
  delete rest.deletedAt;
  return rest as Application;
}

function compareNullable<T>(a: T | null, b: T | null, compare: (x: T, y: T) => number) {
  if (a === null && b === null) return 0;
  if (a === null) return 1; // empty values always go last
  if (b === null) return -1;
  return compare(a, b);
}

/** Rows by id that remember which ids were written or deleted since the last `takeChanges()`. */
function createTable<V extends { id: string }>() {
  const rows = new Map<string, V>();
  const dirty = new Set<string>();
  return {
    get: (id: string) => rows.get(id),
    values: () => [...rows.values()],
    set(row: V) {
      rows.set(row.id, row);
      dirty.add(row.id);
    },
    delete(id: string) {
      dirty.add(id);
      return rows.delete(id);
    },
    clear() {
      for (const id of rows.keys()) dirty.add(id);
      rows.clear();
    },
    /** Replaces the contents without marking anything as changed (loading from storage). */
    load(values: V[]) {
      rows.clear();
      for (const row of values) rows.set(row.id, row);
      dirty.clear();
    },
    takeChanges(): { put: V[]; delete: string[] } {
      const put: V[] = [];
      const deleted: string[] = [];
      for (const id of dirty) {
        const row = rows.get(id);
        if (row) put.push(row);
        else deleted.push(id);
      }
      dirty.clear();
      return { put, delete: deleted };
    },
  };
}

type Options = {
  storage?: Storage;
  seed?: RepositorySeed;
};

/**
 * All application logic over in-memory tables. With a `storage`, the tables are loaded from it on
 * first use and every operation saves exactly the records it changed. If the storage can't be
 * opened (some private modes), the repository keeps working in memory and says so via
 * `isPersistent()`.
 */
export function createApplicationsRepository({ storage, seed }: Options = {}): ApplicationsRepository {
  const applications = createTable<StoredApplication>();
  const stages = createTable<Stage>();
  const notes = createTable<Note>();
  const statusChanges = createTable<StoredStatusChange>();
  const deletedStatistics = createTable<StoredStatisticsEntry>();
  const listeners = new Set<() => void>();
  let nextSeq = 1;
  let persistent = false;
  let ready: Promise<void> | null = null;

  function load(snapshot: StoreSnapshot) {
    applications.load(snapshot.applications);
    stages.load(snapshot.stages);
    notes.load(snapshot.notes);
    const log = [...snapshot.statusChanges].sort((a, b) => a.seq - b.seq);
    statusChanges.load(log);
    nextSeq = (log.at(-1)?.seq ?? 0) + 1;
    deletedStatistics.load(snapshot.deletedStatistics ?? []);
  }

  if (seed) {
    load({
      applications: seed.applications.map((app) => ({ ...copy(app), deletedAt: null })),
      stages: copy(seed.stages),
      notes: copy(seed.notes),
      statusChanges: seed.statusChanges.map((change, index) => ({ ...copy(change), seq: index + 1 })),
      deletedStatistics: [],
    });
  }

  function emit() {
    for (const listener of listeners) listener();
  }

  /** Deletes applications and everything attached to them; Statistics keep an entry for each. */
  function eraseAll(ids: Set<string>) {
    const timestamp = now();
    for (const id of ids) {
      const app = applications.get(id);
      if (!app) continue;
      deletedStatistics.set({ ...statisticsEntry(app), state: "deleted", deletedAt: timestamp });
      applications.delete(id);
    }
    for (const table of [stages, notes, statusChanges]) {
      for (const row of table.values()) if (ids.has(row.applicationId)) table.delete(row.id);
    }
  }

  /** Erases applications that have been in the archive longer than `ARCHIVE_DAYS`. */
  function purgeExpired(at = Date.now()) {
    const limit = new Date(at - ARCHIVE_DAYS * DAY_MS).toISOString();
    const expired = new Set(
      applications
        .values()
        .filter((app) => app.deletedAt !== null && app.deletedAt < limit)
        .map((app) => app.id),
    );
    if (expired.size === 0) return false;
    eraseAll(expired);
    return true;
  }

  /** Saves what the last operation changed, then tells the views. */
  async function commit() {
    const changes: ChangeSet = {
      applications: applications.takeChanges(),
      stages: stages.takeChanges(),
      notes: notes.takeChanges(),
      statusChanges: statusChanges.takeChanges(),
      deletedStatistics: deletedStatistics.takeChanges(),
    };
    if (persistent && storage) {
      try {
        await storage.save(changes);
      } catch (error) {
        // Keep memory in line with what is really saved, then let the caller show the error.
        await storage.load().then(load, () => {});
        throw error;
      }
    }
    emit();
  }

  async function open() {
    if (!storage) return;
    try {
      load(await storage.load());
      persistent = true;
    } catch (error) {
      console.warn("Storage is not available, data will be kept in memory only", error);
      return;
    }
    if (purgeExpired()) await commit();
    storage.onExternalChange?.(() => {
      storage.load().then((snapshot) => {
        load(snapshot);
        emit();
      }, console.error);
    });
  }

  /** Loads the tables on first use: nothing touches storage during server rendering. */
  function ensureReady() {
    ready ??= open();
    return ready;
  }

  function live(id: string): StoredApplication {
    const app = applications.get(id);
    if (!app || app.deletedAt) throw notFound("Application", id);
    return app;
  }

  function notesOf(applicationId: string) {
    return newestFirst(
      notes.values().filter((note) => note.applicationId === applicationId),
      (note) => note.createdAt,
    );
  }

  /** The application's log in insertion order. */
  function changesOf(applicationId: string) {
    return statusChanges.values().filter((change) => change.applicationId === applicationId);
  }

  /** Newest change that can be undone (the "created with" entry cannot). */
  function lastChange(applicationId: string) {
    const change = changesOf(applicationId).at(-1);
    return change && change.fromStatus !== null ? change : null;
  }

  function logChange(change: Omit<StatusChange, "id">) {
    statusChanges.set({ id: newId(), ...change, seq: nextSeq++ });
  }

  function details(app: StoredApplication): ApplicationDetails {
    const appStages = newestFirst(
      stages.values().filter((stage) => stage.applicationId === app.id),
      (stage) => stage.createdAt,
    );
    return {
      ...toPublic(app),
      previousStatus: lastChange(app.id)?.fromStatus ?? null,
      stages: copy(appStages),
      notes: copy(notesOf(app.id)),
      statusChanges: newestFirst(changesOf(app.id), (change) => change.changedAt).map(withoutSeq),
    };
  }

  const erasedAt = (deletedAt: string) =>
    new Date(Date.parse(deletedAt) + ARCHIVE_DAYS * DAY_MS).toISOString();

  function statisticsEntry(app: StoredApplication): StatisticsEntry {
    const reached = new Set(changesOf(app.id).map((change) => change.toStatus));
    reached.add(app.status);
    return {
      id: app.id,
      company: app.company,
      position: app.position,
      source: app.source,
      appliedAt: app.appliedAt,
      status: app.status,
      reached: [...reached],
      state: app.deletedAt ? "archived" : "active",
    };
  }

  function summary(app: StoredApplication): ApplicationSummary {
    const appNotes = notesOf(app.id);
    return {
      ...toPublic(app),
      previousStatus: lastChange(app.id)?.fromStatus ?? null,
      noteCount: appNotes.length,
      latestNote: appNotes[0] ? copy(appNotes[0]) : null,
    };
  }

  const repository: ApplicationsRepository = {
    async isPersistent() {
      await ensureReady();
      return persistent;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    async list(query = {}): Promise<ApplicationsPage> {
      await ensureReady();
      const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
      let rows = applications.values().filter((app) => !app.deletedAt);

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
      const text = (a: string, b: string) => a.localeCompare(b, "en");
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
      const items = rows.slice((page - 1) * pageSize, page * pageSize).map(summary);
      return { items, total, page, pageSize };
    },

    async listDetailed(query = {}): Promise<ApplicationDetails[]> {
      const { items } = await repository.list({ ...query, page: 1, pageSize: Number.MAX_SAFE_INTEGER });
      const details = await Promise.all(items.map((item) => repository.get(item.id)));
      return details.filter((app): app is ApplicationDetails => app !== null);
    },

    async get(id) {
      await ensureReady();
      const app = applications.get(id);
      if (!app || app.deletedAt) return null;
      return details(app);
    },

    async listForStatistics() {
      await ensureReady();
      const deleted = deletedStatistics.values().map((entry): StatisticsEntry => {
        const rest: Partial<StoredStatisticsEntry> = { ...entry };
        delete rest.deletedAt;
        return rest as StatisticsEntry;
      });
      return [...applications.values().map(statisticsEntry), ...deleted];
    },

    async getArchived(id) {
      await ensureReady();
      const app = applications.get(id);
      if (!app?.deletedAt) return null;
      return { ...details(app), deletedAt: app.deletedAt, erasedAt: erasedAt(app.deletedAt) };
    },

    async listSources() {
      await ensureReady();
      const sources = new Set<string>();
      for (const app of applications.values()) {
        if (!app.deletedAt && app.source) sources.add(app.source);
      }
      return [...sources].sort((a, b) => a.localeCompare(b, "en"));
    },

    async listDeleted() {
      await ensureReady();
      return applications
        .values()
        .filter((app): app is StoredApplication & { deletedAt: string } => app.deletedAt !== null)
        .sort((a, b) => b.deletedAt.localeCompare(a.deletedAt))
        .map((app) => ({
          ...toPublic(app),
          deletedAt: app.deletedAt,
          erasedAt: erasedAt(app.deletedAt),
        }));
    },

    async create(input) {
      await ensureReady();
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
      applications.set(app);
      logChange({
        applicationId: app.id,
        fromStatus: null,
        toStatus: app.status,
        reason: null,
        changedAt: timestamp,
      });
      await commit();
      return toPublic(app);
    },

    async update(id, patch) {
      await ensureReady();
      const app = live(id);
      const data = applicationPatchSchema.parse(patch);
      const next = { ...app, ...data, updatedAt: now() };
      applicationPatchSchema.parse({ salaryMin: next.salaryMin, salaryMax: next.salaryMax });
      applications.set(next);
      await commit();
      return toPublic(next);
    },

    async changeStatus(ids, input, options = {}) {
      await ensureReady();
      const { status, reason } = statusChangeInputSchema.parse(input);
      // Check every record first, so a bulk change is all or nothing.
      for (const id of ids) {
        const app = live(id);
        if (app.status !== status && !options.ignoreRules && !canChangeStatus(app.status, status)) {
          throw statusTransitionError(app.status, status);
        }
      }
      const timestamp = now();
      let changed = false;
      for (const id of ids) {
        const app = live(id);
        if (app.status === status) continue;
        logChange({
          applicationId: id,
          fromStatus: app.status,
          toStatus: status,
          reason,
          changedAt: timestamp,
        });
        applications.set({ ...app, status, statusChangedAt: timestamp, updatedAt: timestamp });
        changed = true;
      }
      if (changed) await commit();
    },

    async revertStatus(ids) {
      await ensureReady();
      const reverts = ids.map((id) => {
        live(id);
        const change = lastChange(id);
        if (!change) throw notFound("Status change to undo", id);
        return change;
      });
      const timestamp = now();
      for (const change of reverts) {
        statusChanges.delete(change.id);
        const app = live(change.applicationId);
        // The status is now as old as the log entry that set it.
        const previous = changesOf(app.id).at(-1);
        applications.set({
          ...app,
          status: change.fromStatus!,
          statusChangedAt: previous?.changedAt ?? app.createdAt,
          updatedAt: timestamp,
        });
      }
      await commit();
    },

    async remove(ids) {
      await ensureReady();
      const timestamp = now();
      for (const id of ids) applications.set({ ...live(id), deletedAt: timestamp });
      await commit();
    },

    async restore(ids) {
      await ensureReady();
      for (const id of ids) {
        const app = applications.get(id);
        if (app?.deletedAt) applications.set({ ...app, deletedAt: null });
      }
      await commit();
    },

    async erase(ids) {
      await ensureReady();
      // Only archived applications can be erased; live ones must go through the archive first.
      eraseAll(new Set(ids.filter((id) => applications.get(id)?.deletedAt)));
      await commit();
    },

    async addStage(applicationId, input) {
      await ensureReady();
      live(applicationId);
      const data = stageInputSchema.parse(input);
      const interviewKind = data.type === "interview" ? (data.interviewKind ?? null) : null;
      const seq =
        stages
          .values()
          .filter(
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
      stages.set(stage);
      await commit();
      return copy(stage);
    },

    async updateStage(stageId, patch) {
      await ensureReady();
      const stage = stages.get(stageId);
      if (!stage) throw notFound("Stage", stageId);
      const data = stagePatchSchema.parse(patch);
      const next: Stage = {
        ...stage,
        ...data,
        interviewKind: stage.type === "interview" ? (data.interviewKind ?? stage.interviewKind) : null,
        updatedAt: now(),
      };
      stages.set(next);
      await commit();
      return copy(next);
    },

    async removeStage(stageId) {
      await ensureReady();
      if (!stages.delete(stageId)) throw notFound("Stage", stageId);
      for (const note of notes.values()) {
        if (note.stageId === stageId) notes.set({ ...note, stageId: null });
      }
      await commit();
    },

    async addNote(applicationId, input) {
      await ensureReady();
      live(applicationId);
      const data = noteInputSchema.parse(input);
      const stageId = data.stageId ?? null;
      if (stageId && stages.get(stageId)?.applicationId !== applicationId) throw notFound("Stage", stageId);
      const timestamp = now();
      const note: Note = {
        id: newId(),
        applicationId,
        stageId,
        body: data.body,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      notes.set(note);
      await commit();
      return copy(note);
    },

    async updateNote(noteId, patch) {
      await ensureReady();
      const note = notes.get(noteId);
      if (!note) throw notFound("Note", noteId);
      const data = notePatchSchema.parse(patch);
      const next = { ...note, body: data.body, updatedAt: now() };
      notes.set(next);
      await commit();
      return copy(next);
    },

    async removeNote(noteId) {
      await ensureReady();
      if (!notes.delete(noteId)) throw notFound("Note", noteId);
      await commit();
    },

    async clear() {
      await ensureReady();
      applications.clear();
      stages.clear();
      notes.clear();
      statusChanges.clear();
      deletedStatistics.clear();
      await commit();
    },
  };

  return repository;
}
