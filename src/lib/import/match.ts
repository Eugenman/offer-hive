import type { Application } from "@/lib/domain";
import type { ImportField } from "./fields";
import type { ImportedApplication } from "./normalize";

/** Application fields an import can change, in the order they are shown side by side. */
export const COMPARABLE_FIELDS = [
  "company",
  "position",
  "status",
  "appliedAt",
  "url",
  "salaryMin",
  "salaryMax",
  "currency",
  "workFormat",
  "location",
  "contactName",
  "contactInfo",
  "source",
] as const;
export type ComparableField = (typeof COMPARABLE_FIELDS)[number];

/** Which application fields a mapped column fills. */
function touchedFields(mapped: Set<ImportField>): Set<ComparableField> {
  const fields = new Set<ComparableField>();
  for (const field of mapped) {
    if (field === "salary")
      ["salaryMin", "salaryMax", "currency"].forEach((f) => fields.add(f as ComparableField));
    else if ((COMPARABLE_FIELDS as readonly string[]).includes(field)) fields.add(field as ComparableField);
  }
  return fields;
}

/** Soft key: case, spaces, quotes, ё/е and legal forms do not matter. */
export function matchKey(value: string) {
  return (
    value
      .toLocaleLowerCase("ru")
      .replaceAll("ё", "е")
      .replace(/["«»'„“”]/g, "")
      // \b is ASCII-only in JS, so word edges are spelled out for Cyrillic.
      .replace(/(^|\s)(ооо|оао|зао|пао|ао|ип|llc|inc|ltd|gmbh)\.?(?=\s|$)/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

export type Conflict = {
  row: number;
  existing: Application;
  incoming: ImportedApplication;
  /** Fields shown in the cards: everything the file filled. */
  fields: ComparableField[];
  /** Fields whose values differ. */
  changed: ComparableField[];
};

export type ImportPlan = {
  toCreate: { row: number; value: ImportedApplication }[];
  conflicts: Conflict[];
  unchanged: number[];
};

const sameValue = (a: unknown, b: unknown) => (a ?? null) === (b ?? null);

/**
 * Splits rows into new applications, conflicts with existing ones and exact duplicates.
 * Match = same ID, or same company + position with the same applied date (or one date empty).
 * Same company + position with a different date is a repeat application → new.
 */
export function planImport(
  rows: { row: number; value: ImportedApplication; mapped: Set<ImportField> }[],
  existing: Application[],
): ImportPlan {
  const plan: ImportPlan = { toCreate: [], conflicts: [], unchanged: [] };
  const byId = new Map(existing.map((app) => [app.id, app]));

  for (const { row, value, mapped } of rows) {
    const match =
      (value.id ? byId.get(value.id) : undefined) ??
      existing.find(
        (app) =>
          matchKey(app.company) === matchKey(value.company) &&
          matchKey(app.position) === matchKey(value.position) &&
          (!app.appliedAt || !value.appliedAt || app.appliedAt === value.appliedAt),
      );

    if (!match) {
      plan.toCreate.push({ row, value });
      continue;
    }

    const fields = COMPARABLE_FIELDS.filter((field) => touchedFields(mapped).has(field));
    const changed = fields.filter(
      (field) => !(field === "status" && value.status === null) && !sameValue(match[field], value[field]),
    );
    if (changed.length === 0 && !value.notes) plan.unchanged.push(row);
    else plan.conflicts.push({ row, existing: match, incoming: value, fields, changed });
  }
  return plan;
}

export type ConflictChoice =
  | { kind: "existing" }
  | { kind: "incoming" }
  /** Merge: empty values are filled from the other side; `picks` decides fields filled on both sides. */
  | { kind: "merge"; picks: Partial<Record<ComparableField, "existing" | "incoming">> };

/** Fields that are filled on both sides with different values — the user has to pick. */
export function mergeConflicts(conflict: Conflict): ComparableField[] {
  return conflict.changed.filter(
    (field) => conflict.existing[field] != null && conflict.incoming[field] != null,
  );
}

/** Resulting field values to write for a choice (only fields that actually change). */
export function resolveConflict(conflict: Conflict, choice: ConflictChoice): Partial<Application> {
  if (choice.kind === "existing") return {};
  const result: Partial<Record<ComparableField, unknown>> = {};
  for (const field of conflict.changed) {
    const mine = conflict.existing[field];
    const theirs = conflict.incoming[field];
    if (choice.kind === "incoming") {
      if (field === "status" && theirs == null) continue;
      result[field] = theirs;
    } else if (mine == null) {
      result[field] = theirs;
    } else if (theirs != null && choice.picks[field] === "incoming") {
      result[field] = theirs;
    }
  }
  return result as Partial<Application>;
}
