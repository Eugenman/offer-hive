import { z } from "zod";
import { APPLICATION_STATUSES, INTERVIEW_KINDS, STAGE_STATES, STAGE_TYPES, WORK_FORMATS } from "@/lib/domain";
import type { ChangeSet } from "@/lib/repository/repository";

// What the browser sends to the server: one ChangeSet of the repository, i.e. the records one
// operation wrote and the ids it deleted, per table. The server trusts none of it: every field is
// checked here, and ownership is checked when it is applied.
//
// Length limits are generous on purpose: forms already enforce the real ones (lib/schemas), and
// older data, e.g. from a restored backup, must not get stuck in the queue over a few characters.
// These limits only keep junk out.

/** Upper bound for one batch, per table. An import of a big spreadsheet is the largest batch. */
export const MAX_ROWS_PER_TABLE = 5_000;

const id = z.uuid();
const isoDateTime = z.iso.datetime({ offset: true });
const isoDate = z.iso.date();
const text = (max: number) => z.string().max(max);
const nullableText = (max: number) => z.string().max(max).nullable();
const status = z.enum(APPLICATION_STATUSES);

const application = z.strictObject({
  id,
  company: text(1_000),
  position: text(1_000),
  status,
  statusChangedAt: isoDateTime,
  appliedAt: isoDate.nullable(),
  url: nullableText(4_000),
  location: nullableText(1_000),
  workFormat: z.enum(WORK_FORMATS).nullable(),
  salaryMin: z.number().int().nonnegative().nullable(),
  salaryMax: z.number().int().nonnegative().nullable(),
  currency: nullableText(16),
  contactName: nullableText(1_000),
  contactInfo: nullableText(1_000),
  source: nullableText(1_000),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
  deletedAt: isoDateTime.nullable(),
});

const stage = z.strictObject({
  id,
  applicationId: id,
  type: z.enum(STAGE_TYPES),
  interviewKind: z.enum(INTERVIEW_KINDS).nullable(),
  title: nullableText(1_000),
  seq: z.number().int().positive(),
  scheduledAt: isoDateTime.nullable(),
  state: z.enum(STAGE_STATES),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

const note = z.strictObject({
  id,
  applicationId: id,
  stageId: id.nullable(),
  body: text(20_000),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

const statusChange = z.strictObject({
  id,
  applicationId: id,
  fromStatus: status.nullable(),
  toStatus: status,
  reason: nullableText(2_000),
  changedAt: isoDateTime,
  seq: z.number().int().positive(),
});

const statisticsEntry = z.strictObject({
  id,
  company: text(1_000),
  position: text(1_000),
  source: nullableText(1_000),
  appliedAt: isoDate.nullable(),
  status,
  reached: z.array(status).max(APPLICATION_STATUSES.length),
  state: z.literal("deleted"),
  deletedAt: isoDateTime,
});

const tableChanges = <T extends z.ZodType>(row: T) =>
  z.strictObject({
    put: z.array(row).max(MAX_ROWS_PER_TABLE),
    delete: z.array(id).max(MAX_ROWS_PER_TABLE),
  });

export const changeSetSchema = z.strictObject({
  applications: tableChanges(application),
  stages: tableChanges(stage),
  notes: tableChanges(note),
  statusChanges: tableChanges(statusChange),
  deletedStatistics: tableChanges(statisticsEntry),
}) satisfies z.ZodType<ChangeSet>;

export type ValidChangeSet = z.infer<typeof changeSetSchema>;
