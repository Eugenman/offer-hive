import type { Application, Note, Stage, StatusChange } from "@/lib/domain";
import type { RepositorySeed } from "@/lib/repository/repository";

// Fictional sample data for tests: companies, people and contacts are made up.

const at = (date: string, time = "10:00") => `${date}T${time}:00.000Z`;

type SeedApplication = Omit<Application, "statusChangedAt" | "createdAt" | "updatedAt"> & {
  createdOn: string;
  history: { to: Application["status"]; on: string; reason?: string }[];
};

const APPLICATIONS: SeedApplication[] = [
  {
    id: "a1",
    company: "Northgate Systems",
    position: "Frontend Developer",
    status: "interview",
    appliedAt: "2026-10-12",
    url: "https://example.com/jobs/frontend",
    location: "Berlin",
    workFormat: "hybrid",
    salaryMin: 120000,
    salaryMax: 140000,
    currency: "USD",
    contactName: "Maria",
    contactInfo: "maria@example.com",
    source: "LinkedIn",
    createdOn: "2026-10-12",
    history: [
      { to: "sent", on: "2026-10-12" },
      { to: "screening", on: "2026-10-16" },
      { to: "interview", on: "2026-10-22" },
    ],
  },
  {
    id: "a2",
    company: "Daisy Tech",
    position: "React Developer",
    status: "sent",
    appliedAt: "2026-10-15",
    url: null,
    location: "London",
    workFormat: "office",
    salaryMin: 110000,
    salaryMax: 130000,
    currency: "USD",
    contactName: null,
    contactInfo: null,
    source: "Indeed",
    createdOn: "2026-10-15",
    history: [{ to: "sent", on: "2026-10-15" }],
  },
  {
    id: "a3",
    company: "Cloudberry Apps",
    position: "TypeScript Engineer",
    status: "test_task",
    appliedAt: "2026-10-18",
    url: null,
    location: null,
    workFormat: "remote",
    salaryMin: null,
    salaryMax: null,
    currency: null,
    contactName: "Igor",
    contactInfo: "igor@example.com",
    source: "Referral",
    createdOn: "2026-10-18",
    history: [
      { to: "sent", on: "2026-10-18" },
      { to: "screening", on: "2026-10-19" },
      { to: "test_task", on: "2026-10-20" },
    ],
  },
  {
    id: "a4",
    company: "Bluefinch",
    position: "Senior Frontend",
    status: "offer",
    appliedAt: "2026-10-01",
    url: null,
    location: "Amsterdam",
    workFormat: "hybrid",
    salaryMin: 150000,
    salaryMax: null,
    currency: "USD",
    contactName: null,
    contactInfo: null,
    source: "LinkedIn",
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
    company: "Pixel & Co",
    position: "UI Engineer",
    status: "rejected",
    appliedAt: "2026-10-03",
    url: null,
    location: "Berlin",
    workFormat: "office",
    salaryMin: 95000,
    salaryMax: null,
    currency: "USD",
    contactName: null,
    contactInfo: null,
    source: "Indeed",
    createdOn: "2026-10-03",
    history: [
      { to: "sent", on: "2026-10-03" },
      { to: "rejected", on: "2026-10-11", reason: "They wanted Vue experience" },
    ],
  },
  {
    id: "a6",
    company: "Pathway Soft",
    position: "Frontend Developer",
    status: "withdrawn",
    appliedAt: "2026-10-05",
    url: null,
    location: null,
    workFormat: "remote",
    salaryMin: 70000,
    salaryMax: 80000,
    currency: "EUR",
    contactName: null,
    contactInfo: null,
    source: "Company website",
    createdOn: "2026-10-05",
    history: [
      { to: "sent", on: "2026-10-05" },
      { to: "withdrawn", on: "2026-10-19", reason: "The work format did not fit" },
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
    title: "Todo app in Next.js",
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
    body: "Asked about rendering in React and caching in Next. They want a second technical round.",
    createdAt: at("2026-10-24", "14:00"),
    updatedAt: at("2026-10-24", "14:00"),
  },
  {
    id: "n2",
    applicationId: "a1",
    stageId: null,
    body: "The recruiter replied on LinkedIn: range 120–140k.",
    createdAt: at("2026-10-14"),
    updatedAt: at("2026-10-14"),
  },
  {
    id: "n3",
    applicationId: "a3",
    stageId: "s3",
    body: "Take-home: a todo app in Next.js, 3 days.",
    createdAt: at("2026-10-20"),
    updatedAt: at("2026-10-20"),
  },
  {
    id: "n4",
    applicationId: "a4",
    stageId: null,
    body: "Offer valid until Oct 30, health insurance and a learning budget.",
    createdAt: at("2026-10-25"),
    updatedAt: at("2026-10-25"),
  },
  {
    id: "n5",
    applicationId: "a6",
    stageId: null,
    body: "Withdrew: the work format did not fit.",
    createdAt: at("2026-10-19"),
    updatedAt: at("2026-10-19"),
  },
];

function buildSeed(): RepositorySeed {
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

export const SAMPLE_DATA: RepositorySeed = buildSeed();
