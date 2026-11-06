import { describe, expect, test } from "bun:test";
import type { Application } from "@/lib/domain";
import { autoMap, normalizeHeader, type ImportField } from "./fields";
import { matchKey, mergeConflicts, planImport, resolveConflict, type Conflict } from "./match";
import { normalizeRow, parseDate, parseSalary, type ImportedApplication } from "./normalize";

// Import is the front door for people who already keep a spreadsheet: the parsing has to survive
// real files — Excel serial dates, "10/15/2026", "200-250к", Russian headers.

describe("dates", () => {
  test("ISO passes through", () => {
    expect(parseDate("2026-10-15")).toBe("2026-10-15");
  });

  test("day-first with dots or slashes", () => {
    expect(parseDate("15.10.2026")).toBe("2026-10-15");
    expect(parseDate("15/10/2026")).toBe("2026-10-15");
  });

  test("month-first is used when day-first is not a real date", () => {
    expect(parseDate("10/15/2026")).toBe("2026-10-15");
  });

  test("a two-digit year means this century", () => {
    expect(parseDate("15.10.26")).toBe("2026-10-15");
  });

  test("an Excel serial number becomes a date", () => {
    // Excel counts days from 1899-12-30; 45658 is 2025-01-01.
    expect(parseDate("45658")).toBe("2025-01-01");
  });

  test("a day that does not exist is not a date", () => {
    expect(parseDate("31.02.2026")).toBeNull();
  });

  test("anything else is null, not a broken date", () => {
    expect(parseDate("")).toBeNull();
    expect(parseDate("вчера")).toBeNull();
  });
});

describe("salaries", () => {
  test("a range in thousands", () => {
    expect(parseSalary("200-250к")).toEqual({ salaryMin: 200_000, salaryMax: 250_000, currency: null });
  });

  test("a lower bound with a currency sign", () => {
    expect(parseSalary("от 3000$")).toEqual({ salaryMin: 3000, salaryMax: null, currency: "USD" });
  });

  test("a single amount written with a thousands separator", () => {
    expect(parseSalary("$120,000")).toEqual({ salaryMin: 120_000, salaryMax: null, currency: "USD" });
  });

  test("an upper bound in thousands with a currency code", () => {
    expect(parseSalary("up to 90k EUR")).toEqual({ salaryMin: null, salaryMax: 90_000, currency: "EUR" });
  });

  test("a full range with spaces and a code", () => {
    expect(parseSalary("220 000–280 000 RUB")).toEqual({
      salaryMin: 220_000,
      salaryMax: 280_000,
      currency: "RUB",
    });
  });

  test("an upper bound in words", () => {
    expect(parseSalary("до 150 тыс")).toEqual({ salaryMin: null, salaryMax: 150_000, currency: null });
  });

  test("a decimal in thousands is not multiplied twice", () => {
    expect(parseSalary("1,5к")).toEqual({ salaryMin: 1500, salaryMax: null, currency: null });
  });

  test("an empty cell gives nothing to store", () => {
    expect(parseSalary("")).toEqual({ salaryMin: null, salaryMax: null, currency: null });
  });
});

describe("column headers", () => {
  test("normalisation ignores case, ё and extra spaces", () => {
    expect(normalizeHeader("  Дата   отклика ")).toBe("дата отклика");
    expect(normalizeHeader("Зарплата Ёмкая")).toBe("зарплата емкая");
  });

  test("Russian headers map to fields", () => {
    expect(
      autoMap([
        "Компания",
        "Должность",
        "Зарплата от",
        "Зарплата до",
        "Валюта",
        "Формат работы",
        "Город",
        "Контакт",
        "Email",
        "Источник",
        "Заметки",
        "ID",
      ]),
    ).toEqual([
      "company",
      "position",
      "salaryMin",
      "salaryMax",
      "currency",
      "workFormat",
      "location",
      "contactName",
      "contactInfo",
      "source",
      "notes",
      "id",
    ]);
  });

  test("English headers map to fields", () => {
    expect(autoMap(["Company", "Position", "Date applied", "Link", "Salary", "City"])).toEqual([
      "company",
      "position",
      "appliedAt",
      "url",
      "salary",
      "location",
    ]);
  });

  test("a field is used once and unknown columns are skipped", () => {
    expect(autoMap(["Компания", "Компания", "Что-то своё"])).toEqual(["company", null, null]);
  });
});

