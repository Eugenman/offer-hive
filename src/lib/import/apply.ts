import type { ApplicationsRepository } from "@/lib/repository/types";
import { type Conflict, type ConflictChoice, resolveConflict } from "./match";
import type { ImportedApplication } from "./normalize";

export type ImportResult = { created: number; updated: number; kept: number };

async function create(repository: ApplicationsRepository, value: ImportedApplication) {
  const { notes, id: _ignoredId, status, ...fields } = value;
  void _ignoredId;
  const app = await repository.create({ ...fields, status: status ?? undefined });
  if (notes) await repository.addNote(app.id, { body: notes });
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
    if (status) await repository.changeStatus([conflict.existing.id], { status });
    // Notes from both sides are kept in every merge or take-new choice.
    if (conflict.incoming.notes) await repository.addNote(conflict.existing.id, { body: conflict.incoming.notes });
    result.updated += 1;
  }
  return result;
}
