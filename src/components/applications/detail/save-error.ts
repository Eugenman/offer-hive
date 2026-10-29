import { ZodError } from "zod";
import { isRepositoryError } from "@/lib/repository/types";

/** Turns a repository error into a short message shown under the field. */
export function saveErrorMessage(error: unknown): string {
  if (error instanceof ZodError) return error.issues[0]?.message ?? "Check the value";
  if (isRepositoryError(error, "not_found")) return "Application not found. It may have been deleted";
  return "Couldn’t save";
}

export async function trySave(run: () => Promise<unknown>): Promise<string | null> {
  try {
    await run();
    return null;
  } catch (error) {
    return saveErrorMessage(error);
  }
}
