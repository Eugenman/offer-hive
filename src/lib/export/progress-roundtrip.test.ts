import { describe, expect, test } from "bun:test";
import type { ApplicationDetails, Stage, StatusChange } from "@/lib/domain";
import { autoMap } from "@/lib/import/fields";
import { normalizeRow } from "@/lib/import/normalize";
import { readSpreadsheet } from "@/lib/import/read-file";
import { buildApplicationsCsv, buildApplicationsXlsx } from "./applications-csv";

// A backup is only a backup if it comes back: the events and the status history written into the
// file must parse into the same values, column by column and sheet by sheet.

const at = "2026-11-06T10:00:00.000Z";

function stage(over: Partial<Stage>): Stage {
  return {
    id: "s1",
    applicationId: "a1",
    type: "interview",
    interviewKind: null,
    title: null,
    seq: 1,
    scheduledAt: "2026-11-19T09:00:00.000Z",
    state: "planned",
    createdAt: at,
    updatedAt: at,
    ...over,
  };
}

function change(over: Partial<StatusChange>): StatusChange {
  return {
    id: "c1",
    applicationId: "a1",
    fromStatus: "sent",
    toStatus: "interview",
    reason: null,
    changedAt: "2026-11-09T10:04:00.000Z",
    ...over,
  };
}

function details(over: Partial<ApplicationDetails> = {}): ApplicationDetails {
  return {
    id: "a1",
    company: "Acme",
    position: "Developer",
    status: "interview",
    statusChangedAt: at,
    appliedAt: "2026-10-12",
    url: null,
    location: null,
    workFormat: null,
    salaryMin: null,
    salaryMax: null,
    currency: null,
    contactName: null,
    contactInfo: null,
    source: null,
    createdAt: at,
    updatedAt: at,
    previousStatus: "sent",
    stages: [
      stage({ id: "s2", seq: 1, scheduledAt: "2026-11-19T09:00:00.000Z", title: "Техническое интервью" }),
      stage({ id: "s3", type: "test_task", seq: 1, scheduledAt: null, state: "done", title: "Задание" }),
    ],
    notes: [],
    statusChanges: [
      change({ id: "c2", fromStatus: null, toStatus: "sent", changedAt: "2026-10-12T08:00:00.000Z" }),
      change({ id: "c1", fromStatus: "sent", toStatus: "interview", reason: "Хороший звонок" }),
    ],
    ...over,
  };
}

/** One CSV cell, read the way a spreadsheet app would read it. */
function cellOf(csv: string, header: string, row = 0) {
  const lines = csv
    .replace(/^\uFEFF/, "")
    .trimEnd()
    .split("\r\n");
  const parse = (line: string) => {
    const cells: string[] = [];
    let value = "";
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (quoted) {
        if (char === '"' && line[i + 1] === '"') {
          value += '"';
          i += 1;
        } else if (char === '"') quoted = false;
        else value += char;
      } else if (char === '"') quoted = true;
      else if (char === ",") {
        cells.push(value);
        value = "";
      } else value += char;
    }
    cells.push(value);
    return cells;
  };
  const headers = parse(lines[0]);
  const index = headers.indexOf(header);
  if (index === -1) throw new Error(`no ${header} column`);
  return parse(lines[row + 1])[index];
}

