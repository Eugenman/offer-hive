import { ZodError } from "zod";
import { NotFoundError } from "@/lib/repository/types";

/** Turns a repository error into a short message shown under the field. */
export function saveErrorMessage(error: unknown): string {
  if (error instanceof ZodError) return error.issues[0]?.message ?? "Проверьте значение";
  if (error instanceof NotFoundError) return "Отклик не найден — возможно, его удалили";
  return "Не удалось сохранить";
}

export async function trySave(run: () => Promise<unknown>): Promise<string | null> {
  try {
    await run();
    return null;
  } catch (error) {
    return saveErrorMessage(error);
  }
}
