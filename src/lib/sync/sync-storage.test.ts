import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import "fake-indexeddb/auto";
import type { ChangeSet, StoredApplication, StoreSnapshot } from "@/lib/repository/repository";
import type { PushResult } from "./actions";

// The queue is the only thing between a click and the server: every change goes into IndexedDB
// first and leaves it only after the server confirms. These tests run it against fake-indexeddb
// with the server actions replaced by an in-memory stand-in.

const EMPTY: StoreSnapshot = {
  applications: [],
  stages: [],
  notes: [],
  statusChanges: [],
  deletedStatistics: [],
};

const clone = <T>(value: T): T => structuredClone(value);

type Tables = keyof StoreSnapshot;

function applyChanges(data: StoreSnapshot, changes: ChangeSet) {
  for (const name of Object.keys(changes) as Tables[]) {
    const rows = new Map<string, { id: string }>(
      (data[name] as { id: string }[]).map((row) => [row.id, row]),
    );
    for (const row of changes[name].put as { id: string }[]) rows.set(row.id, row);
    for (const id of changes[name].delete) rows.delete(id);
    (data as unknown as Record<Tables, { id: string }[]>)[name] = [...rows.values()];
  }
}

let serverData: StoreSnapshot = clone(EMPTY);
let currentUser = "u0";
let loadCalls = 0;
let pushCalls: ChangeSet[] = [];
let pushResult: PushResult = { ok: true };

mock.module("./actions", () => ({
  loadUserData: async () => {
    loadCalls += 1;
    return { ok: true as const, userId: currentUser, data: clone(serverData) };
  },
  pushChanges: async (changes: ChangeSet) => {
    pushCalls.push(clone(changes));
    if (pushResult.ok) applyChanges(serverData, changes);
    return pushResult;
  },
}));

// Dexie checks for IndexedDB when its module is evaluated, so it is loaded after the fake globals.
const { syncStorage } = await import("./sync-storage");

let userSeq = 0;
const nextUser = () => `user-${++userSeq}`;

function storedApp(id: string): StoredApplication {
  const now = new Date().toISOString();
  return {
    id,
    company: `Company ${id}`,
    position: "Developer",
    status: "sent",
    statusChangedAt: now,
    appliedAt: null,
    url: null,
    location: null,
    workFormat: null,
    salaryMin: null,
    salaryMax: null,
    currency: null,
    contactName: null,
    contactInfo: null,
    source: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
}

function batchFor(app: StoredApplication): ChangeSet {
  return {
    applications: { put: [app], delete: [] },
    stages: { put: [], delete: [] },
    notes: { put: [], delete: [] },
    statusChanges: { put: [], delete: [] },
    deletedStatistics: { put: [], delete: [] },
  };
}

/** Every storage opened by a test, so its queue can be dropped before the next one starts. */
const opened: { discardPending(): Promise<void> }[] = [];

function open(user = nextUser()) {
  currentUser = user;
  const events: string[] = [];
  const storage = syncStorage({
    onRejected: () => events.push("rejected"),
    onSignedOut: () => events.push("signedOut"),
  });
  opened.push(storage);
  return { storage, events };
}

// A retry scheduled by one test must not send anything during the next one.
afterEach(async () => {
  for (const storage of opened.splice(0)) await storage.discardPending();
});

async function waitFor(check: () => Promise<boolean>, timeout = 1500) {
  const start = Date.now();
  for (;;) {
    if (await check()) return;
    if (Date.now() - start > timeout) throw new Error("timed out");
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

beforeEach(() => {
  serverData = clone(EMPTY);
  loadCalls = 0;
  pushCalls = [];
  pushResult = { ok: true };
});

describe("loading", () => {
  test("the server snapshot comes back", async () => {
    serverData = { ...clone(EMPTY), applications: [storedApp("a1")] };
    const { storage } = open();

    const snapshot = await storage.load();
    expect(snapshot.applications.map((app) => app.id)).toEqual(["a1"]);
    expect(loadCalls).toBe(1);
  });

  test("a queued change is applied over the server data", async () => {
    const user = nextUser();
    // First session: the push fails, so the batch stays in the queue.
    pushResult = { ok: false, reason: "failed" };
    const first = open(user).storage;
    await first.load();
    await first.save(batchFor(storedApp("pending")));
    await waitFor(async () => (await first.pendingCount()) === 1);

    // Second session, same account: the server does not know about it yet.
    pushResult = { ok: true };
    const second = open(user).storage;
    const snapshot = await second.load();
    expect(snapshot.applications.map((app) => app.id)).toContain("pending");
  });
});

describe("saving", () => {
  test("a change leaves the queue only after the server confirms it", async () => {
    const { storage } = open();
    await storage.load();

    await storage.save(batchFor(storedApp("a1")));
    expect(await storage.pendingCount()).toBe(1);

    await waitFor(async () => (await storage.pendingCount()) === 0);
    expect(pushCalls).toHaveLength(1);
    expect(pushCalls[0].applications.put[0].id).toBe("a1");
  });

  test("batches are sent oldest first", async () => {
    const { storage } = open();
    await storage.load();

    await storage.save(batchFor(storedApp("first")));
    await storage.save(batchFor(storedApp("second")));

    await waitFor(async () => pushCalls.length === 2);
    expect(pushCalls.map((changes) => changes.applications.put[0].id)).toEqual(["first", "second"]);
  });

  test("a rejected batch is dropped, reported and the data is reloaded", async () => {
    const { storage, events } = open();
    await storage.load();
    let reloads = 0;
    storage.onExternalChange?.(() => {
      reloads += 1;
    });

    pushResult = { ok: false, reason: "invalid" };
    await storage.save(batchFor(storedApp("bad")));

    await waitFor(async () => events.includes("rejected"));
    await waitFor(async () => (await storage.pendingCount()) === 0);
    // The queue cannot be trusted any more, so the views are told to fetch everything again.
    await waitFor(async () => reloads > 0);
  });

  test("a failed batch stays queued for a retry", async () => {
    const { storage, events } = open();
    await storage.load();

    pushResult = { ok: false, reason: "failed" };
    await storage.save(batchFor(storedApp("waiting")));

    await waitFor(async () => (await storage.pendingCount()) === 1);
    expect(events).not.toContain("rejected");
    expect(storage.getStatus()).not.toBe("idle");
  });

  test("a signed out answer asks for a new sign-in and keeps the queue", async () => {
    const { storage, events } = open();
    await storage.load();

    pushResult = { ok: false, reason: "signed_out" };
    await storage.save(batchFor(storedApp("kept")));

    await waitFor(async () => events.includes("signedOut"));
    expect(await storage.pendingCount()).toBe(1);
  });
});

describe("accounts", () => {
  test("a change of the other account is never sent", async () => {
    const first = open().storage;
    await first.load();
    pushResult = { ok: false, reason: "failed" };
    await first.save(batchFor(storedApp("theirs")));
    await waitFor(async () => (await first.pendingCount()) === 1);

    pushResult = { ok: true };
    const pushesBefore = pushCalls.length;
    const second = open().storage;
    await second.load();
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(pushCalls).toHaveLength(pushesBefore);
    expect(await second.pendingCount()).toBe(0);
  });

  test("dropping the unsent changes empties only this account's queue", async () => {
    const user = nextUser();
    const { storage } = open(user);
    await storage.load();
    pushResult = { ok: false, reason: "failed" };
    await storage.save(batchFor(storedApp("mine")));
    await waitFor(async () => (await storage.pendingCount()) === 1);

    await storage.discardPending();
    expect(await storage.pendingCount()).toBe(0);
  });
});
