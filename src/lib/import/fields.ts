// Target fields a spreadsheet column can be mapped to, with header synonyms (RU / EN).

export const IMPORT_FIELDS = [
  "company",
  "position",
  "status",
  "appliedAt",
  "url",
  "salary",
  "salaryMin",
  "salaryMax",
  "currency",
  "workFormat",
  "location",
  "contactName",
  "contactInfo",
  "source",
  "notes",
  "id",
] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];

export const IMPORT_FIELD_LABELS: Record<ImportField, string> = {
  company: "Компания",
  position: "Должность",
  status: "Статус",
  appliedAt: "Дата отклика",
  url: "Ссылка",
  salary: "Зарплата (одной колонкой)",
  salaryMin: "Зарплата от",
  salaryMax: "Зарплата до",
  currency: "Валюта",
  workFormat: "Формат",
  location: "Город",
  contactName: "Контакт",
  contactInfo: "Контакт: email или Telegram",
  source: "Источник",
  notes: "Заметки",
  id: "ID",
};

export const REQUIRED_IMPORT_FIELDS: readonly ImportField[] = ["company", "position"];

const SYNONYMS: Record<ImportField, string[]> = {
  company: ["компания", "работодатель", "организация", "company", "employer", "organization"],
  position: ["должность", "вакансия", "позиция", "роль", "position", "job title", "title", "role", "vacancy"],
  status: ["статус", "этап", "status", "stage"],
  appliedAt: ["дата отклика", "дата", "когда откликнулся", "откликнулся", "applied", "date applied", "date"],
  url: ["ссылка", "ссылка на вакансию", "url", "link"],
  salary: ["зарплата", "вилка", "оклад", "salary", "compensation"],
  salaryMin: ["зарплата от", "salary min", "salary from"],
  salaryMax: ["зарплата до", "salary max", "salary to"],
  currency: ["валюта", "currency"],
  workFormat: ["формат", "формат работы", "work format", "format"],
  location: ["город", "локация", "location", "city"],
  contactName: ["контакт", "рекрутер", "contact", "recruiter"],
  contactInfo: ["контакт: email или telegram", "email", "почта", "телеграм", "telegram", "contact info"],
  source: ["источник", "где нашёл", "где нашел", "откуда", "source", "found on"],
  notes: ["заметки", "заметка", "комментарий", "комментарии", "примечание", "notes", "note", "comment", "comments"],
  id: ["id"],
};

export function normalizeHeader(header: string) {
  return header.toLocaleLowerCase("ru").replaceAll("ё", "е").replace(/\s+/g, " ").trim();
}

/** Guesses a field for every column; each field is used at most once. */
export function autoMap(headers: string[]): (ImportField | null)[] {
  const used = new Set<ImportField>();
  return headers.map((header) => {
    const name = normalizeHeader(header);
    const field = IMPORT_FIELDS.find(
      (candidate) =>
        !used.has(candidate) && SYNONYMS[candidate].some((synonym) => normalizeHeader(synonym) === name),
    );
    if (!field) return null;
    used.add(field);
    return field;
  });
}
