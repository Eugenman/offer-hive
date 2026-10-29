import type { WorkSheet } from "xlsx";
import type { RawRow } from "./normalize";

/** A spreadsheet as the import needs it: one header row and the rows below it, all as text. */
export type ParsedTable = {
  headers: string[];
  rows: RawRow[];
  /** Row numbers as the user sees them in the file, for error messages. */
  rowNumbers: number[];
  sheetName: string | null;
};

export type ReadResult =
  { ok: true; table: ParsedTable } | { ok: false; reason: "too_large" | "unreadable" | "empty" };

export const MAX_FILE_BYTES = 10 * 1024 * 1024;

const TEXT_EXTENSIONS = ["csv", "tsv", "txt"];
const DELIMITERS = [",", ";", "\t"] as const;

const extensionOf = (name: string) => name.split(".").pop()?.toLowerCase() ?? "";

/**
 * Text files come from many places: UTF-8 from Google Sheets and Numbers, Windows-1251 from
 * Russian Excel. UTF-8 is tried strictly first, so a 1251 file is never read as garbage.
 */
export function decodeText(bytes: ArrayBuffer): string {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    text = new TextDecoder("windows-1251").decode(bytes);
  }
  return text.replace(/^﻿/, "");
}

/** The separator used most in the first line, outside quotes: "," (most apps), ";" (Excel in many locales) or tab. */
export function detectDelimiter(text: string): (typeof DELIMITERS)[number] {
  const firstLine = text.split(/\r?\n/).find((line) => line.trim()) ?? "";
  const counts = new Map<string, number>(DELIMITERS.map((d) => [d, 0]));
  let quoted = false;
  for (const char of firstLine) {
    if (char === '"') quoted = !quoted;
    else if (!quoted && counts.has(char)) counts.set(char, counts.get(char)! + 1);
  }
  return [...DELIMITERS].sort((a, b) => counts.get(b)! - counts.get(a)!)[0];
}

/** Excel stores dates as days since 1899-12-30. */
function isoFromSerial(serial: number) {
  return new Date(Date.UTC(1899, 11, 30) + Math.round(serial) * 86_400_000).toISOString().slice(0, 10);
}

/** Every cell as trimmed text; date cells become YYYY-MM-DD so the import reads them without guessing. */
function sheetToText(sheet: WorkSheet, xlsx: typeof import("xlsx")): string[][] {
  if (!sheet["!ref"]) return [];
  const range = xlsx.utils.decode_range(sheet["!ref"]);
  const grid: string[][] = [];
  for (let r = range.s.r; r <= range.e.r; r += 1) {
    const row: string[] = [];
    for (let c = range.s.c; c <= range.e.c; c += 1) {
      const cell = sheet[xlsx.utils.encode_cell({ r, c })];
      if (!cell || cell.v === undefined || cell.v === null) row.push("");
      else if (cell.t === "n" && cell.z && xlsx.SSF.is_date(cell.z))
        row.push(isoFromSerial(cell.v as number));
      else if (cell.t === "d" && cell.v instanceof Date) row.push(cell.v.toISOString().slice(0, 10));
      else row.push(String(cell.v).trim());
    }
    grid.push(row);
  }
  return grid;
}

/** The header is the first row with at least two filled cells; blank rows below it are skipped. */
function toTable(grid: string[][], sheetName: string | null): ParsedTable | null {
  const headerIndex = grid.findIndex((row) => row.filter(Boolean).length >= 2);
  if (headerIndex === -1) return null;
  const header = grid[headerIndex];
  const width = header.length - [...header].reverse().findIndex(Boolean);
  const headers = header.slice(0, width).map((name, i) => name || `Column ${i + 1}`);
  const rows: RawRow[] = [];
  const rowNumbers: number[] = [];
  grid.slice(headerIndex + 1).forEach((cells, offset) => {
    const row = cells.slice(0, width);
    if (!row.some(Boolean)) return;
    while (row.length < width) row.push("");
    rows.push(row);
    rowNumbers.push(headerIndex + offset + 2);
  });
  return rows.length ? { headers, rows, rowNumbers, sheetName } : null;
}

/**
 * Reads Excel (xlsx, xls, xlsb), LibreOffice (ods, fods), Numbers and CSV/TSV files in the browser.
 * The file never leaves the device. SheetJS is loaded only when a file is chosen.
 */
export async function readSpreadsheet(file: File): Promise<ReadResult> {
  if (file.size > MAX_FILE_BYTES) return { ok: false, reason: "too_large" };
  try {
    const xlsx = await import("xlsx");
    const bytes = await file.arrayBuffer();
    const workbook = TEXT_EXTENSIONS.includes(extensionOf(file.name))
      ? (() => {
          const text = decodeText(bytes);
          // raw: keep "03/10/2026" or "120,000" as typed; the import normalizes values itself.
          return xlsx.read(text, { type: "string", FS: detectDelimiter(text), raw: true });
        })()
      : // cellNF keeps each cell's number format, which is how a date cell is told from a number.
        xlsx.read(bytes, { type: "array", cellNF: true });
    for (const name of workbook.SheetNames) {
      const table = toTable(
        sheetToText(workbook.Sheets[name], xlsx),
        workbook.SheetNames.length > 1 ? name : null,
      );
      if (table) return { ok: true, table };
    }
    return { ok: false, reason: "empty" };
  } catch (error) {
    console.warn("Couldn't read the spreadsheet", error);
    return { ok: false, reason: "unreadable" };
  }
}
