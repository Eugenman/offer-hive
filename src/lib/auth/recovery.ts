import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { sendRecoveryCodeEmail } from "@/lib/mail/recovery-code-email";
import { getAuth, MIN_PASSWORD_LENGTH } from "./index";
import { generateRecoveryCode, hashRecoveryCode, recoveryCodeMatches } from "./recovery-code";

// Recovery codes on the server: issuing a new one and resetting a password with one. These don't
// read the request, so the Server Actions add the session cookie around them.

export type IssuedCode = { code: string; emailed: boolean };

/** Emails are compared as typed by people: trimmed, any case. */
export const normalizeEmail = (email: string) => email.trim().toLowerCase();

/** Replaces the user's recovery code with a new one, stores its hash and emails it. */
export async function rotateRecoveryCode(userId: string, email: string): Promise<IssuedCode> {
  const code = generateRecoveryCode();
  await getDb()
    .update(users)
    .set({ recoveryCodeHash: hashRecoveryCode(code) })
    .where(eq(users.id, userId));
  return { code, emailed: await sendRecoveryCodeEmail(email, code) };
}

export type ResetResult =
  | ({ ok: true; userId: string; email: string } & IssuedCode)
  | { ok: false; reason: "short_password" | "wrong" };

/**
 * Sets a new password when the email and the recovery code match. Ends every session of the
 * account and issues a new code, so the used one stops working. An unknown email and a wrong code
 * get the same answer.
 */
export async function resetPasswordWithCode(input: {
  email: string;
  code: string;
  password: string;
}): Promise<ResetResult> {
  if (input.password.length < MIN_PASSWORD_LENGTH) return { ok: false, reason: "short_password" };
  const email = normalizeEmail(input.email);
  const [user] = await getDb()
    .select({ id: users.id, recoveryCodeHash: users.recoveryCodeHash })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (!user || !recoveryCodeMatches(input.code, user.recoveryCodeHash)) return { ok: false, reason: "wrong" };

  const context = await getAuth().$context;
  await context.internalAdapter.updatePassword(user.id, await context.password.hash(input.password));
  await context.internalAdapter.deleteUserSessions(user.id);
  return { ok: true, userId: user.id, email, ...(await rotateRecoveryCode(user.id, email)) };
}
