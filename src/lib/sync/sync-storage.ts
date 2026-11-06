import Dexie, { type EntityTable } from "dexie";
import type { ChangeSet, Storage, StoreSnapshot } from "@/lib/repository/repository";
import { loadUserData, pushChanges, type PushResult } from "./actions";

// The server is the main store. The browser keeps only a queue of changes the server hasn't
// confirmed yet. Every save goes into the queue first, then to the server, and leaves the queue
// only after the server says ok: with a network that takes a moment, without one the queue waits.
// The queue survives closing the tab. One tab at a time sends it (Web Locks), oldest first.

/** idle: everything is on the server. offline / error: changes wait and will be retried. */
export type SyncStatus = "idle" | "syncing" | "offline" | "error";

export type SyncStorage = Storage & {
  getStatus(): SyncStatus;
  subscribeStatus(listener: () => void): () => void;
  /** Changes of the signed-in account that haven't reached the server yet. */
  pendingCount(): Promise<number>;
  /** Drops this account's unsent changes, e.g. after the account was deleted. */
  discardPending(): Promise<void>;
};

type QueuedChange = { seq: number; userId: string; changes: ChangeSet };

type QueueDatabase = Dexie & { queue: EntityTable<QueuedChange, "seq"> };

function createDatabase() {
  const db = new Dexie("offerhive-sync") as QueueDatabase;
  // Existing versions are never edited; a new shape gets a new version().
  db.version(1).stores({ queue: "++seq, userId" });
  return db;
}

const LOCK = "offerhive-sync";
const FIRST_RETRY_MS = 2_000;
const LAST_RETRY_MS = 60_000;

type Options = {
  /** The server refused a change for good; the data is reloaded right after. */
  onRejected: () => void;
  /** The session ended: the queue stays and is sent after the next sign-in to the same account. */
  onSignedOut: () => void;
};

/** Runs `task` while holding the queue lock, so tabs don't send or read the queue at once. */
function withLock<T>(task: () => Promise<T>): Promise<T> {
  if (typeof navigator === "undefined" || !navigator.locks) return task();
  return navigator.locks.request(LOCK, task) as Promise<T>;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const isOffline = () => typeof navigator !== "undefined" && !navigator.onLine;

/** The server's data with the queued changes on top, oldest first. */
function withQueued(snapshot: StoreSnapshot, queued: QueuedChange[]): StoreSnapshot {
  const tables = Object.keys(snapshot) as (keyof StoreSnapshot)[];
  const rows = Object.fromEntries(
    tables.map((table) => [table, new Map(snapshot[table].map((row) => [row.id, row]))]),
  ) as { [T in keyof StoreSnapshot]: Map<string, StoreSnapshot[T][number]> };
  for (const { changes } of queued) {
    for (const table of tables) {
      const map = rows[table] as Map<string, { id: string }>;
      for (const row of changes[table].put) map.set(row.id, row);
      for (const id of changes[table].delete) map.delete(id);
    }
  }
  return Object.fromEntries(tables.map((table) => [table, [...rows[table].values()]])) as StoreSnapshot;
}

const isEmpty = (changes: ChangeSet) =>
  Object.values(changes).every(({ put, delete: deleted }) => put.length === 0 && deleted.length === 0);

export function syncStorage({ onRejected, onSignedOut }: Options): SyncStorage {
  const db = createDatabase();
  const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("offerhive-data") : null;
  const statusListeners = new Set<() => void>();
  let status: SyncStatus = "syncing";
  let userId: string | null = null;
  let reload: (() => void) | null = null;
  let sending: Promise<void> | null = null;
  let sendAgain = false;
  let retryDelay = FIRST_RETRY_MS;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  function setStatus(next: SyncStatus) {
    if (next === status) return;
    status = next;
    for (const listener of statusListeners) listener();
  }

  function retryLater() {
    setStatus(isOffline() ? "offline" : "error");
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = setTimeout(() => void send(), retryDelay);
    retryDelay = Math.min(retryDelay * 2, LAST_RETRY_MS);
  }

  if (typeof window !== "undefined") {
    window.addEventListener("online", () => {
      retryDelay = FIRST_RETRY_MS;
      void send();
    });
    window.addEventListener("offline", () => {
      if (status !== "idle") setStatus("offline");
    });
  }

  /** Sends the queue, oldest first, until it is empty or the server can't be reached. */
  async function sendQueue(): Promise<void> {
    if (!userId) return;
    const owner = userId;
    let rejected = false;
    await withLock(async () => {
      for (;;) {
        const next = await db.queue.where("userId").equals(owner).first();
        if (!next) {
          retryDelay = FIRST_RETRY_MS;
          setStatus("idle");
          return;
        }
        setStatus("syncing");
        let result: PushResult;
        try {
          result = await pushChanges(next.changes);
        } catch {
          result = { ok: false, reason: "failed" };
        }
        if (result.ok) {
          await db.queue.delete(next.seq);
        } else if (result.reason === "failed") {
          retryLater();
          return;
        } else if (result.reason === "signed_out") {
          setStatus("error");
          onSignedOut();
          return;
        } else {
          // "invalid" or "forbidden": a retry gives the same answer.
          await db.queue.delete(next.seq);
          rejected = true;
        }
      }
    });
    // Reloading reads the queue under the same lock, so it waits until the lock is free.
    if (rejected) {
      onRejected();
      reload?.();
    }
  }

  /** One send at a time per tab; a save during a send triggers one more pass. */
  function send(): Promise<void> {
    if (sending) {
      sendAgain = true;
      return sending;
    }
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    sending = sendQueue().finally(() => {
      sending = null;
      if (sendAgain) {
        sendAgain = false;
        void send();
      }
    });
    return sending;
  }

  return {
    async load() {
      for (let attempt = 0; ; attempt++) {
        setStatus("syncing");
        // Under the lock: no tab removes a sent change between reading the server and the queue.
        const loaded = await withLock(async () => {
          const result = await loadUserData().catch((error: unknown) => {
            console.warn("Couldn’t load data, will retry", error);
            return null;
          });
          if (!result) {
            console.warn("Couldn’t load data, will retry");
            return null;
          }
          if (!result.ok) return result;
          const queued = await db.queue.where("userId").equals(result.userId).toArray();
          return { userId: result.userId, snapshot: withQueued(result.data, queued) };
        });
        if (loaded && "snapshot" in loaded) {
          userId = loaded.userId;
          void send();
          return loaded.snapshot;
        }
        if (loaded && !loaded.ok) {
          onSignedOut();
          // The page is leaving for the sign-in screen.
          return new Promise<never>(() => {});
        }
        setStatus(isOffline() ? "offline" : "error");
        await sleep(Math.min(FIRST_RETRY_MS * 2 ** attempt, LAST_RETRY_MS));
      }
    },

    async save(changes) {
      if (isEmpty(changes)) return;
      if (!userId) throw new Error("Data isn't loaded yet");
      await db.queue.add({ userId, changes } as QueuedChange);
      channel?.postMessage("changed");
      setStatus("syncing");
      void send();
    },

    onExternalChange(onChange) {
      reload = onChange;
      if (channel) channel.onmessage = onChange;
      return () => {
        reload = null;
        if (channel) channel.onmessage = null;
      };
    },

    getStatus: () => status,

    subscribeStatus(listener) {
      statusListeners.add(listener);
      return () => statusListeners.delete(listener);
    },

    async discardPending() {
      if (userId) await db.queue.where("userId").equals(userId).delete();
    },

    async pendingCount() {
      return userId ? db.queue.where("userId").equals(userId).count() : 0;
    },
  };
}
