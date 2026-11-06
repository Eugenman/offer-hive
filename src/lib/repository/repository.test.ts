import { describe, expect, test } from "bun:test";
import { SAMPLE_DATA } from "@/test/sample-data";
import {
  ARCHIVE_DAYS,
  createApplicationsRepository,
  type ChangeSet,
  type StoredApplication,
  type Storage,
  type StoreSnapshot,
} from "./repository";
import { isRepositoryError } from "./types";

// The repository is storage-agnostic: it takes a Storage object, so every rule below can be
// exercised with a plain in-memory object — no browser, no IndexedDB, no database.

const EMPTY: StoreSnapshot = {
  applications: [],
  stages: [],
  notes: [],
  statusChanges: [],
  deletedStatistics: [],
};

const clone = <T>(value: T): T => structuredClone(value);

type TableName = keyof StoreSnapshot;

function applyChanges(data: StoreSnapshot, changes: ChangeSet) {
  for (const name of Object.keys(changes) as TableName[]) {
    const rows = new Map<string, { id: string }>(
      (data[name] as { id: string }[]).map((row) => [row.id, row]),
    );
    for (const row of changes[name].put as { id: string }[]) rows.set(row.id, row);
    for (const id of changes[name].delete) rows.delete(id);
    (data as unknown as Record<TableName, { id: string }[]>)[name] = [...rows.values()];
  }
}

/** A storage that keeps the snapshot in a variable and records every write. */
function memoryStorage(initial: StoreSnapshot = clone(EMPTY)) {
  const data = clone(initial);
  const saved: ChangeSet[] = [];
  const storage: Storage = {
    load: async () => clone(data),
    save: async (changes) => {
      saved.push(clone(changes));
      applyChanges(data, changes);
    },
  };
  return { storage, saved, data: () => clone(data) };
}

const DAY = 86_400_000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY).toISOString();

