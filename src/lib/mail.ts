import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { env } from "@/env";

export type MailMessage = { to: string; subject: string; text: string; html?: string };
export type MailResult = { delivered: boolean };

let transporter: Transporter | null | undefined;

function getTransporter(): Transporter | null {
  if (transporter === undefined) {
    transporter = env.SMTP_URL ? nodemailer.createTransport(env.SMTP_URL) : null;
  }
  return transporter;
}

/** True when real email delivery is configured. UIs show copyable links when it isn't. */
export function isMailConfigured(): boolean {
  return Boolean(env.SMTP_URL);
}

/**
 * Sends an email. Without SMTP_URL the message is logged to the server console instead.
 * Never throws: a failed delivery is reported as { delivered: false } and logged.
 */
export async function sendMail(message: MailMessage): Promise<MailResult> {
  const transport = getTransporter();
  if (!transport) {
    console.info(`[mail] (SMTP not configured) To: ${message.to}\nSubject: ${message.subject}\n\n${message.text}\n`);
    return { delivered: false };
  }
  try {
    await transport.sendMail({ from: env.MAIL_FROM, ...message });
    return { delivered: true };
  } catch (error) {
    console.error("[mail] delivery failed", error);
    return { delivered: false };
  }
}
