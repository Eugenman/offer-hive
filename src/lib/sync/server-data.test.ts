import { beforeAll, afterAll, beforeEach, describe, expect, test } from "bun:test";
import { mock } from "bun:test";
import type { Stage } from "@/lib/domain";
import type { ChangeSet, StoredApplication, StoredStatisticsEntry } from "@/lib/repository/repository";
import type { ValidChangeSet } from "./payload";

// Server side of the sync: a batch from the browser is applied all or nothing, may safely be sent
// twice, and can never touch another account's rows. Needs a real Postgres — `text[]`, constraints
// and transactions are the point of these tests.
//
// Set TEST_DATABASE_URL to run them (a throwaway database: the tests empty the tables).
// Server modules guard themselves with "server-only", which throws outside React Server
// Components; here the tests are the server, so the guard is neutralised for this file only.
mock.module("server-only", () => ({}));

const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;

const { getDb } = await import("@/lib/db");
const schema = await import("@/lib/db/schema");
const { applyChanges, isSyncError, loadSnapshot } = await import("./server-data");
const { changeSetSchema } = await import("./payload");

const USER_A = "test-user-a";
const USER_B = "test-user-b";
const now = "2026-11-06T10:00:00.000Z";

/** The server payload accepts only UUIDs, so the fixtures use valid ones. */
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

function application(id: string, over: Partial<StoredApplication> = {}): StoredApplication {
  return {
    id,
    company: "Acme",
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
    ...over,
  };
}

function changes(over: Partial<ChangeSet> = {}): ValidChangeSet {
  const empty = { put: [], delete: [] };
  return changeSetSchema.parse({
    applications: empty,
    stages: empty,
    notes: empty,
    statusChanges: empty,
    deletedStatistics: empty,
    ...over,
  });
}

const db = () => getDb();

/** Runs a batch and gives back what it threw, so a rejection can be inspected instead of escaping. */
async function failure(run: Promise<unknown>): Promise<unknown> {
  try {
    await run;
    return null;
  } catch (error) {
    return error;
  }
}

describe.skipIf(!url)("applying a batch from the browser", () => {
  beforeAll(async () => {
    for (const id of [USER_A, USER_B]) {
      await db()
        .insert(schema.users)
        .values({ id, name: "", email: `${id}@example.com` })
        .onConflictDoNothing();
    }
  });

  beforeEach(async () => {
    await db().delete(schema.applications);
    await db().delete(schema.deletedStatistics);
  });

  afterAll(async () => {
    await db().delete(schema.users);
    await (db() as unknown as { $client: { end: (options?: object) => Promise<void> } }).$client.end({
      timeout: 5,
    });
  });

  test("an application sent once comes back from the snapshot", async () => {
    await applyChanges(db(), USER_A, changes({ applications: { put: [application(uuid(1))], delete: [] } }));

    const snapshot = await loadSnapshot(db(), USER_A);
    expect(snapshot.applications.map((app) => app.id)).toEqual([uuid(1)]);
    expect(snapshot.applications[0].createdAt).toBe(now);
  });

  test("sending the same batch twice writes it once", async () => {
    const batch = changes({ applications: { put: [application(uuid(2))], delete: [] } });
    await applyChanges(db(), USER_A, batch);
    await applyChanges(db(), USER_A, batch);

    const snapshot = await loadSnapshot(db(), USER_A);
    expect(snapshot.applications).toHaveLength(1);
  });

  test("an id that belongs to another account is refused", async () => {
    await applyChanges(db(), USER_B, changes({ applications: { put: [application(uuid(5))], delete: [] } }));

    const attempt = applyChanges(
      db(),
      USER_A,
      changes({ applications: { put: [application(uuid(5))], delete: [] } }),
    );
    const error = await failure(attempt);
    expect(isSyncError(error, "forbidden")).toBe(true);
    expect((await loadSnapshot(db(), USER_B)).applications[0].company).toBe("Acme");
  });

  test("a reference to another account's application is refused", async () => {
    const theirs = application(uuid(6));
    await applyChanges(db(), USER_B, changes({ applications: { put: [theirs], delete: [] } }));

    const stage: Stage = {
      id: uuid(11),
      applicationId: uuid(6),
      type: "interview",
      interviewKind: "technical",
      title: null,
      seq: 1,
      scheduledAt: null,
      state: "planned",
      createdAt: now,
      updatedAt: now,
    };
    const attempt = applyChanges(db(), USER_A, changes({ stages: { put: [stage], delete: [] } }));
    const error = await failure(attempt);
    expect(isSyncError(error, "forbidden")).toBe(true);
  });

  test("a batch that fails half way leaves nothing behind", async () => {
    const orphanStage: Stage = {
      id: uuid(12),
      applicationId: uuid(99),
      type: "interview",
      interviewKind: null,
      title: null,
      seq: 1,
      scheduledAt: null,
      state: "planned",
      createdAt: now,
      updatedAt: now,
    };
    const attempt = applyChanges(
      db(),
      USER_A,
      changes({
        applications: { put: [application(uuid(3))], delete: [] },
        stages: { put: [orphanStage], delete: [] },
      }),
    );

    const error = await failure(attempt);
    expect(error).not.toBeNull();
    expect((await loadSnapshot(db(), USER_A)).applications).toHaveLength(0);
  });

  test("a delete removes only the account's own rows", async () => {
    await applyChanges(db(), USER_A, changes({ applications: { put: [application(uuid(4))], delete: [] } }));

    // Another account deleting the same id does nothing.
    await applyChanges(db(), USER_B, changes({ applications: { put: [], delete: [uuid(4)] } }));
    expect((await loadSnapshot(db(), USER_A)).applications).toHaveLength(1);

    await applyChanges(db(), USER_A, changes({ applications: { put: [], delete: [uuid(4)] } }));
    expect((await loadSnapshot(db(), USER_A)).applications).toHaveLength(0);
  });

  test("statistics of erased applications are stored and returned as deleted", async () => {
    const entry: StoredStatisticsEntry = {
      id: uuid(7),
      company: "Old",
      position: "Dev",
      source: null,
      appliedAt: null,
      status: "rejected",
      reached: ["sent", "rejected"],
      state: "deleted",
      deletedAt: now,
    };
    await applyChanges(db(), USER_A, changes({ deletedStatistics: { put: [entry], delete: [] } }));

    const snapshot = await loadSnapshot(db(), USER_A);
    expect(snapshot.deletedStatistics).toEqual([entry]);
  });
});
