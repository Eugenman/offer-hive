import Dexie, { type EntityTable } from "dexie";
import type { Note, Stage } from "@/lib/domain";
import type {
  ChangeSet,
  Storage,
  StoredApplication,
  StoredStatisticsEntry,
  StoredStatusChange,
} from "./repository";

const TABLES = ["applications", "stages", "notes", "statusChanges", "deletedStatistics"] as const;

type IndexedDbImplementation = { indexedDB: IDBFactory; IDBKeyRange: typeof IDBKeyRange };

type OfferhiveDatabase = Dexie & {
  applications: EntityTable<StoredApplication, "id">;
  stages: EntityTable<Stage, "id">;
  notes: EntityTable<Note, "id">;
  statusChanges: EntityTable<StoredStatusChange, "id">;
  deletedStatistics: EntityTable<StoredStatisticsEntry, "id">;
};

function createDatabase(name: string, idb?: IndexedDbImplementation) {
  const db = new Dexie(name, idb) as OfferhiveDatabase;
  // Schema history. A change of indexes or data shape gets a new version() with an upgrade();
  // existing versions are never edited, so data saved by an older release always opens.
  db.version(1).stores({
    applications: "id, deletedAt",
    stages: "id, applicationId",
    notes: "id, applicationId",
    statusChanges: "id, applicationId, seq",
  });
  // v2: applications deleted for good leave their statistics entry here.
  db.version(2).stores({ deletedStatistics: "id" });
  return db;
}

type Options = {
  /** Database name; tests use a fresh one each time. */
  name?: string;
  /** IndexedDB implementation; tests pass fake-indexeddb. */
  idb?: IndexedDbImplementation;
  /** Tells other tabs about changes. Off in tests. */
  broadcast?: boolean;
};

/** Asks the browser not to evict the data under storage pressure. */
function requestPersistence() {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) return;
  navigator.storage.persisted().then((done) => done || navigator.storage.persist(), console.warn);
}

/**
 * Keeps applications in the browser's IndexedDB, so they survive reloads.
 * The database opens on the first `load()`, never during server rendering.
 */
export function indexedDbStorage({ name = "offerhive", idb, broadcast = true }: Options = {}): Storage {
  const db = createDatabase(name, idb);
  const channel =
    broadcast && typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("offerhive-data") : null;
  let persistenceRequested = false;

  return {
    async load() {
      const [applications, stages, notes, statusChanges, deletedStatistics] = await db.transaction(
        "r",
        [...TABLES],
        () =>
          Promise.all([
            db.applications.toArray(),
            db.stages.toArray(),
            db.notes.toArray(),
            db.statusChanges.toArray(),
            db.deletedStatistics.toArray(),
          ]),
      );
      return { applications, stages, notes, statusChanges, deletedStatistics };
    },

    /** Writes one operation's changes in a single transaction. */
    async save(changes: ChangeSet) {
      await db.transaction("rw", [...TABLES], async () => {
        for (const table of TABLES) {
          const { put, delete: deleted } = changes[table];
          // EntityTable is typed per table; the loop is safe because `changes` mirrors the tables.
          const store = db[table] as unknown as EntityTable<{ id: string }, "id">;
          if (put.length) await store.bulkPut(put);
          if (deleted.length) await store.bulkDelete(deleted);
        }
      });
      channel?.postMessage("changed");
      // After the first save: a site with real data is worth keeping.
      if (!persistenceRequested) {
        persistenceRequested = true;
        requestPersistence();
      }
    },

    onExternalChange(reload) {
      if (!channel) return () => {};
      channel.onmessage = reload;
      return () => {
        channel.onmessage = null;
      };
    },
  };
}
