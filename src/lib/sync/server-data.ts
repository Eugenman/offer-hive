import { and, asc, eq, getTableColumns, inArray, ne, sql, type SQL } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "@/lib/db/schema";
import type { StoreSnapshot } from "@/lib/repository/repository";
import type { ValidChangeSet } from "./payload";

// The server side of sync: one user's data as a snapshot, and a batch of changes applied to it.
// Both take the database as a parameter, so they run the same from a Server Action and a script.

type Db = PostgresJsDatabase<typeof schema>;

export type SyncErrorKind = "forbidden";
export type SyncError = Error & { kind: SyncErrorKind };

const syncError = (kind: SyncErrorKind, message: string): SyncError =>
  Object.assign(new Error(message), { kind });

export function isSyncError(error: unknown, kind: SyncErrorKind): error is SyncError {
  return error instanceof Error && (error as Partial<SyncError>).kind === kind;
}

/** A copy of the row without one field (the owner, or a value the database doesn't store). */
function omit<T extends object, K extends keyof T>(row: T, key: K): Omit<T, K> {
  const rest: Partial<T> = { ...row };
  delete rest[key];
  return rest as Omit<T, K>;
}

const toDate = (value: string) => new Date(value);
const toDateOrNull = (value: string | null) => (value === null ? null : new Date(value));
const toIso = (value: Date) => value.toISOString();
const toIsoOrNull = (value: Date | null) => (value === null ? null : value.toISOString());

/** Everything the user has, in the shape the repository loads. */
export async function loadSnapshot(db: Db, userId: string): Promise<StoreSnapshot> {
  const [apps, stages, notes, changes, statistics] = await Promise.all([
    db.select().from(schema.applications).where(eq(schema.applications.userId, userId)),
    db
      .select()
      .from(schema.applicationStages)
      .where(eq(schema.applicationStages.userId, userId))
      .orderBy(asc(schema.applicationStages.seq)),
    db.select().from(schema.notes).where(eq(schema.notes.userId, userId)),
    db
      .select()
      .from(schema.statusChanges)
      .where(eq(schema.statusChanges.userId, userId))
      .orderBy(asc(schema.statusChanges.seq), asc(schema.statusChanges.changedAt)),
    db.select().from(schema.deletedStatistics).where(eq(schema.deletedStatistics.userId, userId)),
  ]);

  return {
    applications: apps.map((row) => ({
      ...omit(row, "userId"),
      statusChangedAt: toIso(row.statusChangedAt),
      createdAt: toIso(row.createdAt),
      updatedAt: toIso(row.updatedAt),
      deletedAt: toIsoOrNull(row.deletedAt),
    })),
    stages: stages.map((row) => ({
      ...omit(row, "userId"),
      scheduledAt: toIsoOrNull(row.scheduledAt),
      createdAt: toIso(row.createdAt),
      updatedAt: toIso(row.updatedAt),
    })),
    notes: notes.map((row) => ({
      ...omit(row, "userId"),
      createdAt: toIso(row.createdAt),
      updatedAt: toIso(row.updatedAt),
    })),
    statusChanges: changes.map((row) => ({
      ...omit(row, "userId"),
      changedAt: toIso(row.changedAt),
    })),
    deletedStatistics: statistics.map((row) => ({
      ...omit(row, "userId"),
      state: "deleted" as const,
      deletedAt: toIso(row.deletedAt),
    })),
  };
}

/** `SET column = excluded.column` for every column except the key and the owner. */
function updateFromExcluded(table: PgTable & { id: PgColumn; userId: PgColumn }): Record<string, SQL> {
  const set: Record<string, SQL> = {};
  for (const [key, column] of Object.entries(getTableColumns(table))) {
    if (key === "id" || key === "userId") continue;
    set[key] = sql.raw(`excluded."${(column as PgColumn).name}"`);
  }
  return set;
}

/** Postgres takes at most 65 535 parameters per statement; big imports go in slices. */
function chunks<T>(rows: T[], size = 500): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type OwnedTable = PgTable & { id: PgColumn; userId: PgColumn };

