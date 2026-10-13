import "server-only";
import nodemailer from "nodemailer";
import { env } from "./env";

export interface Email {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Sends email over SMTP. Locally this is Mailpit (inbox at http://localhost:8025).
 * In development the message is also printed to the terminal, so login still works
 * even if Mailpit is not running. EMAIL_TRANSPORT=console prints only (localhost only).
 */
export async function sendEmail(message: Email): Promise<void> {
  if (env.EMAIL_TRANSPORT === "console" || env.NODE_ENV !== "production") {
    console.info(`\n[email] To: ${message.to}\n[email] Subject: ${message.subject}\n${message.text}\n`);
  }
  if (env.EMAIL_TRANSPORT === "console" || !env.SMTP_HOST) return;

  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD ?? "" } : undefined,
  });
  try {
    await transport.sendMail({ from: env.EMAIL_FROM, ...message });
  } catch (error) {
    if (env.NODE_ENV === "production") throw error;
    console.warn(`[email] Could not reach SMTP at ${env.SMTP_HOST}:${env.SMTP_PORT}. Use the link printed above.`);
  }
}
