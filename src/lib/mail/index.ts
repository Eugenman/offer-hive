import "server-only";
import nodemailer from "nodemailer";

// Outgoing mail over SMTP. Locally that's Mailpit from docker-compose (inbox at
// http://localhost:8025); a real mail service later only changes SMTP_HOST / SMTP_PORT / MAIL_FROM.

export type MailMessage = { to: string; subject: string; text: string };

/** Sends one plain-text email. Never throws: returns false (and logs) if it couldn't be sent. */
export async function sendMail(message: MailMessage): Promise<boolean> {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT);
  const from = process.env.MAIL_FROM;
  if (!host || !port || !from) {
    console.error("Mail is not configured: set SMTP_HOST, SMTP_PORT and MAIL_FROM.");
    return false;
  }
  try {
    const transport = nodemailer.createTransport({ host, port, secure: port === 465 });
    await transport.sendMail({ from, ...message });
    return true;
  } catch (error) {
    console.error("Couldn't send email", error);
    return false;
  }
}
