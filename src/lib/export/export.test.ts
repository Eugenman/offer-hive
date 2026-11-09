import { describe, expect, test } from "bun:test";
import type { ApplicationDetails, Note } from "@/lib/domain";
import type { StoreSnapshot } from "@/lib/repository/repository";
import { buildApplicationsCsv, buildApplicationsXlsx } from "./applications-csv";
import { backupFileName, buildBackup, parseBackup } from "./backup-file";

// Export is the way data leaves the app: a spreadsheet for working in Excel and a JSON file for a
// full restore. Both must survive commas, quotes, newlines and non-ASCII text.

const at = "2026-11-06T10:00:00.000Z";

function note(body: string, createdAt: string): Note {
  return { id: `n-${body}`, applicationId: "a1", stageId: null, body, createdAt, updatedAt: createdAt };
}

function details(over: Partial<ApplicationDetails> = {}): ApplicationDetails {
  return {
    id: "a1",
    company: "Acme",
    position: "Developer",
    status: "sent",
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
    previousStatus: null,
    stages: [],
    notes: [],
    statusChanges: [],
    ...over,
  };
}

describe("CSV", () => {
  const csv = buildApplicationsCsv([
    details({ notes: [note("new", "2026-11-02T10:00:00.000Z"), note("old", "2026-11-01T10:00:00.000Z")] }),
  ]);
  const body = csv.replace(/^\uFEFF/, "");
  const lines = body.split("\r\n");

  test("starts with a BOM so Excel reads UTF-8", () => {
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  test("ends every line with CRLF", () => {
    expect(body.endsWith("\r\n")).toBe(true);
    // One header and one row; the newlines inside the quoted notes cell are not row breaks.
    expect(body.split("\r\n").filter(Boolean)).toHaveLength(2);
  });

  test("the header names every column", () => {
    expect(lines[0]).toBe(
      "ID,Company,Position,Status,Date applied,Link,Salary from,Salary to,Currency,Work format,Location,Contact,Contact info,Source,Notes,Events,Status history",
    );
  });

  test("empty values become empty cells", () => {
    expect(lines[1].startsWith("a1,Acme,Developer,Applied,2026-10-12,,,")).toBe(true);
  });

  test("a comma is wrapped in quotes", () => {
    const quoted = buildApplicationsCsv([details({ company: "Acme, Inc." })]);
    expect(quoted).toContain('"Acme, Inc."');
  });

  test("a quote is doubled", () => {
    const quoted = buildApplicationsCsv([details({ company: 'Acme "Big"' })]);
    expect(quoted).toContain('"Acme ""Big"""');
  });

  test("notes keep one line per note, oldest first", () => {
    expect(body).toContain('"old\nnew"');
  });

  test("a value that looks like a formula stays text", () => {
    const cells = ['=HYPERLINK("http://evil","x")', "+1+1", "-2+3", "@SUM(A1)"].map((company) =>
      buildApplicationsCsv([details({ company })]),
    );

    // The leading apostrophe is what keeps Excel and Sheets from running the value.
    expect(cells[0]).toContain(`"'=HYPERLINK(`);
    expect(cells[1]).toContain("'+1+1");
    expect(cells[2]).toContain("'-2+3");
    expect(cells[3]).toContain("'@SUM(A1)");
  });

  test("a bullet list in a note is not mistaken for a formula", () => {
    const csv = buildApplicationsCsv([details({ notes: [note("- first point", at)] })]);
    expect(csv).toContain("- first point");
    expect(csv).not.toContain("'- first point");
  });

  test("numbers are not touched", () => {
    const csv = buildApplicationsCsv([details({ salaryMin: 100, salaryMax: 200 })]);
    expect(csv).not.toContain("'100");
    expect(csv).toContain(",100,200,");
  });

  test("several applications give several rows", () => {
    const two = buildApplicationsCsv([details(), details({ id: "a2", company: "Beta" })]);
    expect(
      two
        .replace(/^\uFEFF/, "")
        .split("\r\n")
        .filter(Boolean),
    ).toHaveLength(3);
  });
});

describe("XLSX", () => {
  test("is a workbook with the applications sheet and a real date cell", async () => {
    const buffer = await buildApplicationsXlsx([details()]);
    const xlsx = await import("xlsx");
    const book = xlsx.read(buffer, { type: "array", cellDates: true });
    const sheet = book.Sheets[book.SheetNames[0]];

    expect(book.SheetNames).toEqual(["Applications"]);
    expect(sheet.A1.v).toBe("ID");
    expect(sheet.B2.v).toBe("Acme");
    // Column E is "Date applied".
    expect(sheet.E2.v).toBeInstanceOf(Date);
    expect((sheet.E2.v as Date).toISOString().slice(0, 10)).toBe("2026-10-12");
  });

  test("an empty list is still a valid file", async () => {
    const buffer = await buildApplicationsXlsx([]);
    const xlsx = await import("xlsx");
    const book = xlsx.read(buffer, { type: "array" });
    expect(book.SheetNames).toEqual(["Applications"]);
  });
});

describe("backup", () => {
  const snapshot: StoreSnapshot = {
    applications: [
      {
        id: "a1",
        company: "Acme",
        position: "Developer",
        status: "sent",
        statusChangedAt: at,
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
        createdAt: at,
        updatedAt: at,
        deletedAt: null,
      },
    ],
    stages: [],
    notes: [],
    statusChanges: [
      {
        id: "c1",
        applicationId: "a1",
        fromStatus: null,
        toStatus: "sent",
        reason: null,
        changedAt: at,
        seq: 1,
      },
    ],
    deletedStatistics: [],
  };

  test("the file carries its format, version and export time", () => {
    const text = buildBackup(snapshot, new Date("2026-11-06T12:00:00.000Z"));
    const parsed = JSON.parse(text);
    expect(parsed).toMatchObject({
      format: "offerhive-backup",
      version: 1,
      exportedAt: "2026-11-06T12:00:00.000Z",
    });
  });

  test("a round trip returns the same data", () => {
    const parsed = parseBackup(buildBackup(snapshot));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.applications).toBe(1);
    expect(parsed.snapshot).toEqual(snapshot);
  });

  test("the file name carries the date", () => {
    expect(backupFileName(new Date("2026-11-06T12:00:00.000Z"))).toBe("offerhive-backup-2026-11-06.json");
  });

  test("a missing statistics list is not an error", () => {
    const text = JSON.stringify({
      format: "offerhive-backup",
      version: 1,
      exportedAt: at,
      data: { applications: [], stages: [], notes: [], statusChanges: [] },
    });
    const parsed = parseBackup(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.snapshot.deletedStatistics).toEqual([]);
  });

  test("something that is not a backup is refused before anything is replaced", () => {
    expect(parseBackup("не json").ok).toBe(false);
    expect(parseBackup(JSON.stringify({ format: "other", version: 1, data: {} })).ok).toBe(false);
  });

  test("a newer format version is refused", () => {
    const text = JSON.stringify({ format: "offerhive-backup", version: 2, exportedAt: at, data: {} });
    expect(parseBackup(text).ok).toBe(false);
  });

  test("a row without a company is refused", () => {
    const text = JSON.stringify({
      format: "offerhive-backup",
      version: 1,
      exportedAt: at,
      data: {
        applications: [{ id: "a1", position: "Developer", status: "sent", deletedAt: null }],
        stages: [],
        notes: [],
        statusChanges: [],
      },
    });
    expect(parseBackup(text).ok).toBe(false);
  });
});