describe("a backup keeps the progress", () => {
  test("events survive the CSV round-trip", () => {
    const csv = buildApplicationsCsv([details()]);
    const cell = cellOf(csv, "Events");
    expect(cell.split("\n")).toHaveLength(2);
    expect(cell.split("\n")[0]).toBe("interview||1|2026-11-19T09:00:00.000Z|planned|Техническое интервью");
    expect(cell.split("\n")[1]).toBe("test_task||1||done|Задание");
  });

  test("status history survives the CSV round-trip", () => {
    const csv = buildApplicationsCsv([details()]);
    const cell = cellOf(csv, "Status history");
    expect(cell.split("\n")[0]).toBe("|sent|2026-10-12T08:00:00.000Z|");
    expect(cell.split("\n")[1]).toBe("sent|interview|2026-11-09T10:04:00.000Z|Хороший звонок");
  });

  test("Excel gets the same data as sheets", async () => {
    const book = await buildApplicationsXlsx([details()]);
    const xlsx = await import("xlsx");
    const workbook = xlsx.read(new Uint8Array(book), { type: "array" });
    expect(workbook.SheetNames).toContain("Events");
    expect(workbook.SheetNames).toContain("Status history");
    const events = xlsx.utils.sheet_to_json(workbook.Sheets["Events"]) as Record<string, unknown>[];
    expect(events).toHaveLength(2);
    expect(events[0].Type).toBe("interview");
    expect(events[0].State).toBe("planned");
    const history = xlsx.utils.sheet_to_json(workbook.Sheets["Status history"]) as Record<string, unknown>[];
    expect(history).toHaveLength(2);
    expect(history[1].To).toBe("interview");
    expect(history[1].Reason).toBe("Хороший звонок");
  });

  test("the columns parse back into the same events", () => {
    const csv = buildApplicationsCsv([details()]);
    expect(cellOf(csv, "Events")).toContain("interview||1|2026-11-19T09:00:00.000Z|planned");
  });

  test("the import reads the saved backup back into events and history", async () => {
    const csv = buildApplicationsCsv([details()]);
    const file = new File([csv], "offerhive-backup.csv", { type: "text/csv" });
    const read = await readSpreadsheet(file);
    expect(read.ok).toBe(true);
    if (!read.ok) return;

    // The same path the import dialog takes: headers are mapped, then the row is normalized.
    const row = normalizeRow(read.table.rows[0], autoMap(read.table.headers), 2);
    expect(row.ok).toBe(true);
    if (!row.ok) return;

    expect(row.value.company).toBe("Acme");
    expect(row.value.events).toEqual([
      {
        type: "interview",
        interviewKind: null,
        title: "Техническое интервью",
        scheduledAt: "2026-11-19T09:00:00.000Z",
        state: "planned",
      },
      { type: "test_task", interviewKind: null, title: "Задание", scheduledAt: null, state: "done" },
    ]);
    expect(row.value.history).toEqual([
      { fromStatus: null, toStatus: "sent", changedAt: "2026-10-12T08:00:00.000Z", reason: null },
      {
        fromStatus: "sent",
        toStatus: "interview",
        changedAt: "2026-11-09T10:04:00.000Z",
        reason: "Хороший звонок",
      },
    ]);
  });

  test("the new statuses survive the round-trip column by column", async () => {
    const apps = [
      details({ id: "w1", status: "wishlist", appliedAt: null, statusChanges: [], stages: [] }),
      details({
        id: "f1",
        status: "fit",
        statusChanges: [
          change({ id: "c3", fromStatus: null, toStatus: "sent", changedAt: "2026-10-12T08:00:00.000Z" }),
          change({ id: "c4", fromStatus: "sent", toStatus: "fit", changedAt: "2026-11-09T10:04:00.000Z" }),
        ],
        stages: [],
      }),
      details({ id: "a2", status: "accepted", appliedAt: "2026-10-01", stages: [] }),
    ];
    const csv = buildApplicationsCsv(apps);
    expect(cellOf(csv, "Status", 0)).toBe("Wishlist");
    expect(cellOf(csv, "Status", 1)).toBe("Fit");
    expect(cellOf(csv, "Status", 2)).toBe("Accepted");

    const file = new File([csv], "offerhive-statuses.csv", { type: "text/csv" });
    const read = await readSpreadsheet(file);
    expect(read.ok).toBe(true);
    if (!read.ok) return;

    const rows = read.table.rows.map((cells, index) =>
      normalizeRow(cells, autoMap(read.table.headers), index + 2),
    );
    expect(rows.map((row) => (row.ok ? row.value.status : "failed"))).toEqual([
      "wishlist",
      "fit",
      "accepted",
    ]);
    // A wish keeps no date applied: the card shows the day it was added instead.
    expect(rows[0].ok && rows[0].value.appliedAt).toBeNull();
  });

  test("the import reads the same progress out of an Excel backup", async () => {
    const book = await buildApplicationsXlsx([details()]);
    const file = new File([book], "offerhive-backup.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const read = await readSpreadsheet(file);
    expect(read.ok).toBe(true);
    if (!read.ok) return;

    const row = normalizeRow(read.table.rows[0], autoMap(read.table.headers), 2);
    expect(row.ok).toBe(true);
    if (!row.ok) return;
    expect(row.value.events.map((event) => event.title)).toEqual(["Техническое интервью", "Задание"]);
    expect(row.value.history.map((change) => change.toStatus)).toEqual(["sent", "interview"]);
  });
});
