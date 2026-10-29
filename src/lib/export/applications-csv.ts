import { type ApplicationDetails, STATUS_LABELS, WORK_FORMAT_LABELS } from "@/lib/domain";

// One row per application, headers and values in the interface language, all notes in one cell.
// The headers are among the import synonyms, so an exported file imports back as is.
const COLUMNS: { header: string; value: (app: ApplicationDetails) => string | number | null }[] = [
  { header: "ID", value: (app) => app.id },
  { header: "Company", value: (app) => app.company },
  { header: "Position", value: (app) => app.position },
  { header: "Status", value: (app) => STATUS_LABELS[app.status] },
  { header: "Date applied", value: (app) => app.appliedAt },
  { header: "Link", value: (app) => app.url },
  { header: "Salary from", value: (app) => app.salaryMin },
  { header: "Salary to", value: (app) => app.salaryMax },
  { header: "Currency", value: (app) => app.currency },
  { header: "Work format", value: (app) => (app.workFormat ? WORK_FORMAT_LABELS[app.workFormat] : null) },
  { header: "Location", value: (app) => app.location },
  { header: "Contact", value: (app) => app.contactName },
  { header: "Contact info", value: (app) => app.contactInfo },
  { header: "Source", value: (app) => app.source },
  {
    header: "Notes",
    // Oldest first, so the cell reads like a diary.
    value: (app) =>
      [...app.notes]
        .reverse()
        .map((note) => note.body)
        .join("\n") || null,
  },
];

function escapeCell(value: string | number | null) {
  if (value === null) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function buildApplicationsCsv(applications: ApplicationDetails[]) {
  const lines = [
    COLUMNS.map((column) => escapeCell(column.header)).join(","),
    ...applications.map((app) => COLUMNS.map((column) => escapeCell(column.value(app))).join(",")),
  ];
  // BOM so Excel on Windows opens Cyrillic as UTF-8; CRLF line ends per RFC 4180.
  return `﻿${lines.join("\r\n")}\r\n`;
}

export type ExportFormat = "csv" | "xlsx";

/**
 * The same columns as an Excel workbook. Dates are real date cells, so Excel can sort and filter
 * them; SheetJS is loaded only when someone exports.
 */
export async function buildApplicationsXlsx(applications: ApplicationDetails[]): Promise<ArrayBuffer> {
  const xlsx = await import("xlsx");
  const rows = applications.map((app) =>
    COLUMNS.map((column) => {
      const value = column.value(app);
      return column.header === "Date applied" && typeof value === "string"
        ? new Date(`${value}T00:00:00Z`)
        : value;
    }),
  );
  const sheet = xlsx.utils.aoa_to_sheet([COLUMNS.map((column) => column.header), ...rows], {
    cellDates: true,
    dateNF: "yyyy-mm-dd",
  });
  sheet["!cols"] = COLUMNS.map((column) => ({ wch: column.header === "Notes" ? 60 : 18 }));
  const book = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(book, sheet, "Applications");
  return xlsx.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

export function downloadFile(content: BlobPart, fileName: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportFileName(format: ExportFormat = "csv", date = new Date()) {
  return `offerhive-${date.toISOString().slice(0, 10)}.${format}`;
}
