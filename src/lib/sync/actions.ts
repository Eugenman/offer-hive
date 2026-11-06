"use server";

import { getCurrentUser } from "@/lib/dal";
import { getDb } from "@/lib/db";
import {
  createApplicationsRepository,
  type ChangeSet,
  type StoreSnapshot,
} from "@/lib/repository/repository";
import { changeSetSchema } from "./payload";
import { applyChanges, isSyncError, loadSnapshot } from "./server-data";

// The two calls the browser makes. Expected failures come back as values, not exceptions: Next.js
// hides the message of an exception thrown by a Server Action in production.

export type LoadResult =
  { ok: true; userId: string; data: StoreSnapshot } | { ok: false; reason: "signed_out" };

export type PushResult =
  { ok: true } | { ok: false; reason: "signed_out" | "invalid" | "forbidden" | "failed" };

/**
 * All of the signed-in user's data. `userId` tags the browser's queue, so changes made under one
 * account are never sent under another.
 */
export async function loadUserData(): Promise<LoadResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: "signed_out" };
  const db = getDb();
  const data = await loadSnapshot(db, user.id);
  const erased = await eraseExpiredArchive(data);
  if (!erased) return { ok: true, userId: user.id, data };
  await applyChanges(db, user.id, changeSetSchema.parse(erased));
  return { ok: true, userId: user.id, data: await loadSnapshot(db, user.id) };
}

/**
 * The archive keeps deleted applications for 30 days. The repository's own rules erase what is
 * older (and keep their statistics); here they run on the server copy, before the browser sees it.
 * Returns the changes to apply, or null when nothing expired.
 */
async function eraseExpiredArchive(snapshot: StoreSnapshot): Promise<ChangeSet | null> {
  let changes: ChangeSet | null = null;
  const repository = createApplicationsRepository({
    storage: {
      load: async () => snapshot,
      save: async (changeSet) => {
        changes = changeSet;
      },
    },
  });
  await repository.isPersistent(); // opens the repository, which erases expired applications
  return changes;
}

/**
 * Applies one batch from the browser's queue. The browser removes the batch from its queue only
 * after `ok: true`; any other answer tells it whether to retry ("failed") or drop the batch and
 * reload ("invalid", "forbidden").
 */
export async function pushChanges(changes: unknown): Promise<PushResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: "signed_out" };
  const parsed = changeSetSchema.safeParse(changes);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  try {
    await applyChanges(getDb(), user.id, parsed.data);
    return { ok: true };
  } catch (error) {
    if (isSyncError(error, "forbidden")) return { ok: false, reason: "forbidden" };
    // A broken rule of the data (class 23, e.g. a reference to a missing record) won't pass on
    // retry; anything else (connection, a sleeping database) may.
    if (postgresErrorClass(error) === "23") return { ok: false, reason: "invalid" };
    console.error("Couldn't apply changes", error);
    return { ok: false, reason: "failed" };
  }
}

/** The two-character class of a Postgres error code, also when Drizzle wraps the error. */
function postgresErrorClass(error: unknown): string | null {
  for (let current = error; current instanceof Error; current = current.cause) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === "string" && code.length === 5) return code.slice(0, 2);
  }
  return null;
}
