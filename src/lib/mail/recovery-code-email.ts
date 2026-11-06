import "server-only";
import { sendMail } from "./index";

/** The recovery code email, sent after sign-up, a reset and a new code from Settings. */
export function sendRecoveryCodeEmail(to: string, code: string): Promise<boolean> {
  const resetUrl = `${process.env.BETTER_AUTH_URL ?? "http://localhost:3000"}/reset-password`;
  return sendMail({
    to,
    subject: "Your Offerhive recovery code",
    text: [
      "Your Offerhive recovery code:",
      "",
      code,
      "",
      `If you forget your password, reset it here with this code: ${resetUrl}`,
    ].join("\n"),
  });
}
