import type { Application, Note, Stage, StatusChange } from "./domain";
import type { MemorySeed } from "./repository/memory";

// Fictional demo data for the in-memory stage: companies, people and contacts are made up.
// Replaced by real storage in stage 2.

const at = (date: string, time = "10:00") => `${date}T${time}:00.000Z`;

type SeedApplication = Omit<Application, "statusChangedAt" | "createdAt" | "updatedAt"> & {
  createdOn: string;
  history: { to: Application["status"]; on: string; reason?: string }[];
};

const APPLICATIONS: SeedApplication[] = [
  {
    id: "a1",
    company: "Северный Ветер",
    position: "Frontend-разработчик",
    status: "interview",
    appliedAt: "2026-10-12",
    url: "https://example.com/jobs/frontend",
    location: "Москва",
    workFormat: "hybrid",
    salaryMin: 250000,
    salaryMax: 300000,
    currency: "RUB",
    contactName: "Мария",
    contactInfo: "maria@example.com",
    source: "hh.ru",
    createdOn: "2026-10-12",
    history: [
      { to: "sent", on: "2026-10-12" },
      { to: "screening", on: "2026-10-16" },
      { to: "interview", on: "2026-10-22" },
    ],
  },
  {
    id: "a2",
    company: "Ромашка Тех",
    position: "React Developer",
    status: "sent",
    appliedAt: "2026-10-15",
    url: null,
    location: "Москва",
    workFormat: "office",
    salaryMin: 220000,
    salaryMax: 280000,
    currency: "RUB",
    contactName: null,
    contactInfo: null,
    source: "LinkedIn",
    createdOn: "2026-10-15",
    history: [{ to: "sent", on: "2026-10-15" }],
  },
  {
    id: "a3",
    company: "Облако-9",
    position: "TypeScript Engineer",
    status: "test_task",
    appliedAt: "2026-10-18",
    url: null,
    location: null,
    workFormat: "remote",
    salaryMin: null,
    salaryMax: null,
    currency: null,
    contactName: "Игорь",
    contactInfo: "igor@example.com",
    source: "Реферал",
    createdOn: "2026-10-18",
    history: [
      { to: "sent", on: "2026-10-18" },
      { to: "screening", on: "2026-10-19" },
      { to: "test_task", on: "2026-10-20" },
    ],
  },
  {
    id: "a4",
    company: "Синяя Птица",
    position: "Senior Frontend",
    status: "offer",
    appliedAt: "2026-10-01",
    url: null,
    location: "Санкт-Петербург",
    workFormat: "hybrid",
    salaryMin: 350000,
    salaryMax: null,
    currency: "RUB",
    contactName: null,
    contactInfo: null,
    source: "hh.ru",
    createdOn: "2026-10-01",
    history: [
      { to: "sent", on: "2026-10-01" },
      { to: "screening", on: "2026-10-04" },
      { to: "interview", on: "2026-10-08" },
      { to: "technical", on: "2026-10-15" },
      { to: "offer", on: "2026-10-25" },
    ],
  },
  {
    id: "a5",
    company: "Пиксель и Ко",
    position: "UI Engineer",
    status: "rejected",
    appliedAt: "2026-10-03",
    url: null,
    location: "Москва",
    workFormat: "office",
    salaryMin: 200000,
    salaryMax: null,
    currency: "RUB",
    contactName: null,
    contactInfo: null,
    source: "hh.ru",
    createdOn: "2026-10-03",
    history: [
      { to: "sent", on: "2026-10-03" },
      { to: "rejected", on: "2026-10-11", reason: "Искали опыт с Vue" },
    ],
  },
  {
    id: "a6",
    company: "Тропа Софт",
    position: "Frontend Developer",
    status: "withdrawn",
    appliedAt: "2026-10-05",
    url: null,
    location: null,
    workFormat: "remote",
    salaryMin: 4000,
    salaryMax: 5000,
    currency: "USD",
    contactName: null,
    contactInfo: null,
    source: "Сайт компании",
    createdOn: "2026-10-05",
    history: [
      { to: "sent", on: "2026-10-05" },
      { to: "withdrawn", on: "2026-10-19", reason: "Не устроил формат работы" },
    ],
  },
];

const STAGES: Stage[] = [
  {
    id: "s1",
    applicationId: "a1",
    type: "interview",
    interviewKind: "technical",
    title: null,
    seq: 1,
    scheduledAt: at("2026-10-24", "12:00"),
    state: "done",
    createdAt: at("2026-10-22"),
    updatedAt: at("2026-10-24", "14:00"),
  },
  {
    id: "s2",
    applicationId: "a1",
    type: "interview",
    interviewKind: "technical",
    title: null,
    seq: 2,
    scheduledAt: at("2026-10-30", "15:00"),
    state: "planned",
    createdAt: at("2026-10-24", "15:00"),
    updatedAt: at("2026-10-24", "15:00"),
  },
  {
    id: "s3",
    applicationId: "a3",
    type: "test_task",
    interviewKind: null,
    title: "Todo-приложение на Next.js",
    seq: 1,
    scheduledAt: at("2026-10-23", "18:00"),
    state: "planned",
    createdAt: at("2026-10-20"),
    updatedAt: at("2026-10-20"),
  },
];

const NOTES: Note[] = [
  {
    id: "n1",
    applicationId: "a1",
    stageId: "s1",
    body: "Спрашивали про рендеринг в React и кэш Next. Попросили второе техническое.",
    createdAt: at("2026-10-24", "14:00"),
    updatedAt: at("2026-10-24", "14:00"),
  },
  {
    id: "n2",
    applicationId: "a1",
    stageId: null,
    body: "Рекрутер ответила в Telegram, вилка 250–300k.",
    createdAt: at("2026-10-14"),
    updatedAt: at("2026-10-14"),
  },
  {
    id: "n3",
    applicationId: "a3",
    stageId: "s3",
    body: "Тестовое: todo-приложение на Next, срок 3 дня.",
    createdAt: at("2026-10-20"),
    updatedAt: at("2026-10-20"),
  },
  {
    id: "n4",
    applicationId: "a4",
    stageId: null,
    body: "Оффер до 30 октября, ДМС и обучение.",
    createdAt: at("2026-10-25"),
    updatedAt: at("2026-10-25"),
  },
  {
    id: "n5",
    applicationId: "a6",
    stageId: null,
    body: "Отказался: не устроил формат работы.",
    createdAt: at("2026-10-19"),
    updatedAt: at("2026-10-19"),
  },
];

function buildSeed(): MemorySeed {
  const applications: Application[] = [];
  const statusChanges: StatusChange[] = [];
  for (const { createdOn, history, ...app } of APPLICATIONS) {
    const last = history[history.length - 1];
    applications.push({
      ...app,
      statusChangedAt: at(last.on),
      createdAt: at(createdOn),
      updatedAt: at(last.on),
    });
    history.forEach((step, index) => {
      statusChanges.push({
        id: `${app.id}-h${index}`,
        applicationId: app.id,
        fromStatus: index === 0 ? null : history[index - 1].to,
        toStatus: step.to,
        reason: step.reason ?? null,
        changedAt: at(step.on),
      });
    });
  }
  return { applications, stages: STAGES, notes: NOTES, statusChanges };
}

export const MOCK_SEED: MemorySeed = buildSeed();