function storedApp(over: Partial<StoredApplication> & { id: string }): StoredApplication {
  const now = new Date().toISOString();
  return {
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

/** Makes `updatedAt` differ between two operations made in the same millisecond. */
const tick = () => new Promise((resolve) => setTimeout(resolve, 2));

describe("creating and reading", () => {
  test("a new application starts as sent, with an opening status log entry", async () => {
    const repository = createApplicationsRepository();
    const app = await repository.create({ company: "Acme", position: "Developer" });

    expect(app.status).toBe("sent");
    expect(app.appliedAt).toBeNull();

    const details = await repository.get(app.id);
    expect(details?.statusChanges).toHaveLength(1);
    expect(details?.statusChanges[0]).toMatchObject({ fromStatus: null, toStatus: "sent" });
    expect(details?.previousStatus).toBeNull();
  });

  test("company and position are required", async () => {
    const repository = createApplicationsRepository();
    await expect(repository.create({ company: "", position: "Developer" })).rejects.toThrow();
    await expect(repository.create({ company: "Acme" } as never)).rejects.toThrow();
  });

  test("an unknown id is null, not an error", async () => {
    const repository = createApplicationsRepository();
    expect(await repository.get("nope")).toBeNull();
  });
});

describe("updating fields", () => {
  test("a patch changes only what it names", async () => {
    const repository = createApplicationsRepository();
    const app = await repository.create({ company: "Acme", position: "Developer" });
    const updated = await repository.update(app.id, { location: "Berlin" });

    expect(updated.location).toBe("Berlin");
    expect(updated.company).toBe("Acme");
  });

  test("surrounding spaces are trimmed before storage", async () => {
    const repository = createApplicationsRepository();
    const app = await repository.create({ company: "  Acme  ", position: "  Developer  " });
    expect(app.company).toBe("Acme");

    const updated = await repository.update(app.id, { location: "  Munich  " });
    expect(updated.location).toBe("Munich");
  });

  test("salary from above salary to is rejected", async () => {
    const repository = createApplicationsRepository();
    const app = await repository.create({ company: "Acme", position: "Developer" });
    await expect(repository.update(app.id, { salaryMin: 500, salaryMax: 100 })).rejects.toThrow();
  });

  test("updating a missing application says so", async () => {
    const repository = createApplicationsRepository();
    await expect(repository.update("missing", { location: "Berlin" })).rejects.toMatchObject({
      kind: "not_found",
    });
  });
});

describe("changing status", () => {
  test("a real move is written to the log and shows as previousStatus", async () => {
    const repository = createApplicationsRepository();
    const app = await repository.create({ company: "Acme", position: "Developer" });
    await repository.changeStatus([app.id], { status: "screening" });

    const details = await repository.get(app.id);
    expect(details?.status).toBe("screening");
    expect(details?.previousStatus).toBe("sent");
    expect(details?.statusChanges).toHaveLength(2);
  });

  test("setting the same status again changes nothing", async () => {
    const repository = createApplicationsRepository();
    const app = await repository.create({ company: "Acme", position: "Developer" });
    const before = await repository.get(app.id);
    await repository.changeStatus([app.id], { status: "sent" });

    expect((await repository.get(app.id))?.statusChanges).toHaveLength(before!.statusChanges.length);
  });

  test("a move the rules forbid is refused and changes nothing", async () => {
    const repository = createApplicationsRepository();
    const app = await repository.create({ company: "Acme", position: "Developer" });

    await expect(repository.changeStatus([app.id], { status: "offer_discussion" })).rejects.toMatchObject({
      kind: "status_transition",
    });
    expect((await repository.get(app.id))?.status).toBe("sent");
  });

  test("imports may ignore the rules", async () => {
    const repository = createApplicationsRepository();
    const app = await repository.create({ company: "Acme", position: "Developer" });
    await repository.changeStatus([app.id], { status: "offer_discussion" }, { ignoreRules: true });
    expect((await repository.get(app.id))?.status).toBe("offer_discussion");
  });

  test("a bulk change is all or nothing", async () => {
    const repository = createApplicationsRepository();
    const ok = await repository.create({ company: "Acme", position: "Developer" });
    const closed = await repository.create({ company: "Beta", position: "Tester" });
    await repository.changeStatus([closed.id], { status: "rejected" });

    await expect(repository.changeStatus([ok.id, closed.id], { status: "interview" })).rejects.toMatchObject({
      kind: "status_transition",
    });
    expect((await repository.get(ok.id))?.status).toBe("sent");
    expect((await repository.get(closed.id))?.status).toBe("rejected");
  });

  test("a reason is kept for outcomes and dropped for other steps", async () => {
    const repository = createApplicationsRepository();
    const rejected = await repository.create({ company: "Acme", position: "Developer" });
    const moved = await repository.create({ company: "Beta", position: "Tester" });

    await repository.changeStatus([rejected.id], { status: "rejected", reason: "No budget" });
    await repository.changeStatus([moved.id], { status: "screening", reason: "ignored" });

    expect((await repository.get(rejected.id))?.statusChanges[0].reason).toBe("No budget");
    expect((await repository.get(moved.id))?.statusChanges[0].reason).toBeNull();
  });
});

describe("undoing a status change", () => {
  test("undo walks the log back one step at a time, then stops", async () => {
    const repository = createApplicationsRepository();
    const app = await repository.create({ company: "Acme", position: "Developer" });
    await repository.changeStatus([app.id], { status: "screening" });
    await repository.changeStatus([app.id], { status: "interview" });

    await repository.revertStatus([app.id]);
    expect((await repository.get(app.id))?.status).toBe("screening");

    await repository.revertStatus([app.id]);
    const back = await repository.get(app.id);
    expect(back?.status).toBe("sent");
    expect(back?.statusChanges).toHaveLength(1);

    await expect(repository.revertStatus([app.id])).rejects.toMatchObject({ kind: "not_found" });
  });

  test("undo restores the time of the change it undoes, not the current time", async () => {
    const repository = createApplicationsRepository();
    const app = await repository.create({ company: "Acme", position: "Developer" });
    await repository.changeStatus([app.id], { status: "screening" });
    const screeningAt = (await repository.get(app.id))!.statusChangedAt;

    await tick();
    await repository.changeStatus([app.id], { status: "interview" });
    await repository.revertStatus([app.id]);

    expect((await repository.get(app.id))?.statusChangedAt).toBe(screeningAt);
  });

  test("bulk undo reverts one step for each application", async () => {
    const repository = createApplicationsRepository();
    const a = await repository.create({ company: "Acme", position: "Developer" });
    const b = await repository.create({ company: "Beta", position: "Tester" });
    await repository.changeStatus([a.id, b.id], { status: "screening" });

    await repository.revertStatus([a.id, b.id]);
    expect((await repository.get(a.id))?.status).toBe("sent");
    expect((await repository.get(b.id))?.status).toBe("sent");
  });
});

describe("the archive", () => {
  test("remove hides the application and schedules its erasure 30 days later", async () => {
    const repository = createApplicationsRepository();
    const app = await repository.create({ company: "Acme", position: "Developer" });
    await repository.remove([app.id]);

    expect((await repository.list()).total).toBe(0);
    const deleted = await repository.listDeleted();
    expect(deleted).toHaveLength(1);
    expect(deleted[0].erasedAt).toBe(
      new Date(Date.parse(deleted[0].deletedAt) + ARCHIVE_DAYS * DAY).toISOString(),
    );
  });

  test("restore brings it back", async () => {
    const repository = createApplicationsRepository();
    const app = await repository.create({ company: "Acme", position: "Developer" });
    await repository.remove([app.id]);
    await repository.restore([app.id]);

    expect((await repository.list()).total).toBe(1);
    expect(await repository.listDeleted()).toHaveLength(0);
  });

  test("a live application cannot be erased for good", async () => {
    const repository = createApplicationsRepository();
    const app = await repository.create({ company: "Acme", position: "Developer" });
    await repository.erase([app.id]);

    expect((await repository.list()).total).toBe(1);
  });

  test("erasing keeps a statistics entry", async () => {
    const repository = createApplicationsRepository();
    const app = await repository.create({ company: "Acme", position: "Developer", source: "HH" });
    await repository.remove([app.id]);
    await repository.erase([app.id]);

    expect(await repository.listDeleted()).toHaveLength(0);
    const stats = await repository.listForStatistics();
    expect(stats).toHaveLength(1);
    expect(stats[0]).toMatchObject({ state: "deleted", company: "Acme", source: "HH" });
  });

  test("only applications older than 30 days are erased when storage opens", async () => {
    const { storage } = memoryStorage({
      ...clone(EMPTY),
      applications: [
        storedApp({ id: "old", company: "Old", deletedAt: daysAgo(31) }),
        storedApp({ id: "fresh", company: "Fresh", deletedAt: daysAgo(29) }),
      ],
    });
    const repository = createApplicationsRepository({ storage });
    expect(await repository.isPersistent()).toBe(true); // opens the repository

    const deleted = await repository.listDeleted();
    expect(deleted.map((app) => app.id)).toEqual(["fresh"]);

    const stats = await repository.listForStatistics();
    const erased = stats.filter((entry) => entry.state === "deleted");
    expect(erased.map((entry) => entry.company)).toEqual(["Old"]);
  });
});

describe("listing", () => {
  async function seeded() {
    const repository = createApplicationsRepository();
    await repository.create({ company: "Acme", position: "Frontend", source: "LinkedIn" });
    await repository.create({ company: "Beta", position: "Backend", source: "HH" });
    await repository.create({ company: "Gamma", position: "Frontend", source: "LinkedIn" });
    return repository;
  }

  test("search matches company and position, ignoring case", async () => {
    const repository = await seeded();
    expect((await repository.list({ search: "acme" })).total).toBe(1);
    expect((await repository.list({ search: "frontend" })).total).toBe(2);
  });

  test("filters by status and by source", async () => {
    const repository = await seeded();
    const all = await repository.list();
    const [first] = all.items;
    await repository.changeStatus([first.id], { status: "screening" });

    expect((await repository.list({ statuses: ["screening"] })).total).toBe(1);
    expect((await repository.list({ sources: ["LinkedIn"] })).total).toBe(2);
    expect((await repository.list({ sources: ["LinkedIn"], statuses: ["sent"] })).total).toBe(1);
  });

  test("sorts by company in both directions", async () => {
    const repository = await seeded();
    const asc = await repository.list({ sort: { field: "company", direction: "asc" } });
    const desc = await repository.list({ sort: { field: "company", direction: "desc" } });
    expect(asc.items.map((app) => app.company)).toEqual(["Acme", "Beta", "Gamma"]);
    expect(desc.items.map((app) => app.company)).toEqual(["Gamma", "Beta", "Acme"]);
  });

  test("empty values go last, whatever the direction", async () => {
    const repository = createApplicationsRepository();
    await repository.create({ company: "NoSalary", position: "Dev" });
    await repository.create({ company: "High", position: "Dev", salaryMin: 900 });
    await repository.create({ company: "Low", position: "Dev", salaryMin: 100 });

    const asc = await repository.list({ sort: { field: "salary", direction: "asc" } });
    const desc = await repository.list({ sort: { field: "salary", direction: "desc" } });
    expect(asc.items.map((app) => app.company)).toEqual(["Low", "High", "NoSalary"]);
    expect(desc.items.map((app) => app.company)).toEqual(["High", "Low", "NoSalary"]);
  });

  test("pages are clamped to the last one and keep the total", async () => {
    const repository = await seeded();
    const page1 = await repository.list({ page: 1, pageSize: 2 });
    const page2 = await repository.list({ page: 2, pageSize: 2 });
    const page99 = await repository.list({ page: 99, pageSize: 2 });

    expect(page1.items).toHaveLength(2);
    expect(page1.total).toBe(3);
    expect(page2.items).toHaveLength(1);
    expect(page99.page).toBe(2);
  });

  test("newest updated comes first by default", async () => {
    const repository = createApplicationsRepository();
    const first = await repository.create({ company: "First", position: "Dev" });
    await tick();
    await repository.create({ company: "Second", position: "Dev" });
    await tick();
    await repository.update(first.id, { location: "Berlin" });

    expect((await repository.list()).items[0].id).toBe(first.id);
  });

  test("sources are distinct and sorted", async () => {
    const repository = await seeded();
    expect(await repository.listSources()).toEqual(["HH", "LinkedIn"]);
  });
});

describe("stages and notes", () => {
  test("stages are numbered per type and interview kind", async () => {
    const repository = createApplicationsRepository();
    const app = await repository.create({ company: "Acme", position: "Developer" });

    const first = await repository.addStage(app.id, { type: "interview", interviewKind: "technical" });
    const second = await repository.addStage(app.id, { type: "interview", interviewKind: "technical" });
    const takeHome = await repository.addStage(app.id, { type: "test_task" });

    expect([first.seq, second.seq, takeHome.seq]).toEqual([1, 2, 1]);
  });

  test("an interview kind is rejected for other stage types", async () => {
    const repository = createApplicationsRepository();
    const app = await repository.create({ company: "Acme", position: "Developer" });
    expect(
      repository.addStage(app.id, { type: "test_task", interviewKind: "technical" } as never),
    ).rejects.toThrow();
  });

  test("removing a stage keeps its notes, unattached", async () => {
    const repository = createApplicationsRepository();
    const app = await repository.create({ company: "Acme", position: "Developer" });
    const stage = await repository.addStage(app.id, { type: "interview" });
    const note = await repository.addNote(app.id, { body: "Ask about the stack", stageId: stage.id });

    await repository.removeStage(stage.id);

    const details = await repository.get(app.id);
    expect(details?.stages).toHaveLength(0);
    expect(details?.notes.find((item) => item.id === note.id)?.stageId).toBeNull();
  });

  test("notes are edited and removed", async () => {
    const repository = createApplicationsRepository();
    const app = await repository.create({ company: "Acme", position: "Developer" });
    const note = await repository.addNote(app.id, { body: "First" });

    await repository.updateNote(note.id, { body: "Second" });
    expect((await repository.get(app.id))?.notes[0].body).toBe("Second");

    await repository.removeNote(note.id);
    expect((await repository.get(app.id))?.notes).toHaveLength(0);
  });

  test("an empty note body is rejected", async () => {
    const repository = createApplicationsRepository();
    const app = await repository.create({ company: "Acme", position: "Developer" });
    await expect(repository.addNote(app.id, { body: "   " })).rejects.toThrow();
  });
});

describe("backup and restore", () => {
  test("a backup restored into an empty repository gives the same snapshot", async () => {
    const source = createApplicationsRepository({ seed: SAMPLE_DATA });
    const snapshot = await source.exportSnapshot();

    const target = createApplicationsRepository();
    await target.restoreSnapshot(snapshot);

    expect(await target.exportSnapshot()).toEqual(snapshot);
  });

  test("restoring replaces what was there", async () => {
    const source = createApplicationsRepository({ seed: SAMPLE_DATA });
    const snapshot = await source.exportSnapshot();

    const target = createApplicationsRepository();
    await target.create({ company: "Will be erased", position: "Dev" });
    await target.restoreSnapshot(snapshot);

    const restored = await target.exportSnapshot();
    expect(restored.applications.map((app) => app.company)).not.toContain("Will be erased");
  });

  test("clear empties everything, statistics included", async () => {
    const repository = createApplicationsRepository({ seed: SAMPLE_DATA });
    await repository.clear();

    expect((await repository.list()).total).toBe(0);
    expect(await repository.listForStatistics()).toHaveLength(0);
    expect((await repository.exportSnapshot()).applications).toHaveLength(0);
  });
});

describe("storage", () => {
  test("every change is written to storage", async () => {
    const { storage, saved } = memoryStorage();
    const repository = createApplicationsRepository({ storage });
    const app = await repository.create({ company: "Acme", position: "Developer" });

    const written = saved.flatMap((changes) => changes.applications.put);
    expect(written.map((row) => row.id)).toContain(app.id);
  });

  test("when storage refuses to open, the repository still works in memory", async () => {
    const broken: Storage = {
      load: () => Promise.reject(new Error("blocked")),
      save: () => Promise.resolve(),
    };
    const repository = createApplicationsRepository({ storage: broken });

    // The repository warns by design when storage is unavailable; keep the test output readable.
    const warn = console.warn;
    console.warn = () => {};
    try {
      expect(await repository.isPersistent()).toBe(false);
    } finally {
      console.warn = warn;
    }
    const app = await repository.create({ company: "Acme", position: "Developer" });
    expect((await repository.list()).total).toBe(1);
    expect((await repository.get(app.id))?.company).toBe("Acme");
  });

  test("subscribers hear about every change", async () => {
    const repository = createApplicationsRepository();
    let calls = 0;
    const unsubscribe = repository.subscribe(() => {
      calls += 1;
    });

    await repository.create({ company: "Acme", position: "Developer" });
    expect(calls).toBe(1);

    unsubscribe();
    await repository.create({ company: "Beta", position: "Developer" });
    expect(calls).toBe(1);
  });

  test("a missing record is a not_found error, not a crash", async () => {
    const repository = createApplicationsRepository();
    try {
      await repository.update("missing", { location: "Berlin" });
      throw new Error("should have thrown");
    } catch (error) {
      expect(isRepositoryError(error, "not_found")).toBe(true);
    }
  });
});
