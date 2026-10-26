export const APPLICATION_STATUSES = [
  "sent",
  "interview",
  "test_task",
  "offer",
  "rejected",
  "withdrawn",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  sent: "Отправлен",
  interview: "Интервью",
  test_task: "Тестовое",
  offer: "Оффер",
  rejected: "Отказ",
  withdrawn: "Отказался",
};

export type WorkFormat = "office" | "hybrid" | "remote";

export const WORK_FORMAT_LABELS: Record<WorkFormat, string> = {
  office: "Офис",
  hybrid: "Гибрид",
  remote: "Удалёнка",
};

export type Note = {
  id: string;
  body: string;
  createdAt: string;
};

export type Application = {
  id: string;
  company: string;
  position: string;
  status: ApplicationStatus;
  appliedAt: string | null;
  url: string | null;
  location: string | null;
  workFormat: WorkFormat | null;
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string | null;
  contactName: string | null;
  contactInfo: string | null;
  source: string | null;
  notes: Note[];
};
