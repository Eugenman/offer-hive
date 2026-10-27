import { type ApplicationDetails, STATUS_LABELS, WORK_FORMAT_LABELS } from "@/lib/domain";

// "Таблица откликов" format (see the agreed template): one row per application,
// headers and values in the interface language, all notes in one cell.
const COLUMNS: { header: string; value: (app: ApplicationDetails) => string | number | null }[] = [
  { header: "ID", value: (app) => app.id },
  { header: "Компания", value: (app) => app.company },
  { header: "Должность", value: (app) => app.position },
  { header: "Статус", value: (app) => STATUS_LABELS[app.status] },
  { header: "Дата отклика", value: (app) => app.appliedAt },
  { header: "Ссылка", value: (app) => app.url },
  { header: "Зарплата от", value: (app) => app.salaryMin },
  { header: "Зарплата до", value: (app) => app.salaryMax },
  { header: "Валюта", value: (app) => app.currency },
  { header: "Формат", value: (app) => (app.workFormat ? WORK_FORMAT_LABELS[app.workFormat] : null) },
  { header: "Город", value: (app) => app.location },
  { header: "Контакт", value: (app) => app.contactName },
  { header: "Контакт: email или Telegram", value: (app) => app.contactInfo },
  { header: "Источник", value: (app) => app.source },
  {
    header: "Заметки",
    // Oldest first, so the cell reads like a diary.
    value: (app) => [...app.notes].reverse().map((note) => note.body).join("\n") || null,
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

export function downloadFile(content: string, fileName: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportFileName(date = new Date()) {
  return `offerhive-${date.toISOString().slice(0, 10)}.csv`;
}
