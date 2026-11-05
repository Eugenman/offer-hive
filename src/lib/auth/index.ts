import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";

// Sign-in with email and password. We keep the minimum about a person: the email, the password
// hash and the recovery code hash (src/lib/auth/recovery.ts). No name or picture, and sessions
// don't record the IP address or the browser. Email is not verified: there is no mail service yet.

/** Shortest password accepted on sign-up and reset. */
export const MIN_PASSWORD_LENGTH = 10;

function createAuth() {
  return betterAuth({
    // BETTER_AUTH_SECRET and BETTER_AUTH_URL come from the environment.
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      usePlural: true,
      schema: {
        users: schema.users,
        sessions: schema.sessions,
        accounts: schema.accounts,
        verifications: schema.verifications,
      },
    }),
    emailAndPassword: { enabled: true, minPasswordLength: MIN_PASSWORD_LENGTH, autoSignIn: true },
    user: {
      additionalFields: {
        role: { type: "string", required: false, defaultValue: "user", input: false },
      },
    },
    advanced: { ipAddress: { disableIpTracking: true } },
    databaseHooks: {
      // Accounts are stored with the email only, whatever a client sends as a name or picture.
      user: {
        create: { before: async (user) => ({ data: { ...user, name: "", image: null } }) },
        update: {
          before: async (user) => ({
            data: { ...user, ...("name" in user && { name: "" }), ...("image" in user && { image: null }) },
          }),
        },
      },
      session: {
        create: { before: async (session) => ({ data: { ...session, ipAddress: null, userAgent: null } }) },
      },
    },
    // Lets Server Actions set the session cookie.
    plugins: [nextCookies()],
  });
}

type Auth = ReturnType<typeof createAuth>;

// One instance per server process, created on first use (so `next build` needs no secrets).
const globalForAuth = globalThis as unknown as { offerhiveAuth?: Auth };

export function getAuth(): Auth {
  globalForAuth.offerhiveAuth ??= createAuth();
  return globalForAuth.offerhiveAuth;
}
