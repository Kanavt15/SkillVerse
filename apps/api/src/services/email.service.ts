/**
 * Sending email.
 *
 * Two transports, chosen automatically:
 *   - Resend (https://resend.com, free tier 3,000 emails/month) when the
 *     RESEND_API_KEY secret is set: staging and production.
 *   - Dev mailbox otherwise: the email is printed to the terminal and kept in
 *     memory, where the website's /dev/mailbox page shows it. Local development
 *     needs no email account at all.
 *
 * Emails are sent in the background (`waitUntil`) so a slow provider never slows
 * down the request. A failed send is logged, not thrown: the user can always
 * ask for the email again.
 */
import type { Logger } from '../lib/logger';

export interface EmailMessage {
  to: string;
  subject: string;
  /** Plain-text body (always required: accessible, and what spam filters like). */
  text: string;
  /** Optional HTML body. Only ever built from our templates, never from user HTML. */
  html?: string;
}

export interface DevMailboxEntry extends EmailMessage {
  id: string;
  sentAt: string;
}

const MAX_DEV_MAILBOX = 50;

/** In-memory dev mailbox (development only). Newest first. */
export const devMailbox: DevMailboxEntry[] = [];

export interface EmailEnv {
  ENVIRONMENT: string;
  EMAIL_FROM: string;
  RESEND_API_KEY?: string;
}

async function sendViaResend(env: EmailEnv, msg: EmailMessage): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [msg.to],
      subject: msg.subject,
      text: msg.text,
      html: msg.html,
    }),
  });
  if (!res.ok) {
    throw new Error(`Resend responded ${res.status}`);
  }
}

/**
 * Sends an email. Returns a promise the caller should pass to `executionCtx.waitUntil`.
 * Never throws.
 */
export async function sendEmail(env: EmailEnv, log: Logger, msg: EmailMessage): Promise<void> {
  try {
    if (env.RESEND_API_KEY) {
      await sendViaResend(env, msg);
      log.info('email.sent', { transport: 'resend', subject: msg.subject });
      return;
    }
    if (env.ENVIRONMENT === 'production') {
      // Never silently drop real users' email in production.
      log.error('email.not_configured', { subject: msg.subject });
      return;
    }
    devMailbox.unshift({ ...msg, id: crypto.randomUUID(), sentAt: new Date().toISOString() });
    devMailbox.length = Math.min(devMailbox.length, MAX_DEV_MAILBOX);
    // Printed so developers can click the link straight from the terminal.
    console.info(`\n📧  [dev mailbox] To: ${msg.to}\n    Subject: ${msg.subject}\n\n${msg.text}\n`);
  } catch (err) {
    log.error('email.failed', { subject: msg.subject, message: (err as Error).message });
  }
}