describe("turning a row into an application", () => {
  const mapping = ["company", "position", "status", "appliedAt", "salary", "workFormat"] as const;

  test("a full row is read and validated", () => {
    const result = normalizeRow(
      ["Ромашка", "Frontend", "Отказ", "15.10.2026", "200-250к", "Удалёнка"],
      [...mapping],
      2,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      company: "Ромашка",
      position: "Frontend",
      status: "rejected",
      appliedAt: "2026-10-15",
      salaryMin: 200_000,
      salaryMax: 250_000,
      workFormat: "remote",
    });
  });

  test("an unknown status is not an error, it is simply empty", () => {
    const result = normalizeRow(["Ромашка", "Frontend", "чепуха"], ["company", "position", "status"], 3);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.status).toBeNull();
  });

  test("a row without a company is reported, not silently dropped", () => {
    const result = normalizeRow(["", "Frontend"], ["company", "position"], 4);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("Company: required");
  });

  test("separate salary columns strip spaces", () => {
    const result = normalizeRow(
      ["Ромашка", "Frontend", "220 000", "280 000", "rub"],
      ["company", "position", "salaryMin", "salaryMax", "currency"],
      5,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.salaryMin).toBe(220_000);
      expect(result.value.salaryMax).toBe(280_000);
      expect(result.value.currency).toBe("RUB");
    }
  });

  test("the mapped columns are reported back", () => {
    const result = normalizeRow(["Ромашка", "Frontend"], ["company", "position"], 6);
    expect(result.ok).toBe(true);
    if (result.ok) expect([...result.mapped].sort()).toEqual(["company", "position"]);
  });
});

describe("matching an import against what is already stored", () => {
  function existing(over: Partial<Application> & { id: string }): Application {
    return {
      company: "Acme",
      position: "Developer",
      status: "sent",
      statusChangedAt: "2026-01-01T00:00:00.000Z",
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
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      ...over,
    };
  }

  function incoming(over: Partial<ImportedApplication> = {}): ImportedApplication {
    return {
      id: null,
      company: "Acme",
      position: "Developer",
      status: null,
      appliedAt: null,
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
      ...over,
    };
  }

  const row = (value: ImportedApplication, mapped: string[] = ["company", "position"]) => ({
    row: 2,
    value,
    mapped: new Set(mapped as ImportField[]),
  });

  test("the soft key ignores case, quotes and legal forms", () => {
    expect(matchKey("ООО «Ромашка»")).toBe(matchKey("ромашка"));
    expect(matchKey("ACME LLC")).toBe(matchKey("acme"));
  });

  test("a comma and a legal form do not matter", () => {
    expect(matchKey("Acme, Inc.")).toBe("acme");
    expect(matchKey("Acme, Inc.")).toBe(matchKey("ACME"));
    expect(matchKey("Ромашка, ООО")).toBe(matchKey("Ромашка"));
  });

  test("the same id beats a different date and becomes a conflict", () => {
    const plan = planImport(
      [
        row(incoming({ id: "a1", appliedAt: "2026-02-01", location: "Munich" }), [
          "company",
          "position",
          "location",
        ]),
      ],
      [existing({ id: "a1", appliedAt: "2026-01-01" })],
    );
    expect(plan.conflicts).toHaveLength(1);
    expect(plan.toCreate).toHaveLength(0);
    expect(plan.conflicts[0].changed).toEqual(["location"]);
  });

  test("same company and position with the same date is the same application", () => {
    const plan = planImport(
      [row(incoming({ appliedAt: "2026-01-01", location: "Berlin" }), ["company", "position", "location"])],
      [existing({ id: "a1", appliedAt: "2026-01-01" })],
    );
    expect(plan.conflicts).toHaveLength(1);
    expect(plan.conflicts[0].changed).toEqual(["location"]);
  });

  test("an identical row is skipped instead of becoming a conflict", () => {
    const plan = planImport(
      [row(incoming({ appliedAt: "2026-01-01" }))],
      [existing({ id: "a1", appliedAt: "2026-01-01" })],
    );
    expect(plan.unchanged).toEqual([2]);
    expect(plan.conflicts).toHaveLength(0);
  });

  test("a missing date on either side still matches", () => {
    const plan = planImport(
      [row(incoming({ appliedAt: null }))],
      [existing({ id: "a1", appliedAt: "2026-01-01" })],
    );
    expect(plan.toCreate).toHaveLength(0);
    expect(plan.unchanged).toEqual([2]);
  });

  test("the same company and position with another date is a new application", () => {
    const plan = planImport(
      [row(incoming({ appliedAt: "2026-02-01" }))],
      [existing({ id: "a1", appliedAt: "2026-01-01" })],
    );
    expect(plan.toCreate).toHaveLength(1);
    expect(plan.conflicts).toHaveLength(0);
  });

  test("a soft-key match is a conflict, not a duplicate", () => {
    const plan = planImport(
      [row(incoming({ company: "Ромашка", position: "Frontend", appliedAt: "2026-01-01" }))],
      [existing({ id: "a1", company: "ООО «Ромашка»", position: "frontend", appliedAt: "2026-01-01" })],
    );
    expect(plan.conflicts).toHaveLength(1);
  });

  test("notes alone make a conflict: there is something to merge", () => {
    const plan = planImport(
      [row(incoming({ appliedAt: "2026-01-01", notes: "Call on Monday" }))],
      [existing({ id: "a1", appliedAt: "2026-01-01" })],
    );
    expect(plan.conflicts).toHaveLength(1);
    expect(plan.unchanged).toHaveLength(0);
  });
});

