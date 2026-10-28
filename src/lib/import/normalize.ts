import { type ApplicationStatus, type WorkFormat } from "@/lib/domain";
import { applicationInputSchema } from "@/lib/schemas";
import { type ImportField, normalizeHeader } from "./fields";

export type RawRow = string[];

/** One spreadsheet row turned into our shape. `notes` is kept apart: it becomes a note, not a field. */
export type ImportedApplication = {
  id: string | null;
  company: string;
  position: string;
  status: ApplicationStatus | null;
  appliedAt: string | null;
  url: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string | null;
  workFormat: WorkFormat | null;
  location: string | null;
  contactName: string | null;
  contactInfo: string | null;
  source: string | null;
  notes: string | null;
};

export type RowResult =
  | { ok: true; row: number; value: ImportedApplication; mapped: Set<ImportField> }
  | { ok: false; row: number; reason: string };

const STATUS_SYNONYMS: Record<ApplicationStatus, string[]> = {
  sent: ["отправлен", "отправлено", "отклик", "откликнулся", "ждем ответа", "ждём ответа", "sent", "applied"],
  screening: ["скрининг", "hr-скрининг", "звонок рекрутера", "screening", "phone screen", "recruiter screen"],
  interview: ["интервью", "собеседование", "собес", "interview"],
  technical: ["техническое", "техническое интервью", "техсобес", "technical", "technical interview"],
  test_task: ["тестовое", "тестовое задание", "тз", "test", "test task", "assignment"],
  offer: ["оффер", "предложение", "offer"],
  offer_discussion: ["обсуждение оффера", "переговоры", "negotiation", "negotiations"],
  rejected: ["отказ", "отказали", "rejected", "rejection", "declined by company"],
  withdrawn: ["отказался", "отозван", "withdrawn", "withdrew"],
};

const FORMAT_SYNONYMS: Record<WorkFormat, string[]> = {
  office: ["офис", "office", "onsite", "on-site"],
  hybrid: ["гибрид", "hybrid"],
  remote: ["удалёнка", "удаленка", "удалённо", "удаленно", "remote"],
};

function fromSynonyms<T extends string>(value: string, table: Record<T, string[]>): T | null {
  const needle = normalizeHeader(value);
  for (const [key, list] of Object.entries(table) as [T, string[]][]) {
    if (list.some((item) => normalizeHeader(item) === needle)) return key;
  }
  return null;
}

/** "15.10.2026", "2026-10-15", "15/10/2026" or an Excel serial number → "2026-10-15". */
export function parseDate(value: string): string | null {
  const text = value.trim();
  let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) return iso(+match[1], +match[2], +match[3]);
  match = text.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/);
  if (match) {
    const year = match[3].length === 2 ? 2000 + +match[3] : +match[3];
    return iso(year, +match[2], +match[1]);
  }
  if (/^\d{5}$/.test(text)) {
    // Excel stores dates as days since 1899-12-30.
    const date = new Date(Date.UTC(1899, 11, 30) + Number(text) * 86_400_000);
    return date.toISOString().slice(0, 10);
  }
  return null;
}

function iso(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}

const CURRENCY_SIGNS: Record<string, string> = { "₽": "RUB", руб: "RUB", $: "USD", "€": "EUR" };

/** "200-250к", "от 3000$", "220 000–280 000 RUB", "до 150 тыс" → min / max / currency. */
export function parseSalary(value: string) {
  const text = value.toLocaleLowerCase("ru").replace(/\s+/g, " ").trim();
  const thousands = /(\d)\s?(к|k|тыс)/.test(text);
  const numbers = [...text.replace(/(\d) (?=\d{3}\b)/g, "$1").matchAll(/\d+(?:[.,]\d+)?/g)].map((m) =>
    Math.round(Number(m[0].replace(",", ".")) * (thousands ? 1000 : 1)),
  );
  const code = text.match(/\b(rub|usd|eur)\b/)?.[1]?.toUpperCase();
  const sign = Object.keys(CURRENCY_SIGNS).find((s) => text.includes(s));
  const currency = code ?? (sign ? CURRENCY_SIGNS[sign] : null);
  if (numbers.length === 0) return { salaryMin: null, salaryMax: null, currency };
  if (numbers.length >= 2) return { salaryMin: numbers[0], salaryMax: numbers[1], currency };
  if (text.startsWith("до")) return { salaryMin: null, salaryMax: numbers[0], currency };
  return { salaryMin: numbers[0], salaryMax: null, currency };
}

function toNumber(value: string) {
  const digits = value.replace(/[\s ]/g, "");
  return /^\d+$/.test(digits) ? Number(digits) : null;
}

/** Applies the column mapping to one row and validates it with the same schema as the form. */
export function normalizeRow(cells: RawRow, mapping: (ImportField | null)[], row: number): RowResult {
  const value: ImportedApplication = {
    id: null,
    company: "",
    position: "",
    status: null,
    appliedAt: null,
    url: null,
    salaryMin: null,
    salaryMax: null,
    currency: null,
    workFormat: null,
    location: null,
    contactName: null,
    contactInfo: null,
    source: null,
    notes: null,
  };
  const mapped = new Set<ImportField>();

  mapping.forEach((field, index) => {
    const cell = (cells[index] ?? "").trim();
    if (!field) return;
    mapped.add(field);
    if (!cell) return;
    switch (field) {
      case "status":
        value.status = fromSynonyms(cell, STATUS_SYNONYMS);
        break;
      case "workFormat":
        value.workFormat = fromSynonyms(cell, FORMAT_SYNONYMS);
        break;
      case "appliedAt":
        value.appliedAt = parseDate(cell);
        break;
      case "salary":
        Object.assign(value, parseSalary(cell));
        break;
      case "salaryMin":
      case "salaryMax":
        value[field] = toNumber(cell);
        break;
      case "currency":
        value.currency = cell.toUpperCase().slice(0, 5);
        break;
      default:
        value[field] = cell;
    }
  });

  const check = applicationInputSchema.safeParse({ ...value, status: value.status ?? undefined });
  if (!check.success) {
    const issue = check.error.issues[0];
    const field = String(issue.path[0] ?? "");
    const label = field === "company" ? "Компания" : field === "position" ? "Должность" : field;
    return { ok: false, row, reason: `${label}: ${issue.message.toLowerCase()}` };
  }
  return { ok: true, row, value, mapped };
}
