import { describe, expect, test } from "bun:test";
import {
  createApplicationsRepository,
  type ChangeSet,
  type Storage,
  type StoreSnapshot,
} from "@/lib/repository/repository";
import { applyImport } from "./apply";
import type { ImportedApplication } from "./normalize";

// A backup brings not only the applications but their history. The import writes that history with
// its own dates, and a second import of the same file must not double the log.

const EMPTY: StoreSnapshot = {
  applications: [],
  stages: [],
  notes: [],
  statusChanges: [],
  deletedStatistics: [],
};

function memoryStorage() {
  const data = structuredClone(EMPTY);
  const storage: Storage = {
    load: async () => structuredClone(data),
    save: async (changes: ChangeSet) => {
      for (const name of Object.keys(changes) as (keyof StoreSnapshot)[]) {
        const rows = new Map((data[name] as { id: string }[]).map((row) => [row.id, row]));
        for (const row of changes[name].put as { id: string }[]) rows.set(row.id, row);
        for (const id of changes[name].delete) rows.delete(id);
        data[name] = [...rows.values()] as never;
      }
    },
  };
  return createApplicationsRepository({ storage });
}

function incoming(over: Partial<ImportedApplication> = {}): ImportedApplication {
  return {
    id: null,
    company: "Acme",
    position: "Developer",
    status: "rejected",
    appliedAt: "2026-10-12",
    url: null,
    salaryMin: null,
    salaryMax: null,
    currency: null,
    workFormat: null,
    location: null,
    contactName: null,
    contactInfo: null,
    source: null,
    notes: null,
    events: [],
    history: [
      { fromStatus: null, toStatus: "sent", changedAt: "2026-10-12T08:00:00.000Z", reason: null },
      { fromStatus: "sent", toStatus: "interview", changedAt: "2026-11-09T10:04:00.000Z", reason: null },
      // Only outcomes keep a reason: the schema drops it for other statuses.
      {
        fromStatus: "interview",
        toStatus: "rejected",
        changedAt: "2026-11-09T16:16:00.000Z",
        reason: "Взяли другого кандидата",
      },
    ],
    ...over,
  };
}

async function onlyApplication(repository: ReturnType<typeof memoryStorage>) {
  const page = await repository.list();
  return repository.get(page.items[0].id);
}

describe("history from a backup", () => {
  test("comes back with its own dates and reasons", async () => {
    const repository = memoryStorage();
    await applyImport(repository, [{ value: incoming() }], []);
    const app = await onlyApplication(repository);
    const interview = app?.statusChanges.find((entry) => entry.toStatus === "interview");
    expect(interview?.changedAt).toBe("2026-11-09T10:04:00.000Z");
    const rejection = app?.statusChanges.find((entry) => entry.toStatus === "rejected");
    expect(rejection?.changedAt).toBe("2026-11-09T16:16:00.000Z");
    expect(rejection?.reason).toBe("Взяли другого кандидата");
    expect(app?.status).toBe("rejected");
  });

  test("is not doubled by a second import of the same file", async () => {
    const repository = memoryStorage();
    await applyImport(repository, [{ value: incoming() }], []);
    await applyImport(repository, [{ value: incoming() }], []);
    const page = await repository.list();
    expect(page.items).toHaveLength(2);
    const first = await repository.get(page.items[0].id);
    const interviewEntries = first?.statusChanges.filter((entry) => entry.toStatus === "interview") ?? [];
    expect(interviewEntries).toHaveLength(1);
    // The creation record is written by the import itself; the replayed ones keep the file's order.
    const replayed = (first?.statusChanges ?? [])
      .filter((entry) => entry.fromStatus !== null)
      .sort((a, b) => a.changedAt.localeCompare(b.changedAt))
      .map((entry) => entry.toStatus);
    expect(replayed).toEqual(["interview", "rejected"]);
  });

  test("is ignored when the file has none", async () => {
    const repository = memoryStorage();
    await applyImport(repository, [{ value: incoming({ history: [] }) }], []);
    const app = await onlyApplication(repository);
    expect(app?.statusChanges).toHaveLength(1);
    expect(app?.statusChanges[0].toStatus).toBe("rejected");
  });
});