describe("resolving a conflict", () => {
  const conflict: Conflict = {
    row: 2,
    existing: {
      id: "a1",
      company: "Acme",
      position: "Developer",
      status: "sent",
      statusChangedAt: "2026-01-01T00:00:00.000Z",
      appliedAt: "2026-01-01",
      url: null,
      location: "Berlin",
      workFormat: null,
      salaryMin: 1000,
      salaryMax: null,
      currency: null,
      contactName: null,
      contactInfo: null,
      source: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    incoming: {
      id: null,
      company: "Acme",
      position: "Developer",
      status: null,
      appliedAt: "2026-01-01",
      url: null,
      location: "Munich",
      workFormat: null,
      salaryMin: 2000,
      salaryMax: null,
      currency: null,
      contactName: null,
      contactInfo: null,
      source: null,
      notes: null,
    },
    fields: ["salaryMin", "location"],
    changed: ["salaryMin", "location"],
  };

  test("fields filled on both sides need a choice", () => {
    expect(mergeConflicts(conflict)).toEqual(["salaryMin", "location"]);
  });

  test("keeping the existing card changes nothing", () => {
    expect(resolveConflict(conflict, { kind: "existing" })).toEqual({});
  });

  test("taking the incoming card takes every changed field", () => {
    expect(resolveConflict(conflict, { kind: "incoming" })).toEqual({ salaryMin: 2000, location: "Munich" });
  });

  test("merging keeps the existing value unless the incoming one is picked", () => {
    expect(resolveConflict(conflict, { kind: "merge", picks: {} })).toEqual({});
    expect(resolveConflict(conflict, { kind: "merge", picks: { location: "incoming" } })).toEqual({
      location: "Munich",
    });
  });

  test("merging fills what is empty on the existing side", () => {
    const withEmpty = structuredClone(conflict);
    withEmpty.existing.location = null;
    withEmpty.changed = ["salaryMin", "location"];
    expect(resolveConflict(withEmpty, { kind: "merge", picks: {} })).toEqual({ location: "Munich" });
  });
});
