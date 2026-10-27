import { z } from "zod";
import {
  APPLICATION_STATUSES,
  INTERVIEW_KINDS,
  STAGE_STATES,
  STAGE_TYPES,
  STATUSES_WITH_REASON,
  WORK_FORMATS,
} from "./domain";

// One set of schemas validates forms, imports and storage writes.
// Error messages are Russian for now; they move to next-intl in stage 4.

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Не длиннее ${max} символов`)
    .transform((value) => (value === "" ? null : value))
    .nullable();

const requiredText = (max: number) =>
  z.string().trim().min(1, "Обязательное поле").max(max, `Не длиннее ${max} символов`);

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Неверная дата")
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), "Неверная дата");

const salary = z.number().int("Только целое число").nonnegative("Не меньше нуля").nullable();

const urlField = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .refine(
    (value) => value === null || /^https?:\/\/\S+\.\S+/.test(value),
    "Ссылка должна начинаться с http:// или https://",
  );

const applicationFields = z.object({
  company: requiredText(200),
  position: requiredText(200),
  status: z.enum(APPLICATION_STATUSES),
  appliedAt: isoDate.nullable(),
  url: urlField,
  location: optionalText(120),
  workFormat: z.enum(WORK_FORMATS).nullable(),
  salaryMin: salary,
  salaryMax: salary,
  currency: optionalText(5),
  contactName: optionalText(120),
  contactInfo: optionalText(200),
  source: optionalText(80),
});

const salaryOrder = (value: { salaryMin?: number | null; salaryMax?: number | null }) =>
  value.salaryMin == null || value.salaryMax == null || value.salaryMin <= value.salaryMax;

const salaryOrderIssue = { message: "«От» больше, чем «до»", path: ["salaryMin"] };

export const applicationInputSchema = applicationFields
  .partial()
  .required({ company: true, position: true })
  .refine(salaryOrder, salaryOrderIssue);
export type ApplicationInput = z.input<typeof applicationInputSchema>;

// Status is changed only through changeStatus, so it is not part of a field update.
export const applicationPatchSchema = applicationFields
  .omit({ status: true })
  .partial()
  .refine(salaryOrder, salaryOrderIssue);
export type ApplicationPatch = z.input<typeof applicationPatchSchema>;

export const statusChangeInputSchema = z
  .object({
    status: z.enum(APPLICATION_STATUSES),
    reason: optionalText(500).optional(),
  })
  .transform(({ status, reason }) => ({
    status,
    reason: STATUSES_WITH_REASON.includes(status) ? (reason ?? null) : null,
  }));
export type StatusChangeInput = z.input<typeof statusChangeInputSchema>;

const stageFields = z.object({
  type: z.enum(STAGE_TYPES),
  interviewKind: z.enum(INTERVIEW_KINDS).nullable(),
  title: optionalText(120),
  scheduledAt: z.iso.datetime({ offset: true }).nullable(),
  state: z.enum(STAGE_STATES),
});

const interviewKindOnlyForInterviews = (value: { type?: string; interviewKind?: string | null }) =>
  value.type === undefined || value.type === "interview" || value.interviewKind == null;

export const stageInputSchema = stageFields
  .partial()
  .required({ type: true })
  .refine(interviewKindOnlyForInterviews, {
    message: "Вид указывается только для интервью",
    path: ["interviewKind"],
  });
export type StageInput = z.input<typeof stageInputSchema>;

export const stagePatchSchema = stageFields.omit({ type: true }).partial();
export type StagePatch = z.input<typeof stagePatchSchema>;

export const noteInputSchema = z.object({
  body: requiredText(5000),
  stageId: z.string().nullable().optional(),
});
export type NoteInput = z.input<typeof noteInputSchema>;

export const notePatchSchema = z.object({ body: requiredText(5000) });
export type NotePatch = z.input<typeof notePatchSchema>;
