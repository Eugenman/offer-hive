import type { ApplicationsRepository } from "@/lib/repository/types";
import { type Conflict, type ConflictChoice, resolveConflict } from "./match";
import type { ImportedApplication } from "./normalize";

export type ImportResult = { created: number; updated: number; kept: number };

async function create(repository: ApplicationsRepository, value: ImportedApplication) {
  // Progress is written after the application: its id is needed, and its rules apply.
  const { notes, id: _ignoredId, status, events, history, ...fields } = value;
  void _ignoredId;
  // With a history the application starts where the history starts, and the rest is replayed:
  // otherwise the first status would be the last one and there would be nothing to log.
  const ordered = [...history].sort((a, b) => a.changedAt.localeCompare(b.changedAt));
  const initialStatus = ordered[0]?.toStatus ?? status ?? undefined;
  const app = await repository.create({ ...fields, status: initialStatus });
  if (notes) await repository.addNote(app.id, { body: notes });
  for (const event of events) {
    await repository.addStage(app.id, {
      type: event.type,
      interviewKind: event.interviewKind,
      title: event.title,
      scheduledAt: event.scheduledAt,
      state: event.state,
    });
  }
  await restoreHistory(repository, app.id, ordered);
}

/**
 * Replays the history of a backup: each entry is written with its own moment, oldest first. Entries
 * the application already has are skipped, so importing the same file twice does not double the log.
 * The creation record comes from the import itself, so it is skipped when it matches the status.
 */
async function restoreHistory(
  repository: ApplicationsRepository,
  applicationId: string,
  entries: ImportedApplication["history"],
) {
  if (entries.length === 0) return;
  const details = await repository.get(applicationId);
  const known = new Set(details?.statusChanges.map((change) => `${change.toStatus}|${change.changedAt}`));
  const current = details?.status;
  // The first entry is the status the application was created with — the import wrote it already.
  for (const entry of entries.slice(1)) {
    if (known.has(`${entry.toStatus}|${entry.changedAt}`)) continue;
    // "Created as …" is written by the import itself; rewriting it would duplicate the first row.
    if (entry.fromStatus === null && entry.toStatus === current) continue;
    await repository.changeStatus(
      [applicationId],
      { status: entry.toStatus, reason: entry.reason, changedAt: entry.changedAt },
      { ignoreRules: true },
    );
  }
}

/** Writes the import. Called only after every conflict has a decision. */
export async function applyImport(
  repository: ApplicationsRepository,
  toCreate: { value: ImportedApplication }[],
  decisions: { conflict: Conflict; choice: ConflictChoice }[],
): Promise<ImportResult> {
  const result: ImportResult = { created: 0, updated: 0, kept: 0 };

  for (const { value } of toCreate) {
    await create(repository, value);
    result.created += 1;
  }

  for (const { conflict, choice } of decisions) {
    if (choice.kind === "existing") {
      result.kept += 1;
      continue;
    }
    const { status, ...patch } = resolveConflict(conflict, choice);
    if (Object.keys(patch).length > 0) await repository.update(conflict.existing.id, patch);
    // The table is the source of truth here, so the status is taken as is, without transition rules.
    if (status) await repository.changeStatus([conflict.existing.id], { status }, { ignoreRules: true });
    // Notes from both sides are kept in every merge or take-new choice.
    if (conflict.incoming.notes)
      await repository.addNote(conflict.existing.id, { body: conflict.incoming.notes });
    result.updated += 1;
  }
  return result;
}
