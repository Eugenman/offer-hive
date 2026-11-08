/** How the report at the end of an import should read. */
export type ImportTone = "ok" | "warn" | "bad";

/**
 * A clean run says "finished"; a run that saved something but hit bad rows says so;
 * a run that saved nothing must not claim success — the green check made that bug obvious.
 */
export function importReport(saved: number, invalid: number): { title: string; tone: ImportTone } {
  if (invalid === 0) return { title: "Import finished", tone: "ok" };
  if (saved === 0) return { title: "Nothing imported", tone: "bad" };
  return { title: "Import finished with errors", tone: "warn" };
}
