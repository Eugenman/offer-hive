import { z } from "zod";
import { APPLICATION_STATUSES } from "@/lib/domain";
import type { StoreSnapshot } from "@/lib/repository/repository";

// A backup is the whole store as JSON: applications, progress, notes, status history, the archive
// and statistics of deleted applications. Unlike a spreadsheet, it restores everything.

const FORMAT = "offerhive-backup";
const VERSION = 1;

const status = z.enum(APPLICATION_STATUSES);
const row = z.looseObject({ id: z.string() });
const childRow = row.extend({ applicationId: z.string() });

const backupSchema = z.object({
  format: z.literal(FORMAT),
  version: z.number().int().min(1).max(VERSION),
  exportedAt: z.string(),
  data: z.object({
    applications: z.array(
      row.extend({
        company: z.string(),
        position: z.string(),
        status,
        deletedAt: z.string().nullable(),
      }),
    ),
    stages: z.array(childRow),
    notes: z.array(childRow),
    statusChanges: z.array(childRow.extend({ toStatus: status, seq: z.number() })),
    deletedStatistics: z.array(row.extend({ company: z.string(), status })).default([]),
  }),
});

export function buildBackup(snapshot: StoreSnapshot, now = new Date()) {
  return JSON.stringify({ format: FORMAT, version: VERSION, exportedAt: now.toISOString(), data: snapshot });
}

export function backupFileName(date = new Date()) {
  return `offerhive-backup-${date.toISOString().slice(0, 10)}.json`;
}

export type ParsedBackup =
  { ok: true; snapshot: StoreSnapshot; exportedAt: string; applications: number } | { ok: false };

/** Checks that the file is an Offerhive backup before anything is replaced. */
export function parseBackup(text: string): ParsedBackup {
  try {
    const result = backupSchema.safeParse(JSON.parse(text));
    if (!result.success) return { ok: false };
    const { data, exportedAt } = result.data;
    return {
      ok: true,
      // The schema checks the fields that matter for restoring; the rest is kept as saved.
      snapshot: data as unknown as StoreSnapshot,
      exportedAt,
      applications: data.applications.length,
    };
  } catch {
    return { ok: false };
  }
}