/** Rejects ids that already exist and belong to someone else (a forged or colliding id). */
async function assertNotForeign(tx: Tx, table: OwnedTable, ids: string[], userId: string) {
  for (const slice of chunks(ids)) {
    const [foreign] = await tx
      .select({ id: table.id })
      .from(table)
      .where(and(inArray(table.id, slice), ne(table.userId, userId)))
      .limit(1);
    if (foreign) throw syncError("forbidden", "A record belongs to another account");
  }
}

/** Every referenced row must exist and belong to the user (checked after this batch's writes). */
async function assertOwned(tx: Tx, table: OwnedTable, ids: string[], userId: string) {
  const unique = [...new Set(ids)];
  for (const slice of chunks(unique)) {
    const owned = await tx
      .select({ id: table.id })
      .from(table)
      .where(and(inArray(table.id, slice), eq(table.userId, userId)));
    if (owned.length !== slice.length) throw syncError("forbidden", "A reference points outside the account");
  }
}

async function upsert<T extends Record<string, unknown>>(
  tx: Tx,
  table: OwnedTable,
  rows: T[],
  userId: string,
) {
  if (rows.length === 0) return;
  await assertNotForeign(
    tx,
    table,
    rows.map((row) => row.id as string),
    userId,
  );
  const set = updateFromExcluded(table);
  for (const slice of chunks(rows)) {
    await tx
      .insert(table)
      .values(slice.map((row) => ({ ...row, userId })))
      .onConflictDoUpdate({ target: table.id, set });
  }
}

async function remove(tx: Tx, table: OwnedTable, ids: string[], userId: string) {
  for (const slice of chunks(ids)) {
    await tx.delete(table).where(and(inArray(table.id, slice), eq(table.userId, userId)));
  }
}

/**
 * Applies one batch of changes for the user, all or nothing. Safe to repeat: writes are
 * "insert or update" by id and deletes of missing rows do nothing, so a batch resent after a lost
 * confirmation changes nothing. The last batch to arrive wins.
 */
export async function applyChanges(db: Db, userId: string, changes: ValidChangeSet): Promise<void> {
  await db.transaction(async (tx) => {
    // Parents before children for writes...
    await upsert(
      tx,
      schema.applications,
      changes.applications.put.map((row) => ({
        ...row,
        statusChangedAt: toDate(row.statusChangedAt),
        createdAt: toDate(row.createdAt),
        updatedAt: toDate(row.updatedAt),
        deletedAt: toDateOrNull(row.deletedAt),
      })),
      userId,
    );
    await upsert(
      tx,
      schema.applicationStages,
      changes.stages.put.map((row) => ({
        ...row,
        scheduledAt: toDateOrNull(row.scheduledAt),
        createdAt: toDate(row.createdAt),
        updatedAt: toDate(row.updatedAt),
      })),
      userId,
    );
    await upsert(
      tx,
      schema.notes,
      changes.notes.put.map((row) => ({
        ...row,
        createdAt: toDate(row.createdAt),
        updatedAt: toDate(row.updatedAt),
      })),
      userId,
    );
    await upsert(
      tx,
      schema.statusChanges,
      changes.statusChanges.put.map((row) => ({ ...row, changedAt: toDate(row.changedAt) })),
      userId,
    );
    await upsert(
      tx,
      schema.deletedStatistics,
      changes.deletedStatistics.put.map((row) => ({
        ...omit(row, "state"),
        deletedAt: toDate(row.deletedAt),
      })),
      userId,
    );

    // ...children before parents for deletes (cascades would do it too, but only within the account).
    await remove(tx, schema.notes, changes.notes.delete, userId);
    await remove(tx, schema.statusChanges, changes.statusChanges.delete, userId);
    await remove(tx, schema.applicationStages, changes.stages.delete, userId);
    await remove(tx, schema.applications, changes.applications.delete, userId);
    await remove(tx, schema.deletedStatistics, changes.deletedStatistics.delete, userId);

    // Records may only point at the user's own applications and stages.
    await assertOwned(
      tx,
      schema.applications,
      [
        ...changes.stages.put.map((row) => row.applicationId),
        ...changes.notes.put.map((row) => row.applicationId),
        ...changes.statusChanges.put.map((row) => row.applicationId),
      ],
      userId,
    );
    await assertOwned(
      tx,
      schema.applicationStages,
      changes.notes.put.flatMap((row) => (row.stageId ? [row.stageId] : [])),
      userId,
    );
  });
}
