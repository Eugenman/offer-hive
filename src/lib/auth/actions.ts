"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/dal";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getAuth, MIN_PASSWORD_LENGTH } from "./index";
import { normalizeEmail, resetPasswordWithCode, rotateRecoveryCode } from "./recovery";

// Account actions that also issue a recovery code. Expected failures come back as values; the
// session cookie is set through Better Auth's nextCookies plugin.

export type CodeResult = { ok: true; code: string; emailed: boolean };

export async function createAccount(input: {
  email: string;
  password: string;
}): Promise<CodeResult | { ok: false; reason: "short_password" | "failed" }> {
  if (input.password.length < MIN_PASSWORD_LENGTH) return { ok: false, reason: "short_password" };
  try {
    const { user } = await getAuth().api.signUpEmail({
      body: { email: normalizeEmail(input.email), password: input.password, name: "" },
      headers: await headers(),
    });
    return { ok: true, ...(await rotateRecoveryCode(user.id, user.email)) };
  } catch {
    // Taken email, invalid address and anything else: one message that doesn't tell whether an
    // account exists.
    return { ok: false, reason: "failed" };
  }
}

export async function resetPassword(input: {
  email: string;
  code: string;
  password: string;
}): Promise<CodeResult | { ok: false; reason: "short_password" | "wrong" }> {
  const result = await resetPasswordWithCode(input);
  if (!result.ok) return result;
  await getAuth().api.signInEmail({
    body: { email: result.email, password: input.password },
    headers: await headers(),
  });
  return { ok: true, code: result.code, emailed: result.emailed };
}

export async function createNewRecoveryCode(input: {
  password: string;
}): Promise<CodeResult | { ok: false; reason: "signed_out" | "wrong_password" }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: "signed_out" };
  try {
    await getAuth().api.verifyPassword({ body: { password: input.password }, headers: await headers() });
  } catch {
    return { ok: false, reason: "wrong_password" };
  }
  return { ok: true, ...(await rotateRecoveryCode(user.id, user.email)) };
}

/**
 * Deletes the account and everything in it for good. Every table refers to the user with
 * "on delete cascade", so removing the user row removes applications, notes, statistics,
 * sessions and the password. Signing out first clears the session cookie in this browser.
 */
export async function deleteAccount(input: {
  password: string;
}): Promise<{ ok: true } | { ok: false; reason: "signed_out" | "wrong_password" | "failed" }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: "signed_out" };
  const requestHeaders = await headers();
  try {
    await getAuth().api.verifyPassword({ body: { password: input.password }, headers: requestHeaders });
  } catch {
    return { ok: false, reason: "wrong_password" };
  }
  try {
    await getAuth().api.signOut({ headers: requestHeaders });
    await getDb().delete(users).where(eq(users.id, user.id));
    return { ok: true };
  } catch (error) {
    console.error("Couldn't delete the account", error);
    return { ok: false, reason: "failed" };
  }
}
