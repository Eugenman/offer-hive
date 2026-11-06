import { boolean, date, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { APPLICATION_STATUSES, INTERVIEW_KINDS, STAGE_STATES, STAGE_TYPES, WORK_FORMATS } from "../domain";

// Statuses and other fixed values are plain text checked by Zod and the domain rules, not
// Postgres enums: adding a value then needs no database migration.

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
};

// ─── Accounts (the shape Better Auth expects) ────────────────────────────────────────────────────
// We keep the minimum: the email, the password hash and the recovery code hash. `name` and `image`
// exist because Better Auth requires the columns; sign-up stores an empty name and no image
// (src/lib/auth). Sessions don't record the IP address or the browser.

const authTimestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull().default(""),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  /** SHA-256 of the current recovery code (src/lib/auth/recovery-code.ts); one code per user. */
  recoveryCodeHash: text("recovery_code_hash"),
  role: text("role", { enum: ["user"] })
    .notNull()
    .default("user"),
  ...authTimestamps,
});

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ...authTimestamps,
  },
  (table) => [index("sessions_user_idx").on(table.userId)],
);

export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    /** The user's id at the provider (Google's `sub`). */
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true, mode: "date" }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true, mode: "date" }),
    scope: text("scope"),
    password: text("password"),
    ...authTimestamps,
  },
  (table) => [index("accounts_user_idx").on(table.userId)],
);

export const verifications = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
  ...authTimestamps,
});

// ─── Job search ──────────────────────────────────────────────────────────────────────────────────
// Every table carries `user_id`, so each query filters by the signed-in user without a join.
// Deleting a user deletes all their data.

const owner = () =>
  text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" });

export const applications = pgTable(
  "applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: owner(),
    company: text("company").notNull(),
    position: text("position").notNull(),
    status: text("status", { enum: APPLICATION_STATUSES }).notNull().default("sent"),
    statusChangedAt: timestamp("status_changed_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    appliedAt: date("applied_at", { mode: "string" }),
    url: text("url"),
    location: text("location"),
    workFormat: text("work_format", { enum: WORK_FORMATS }),
    salaryMin: integer("salary_min"),
    salaryMax: integer("salary_max"),
    currency: text("currency"),
    contactName: text("contact_name"),
    contactInfo: text("contact_info"),
    source: text("source"),
    ...timestamps,
    /** Set when moved to the archive; the application is erased 30 days later. */
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [index("applications_user_deleted_idx").on(table.userId, table.deletedAt)],
);

export const applicationStages = pgTable(
  "application_stages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    userId: owner(),
    type: text("type", { enum: STAGE_TYPES }).notNull(),
    interviewKind: text("interview_kind", { enum: INTERVIEW_KINDS }),
    title: text("title"),
    /** Order of stages of one application, shown as "Interview #1, #2". */
    seq: integer("seq").notNull(),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true, mode: "date" }),
    state: text("state", { enum: STAGE_STATES }).notNull().default("planned"),
    ...timestamps,
  },
  (table) => [index("application_stages_application_idx").on(table.applicationId)],
);

export const notes = pgTable(
  "notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    userId: owner(),
    stageId: uuid("stage_id").references(() => applicationStages.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    ...timestamps,
  },
  (table) => [index("notes_application_idx").on(table.applicationId)],
);

/** The status history. Rows are only added, or removed when a change is reverted. */
export const statusChanges = pgTable(
  "status_changes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    userId: owner(),
    fromStatus: text("from_status", { enum: APPLICATION_STATUSES }),
    toStatus: text("to_status", { enum: APPLICATION_STATUSES }).notNull(),
    reason: text("reason"),
    changedAt: timestamp("changed_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    /**
     * Keeps the order of changes made in the same moment (e.g. one bulk change). Assigned by the
     * browser, which records changes first and sends them later.
     */
    seq: integer("seq").notNull(),
  },
  (table) => [index("status_changes_application_idx").on(table.applicationId, table.seq)],
);

/**
 * Statistics of applications deleted for good. Statistics cover the whole job search, so the
 * company, the source and the statuses reached stay after the application itself is erased.
 */
export const deletedStatistics = pgTable(
  "deleted_statistics",
  {
    id: uuid("id").primaryKey(),
    userId: owner(),
    company: text("company").notNull(),
    position: text("position").notNull(),
    source: text("source"),
    appliedAt: date("applied_at", { mode: "string" }),
    status: text("status", { enum: APPLICATION_STATUSES }).notNull(),
    reached: text("reached", { enum: APPLICATION_STATUSES }).array().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [index("deleted_statistics_user_idx").on(table.userId)],
);
