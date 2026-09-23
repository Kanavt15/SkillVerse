/**
 * Transactional email templates. Each returns subject, plain text and HTML.
 *
 * Rules: HTML is built only from these fixed templates. Any value inserted
 * (a name, a link) passes through `esc()`, so a display name like
 * "<script>" can never become markup in someone's inbox.
 */
import { APP_NAME } from '@skillverse/shared';
import type { EmailMessage } from '../services/email.service';

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function layout(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f6f6fb;font-family:Arial,sans-serif;color:#14131f">
<table role="presentation" width="100%" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px">
<tr><td><p style="font-size:18px;font-weight:bold;color:#6a46dc;margin:0 0 24px">${APP_NAME}</p>
<h1 style="font-size:20px;margin:0 0 16px">${esc(title)}</h1>${bodyHtml}
<p style="font-size:12px;color:#75748a;margin-top:32px">You received this email because of activity on your ${APP_NAME} account.</p>
</td></tr></table></body></html>`;
}

function button(url: string, label: string): string {
  return `<p style="margin:24px 0"><a href="${esc(url)}" style="background:#6a46dc;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">${esc(label)}</a></p>
<p style="font-size:12px;color:#55546a">Or paste this link into your browser:<br>${esc(url)}</p>`;
}

export function verifyEmailTemplate(to: string, name: string, url: string): EmailMessage {
  const title = 'Confirm your email address';
  return {
    to,
    subject: `${title} · ${APP_NAME}`,
    text: `Hi ${name},\n\nConfirm your email to finish creating your ${APP_NAME} account:\n${url}\n\nThis link expires in 24 hours. If you didn't sign up, ignore this email.`,
    html: layout(
      title,
      `<p>Hi ${esc(name)},</p><p>Confirm your email to finish creating your ${APP_NAME} account.</p>${button(url, 'Confirm email')}<p style="font-size:13px;color:#55546a">This link expires in 24 hours. If you didn't sign up, you can ignore this email.</p>`,
    ),
  };
}

export function accountExistsTemplate(
  to: string,
  name: string,
  loginUrl: string,
  resetUrl: string,
): EmailMessage {
  const title = 'You already have an account';
  return {
    to,
    subject: `${title} · ${APP_NAME}`,
    text: `Hi ${name},\n\nSomeone (hopefully you) tried to sign up with this email, but you already have a ${APP_NAME} account.\n\nSign in: ${loginUrl}\nForgot your password? ${resetUrl}\n\nIf this wasn't you, no action is needed.`,
    html: layout(
      title,
      `<p>Hi ${esc(name)},</p><p>Someone (hopefully you) tried to sign up with this email, but you already have an account.</p>${button(loginUrl, 'Sign in')}<p>Forgot your password? <a href="${esc(resetUrl)}">Reset it</a>.</p><p style="font-size:13px;color:#55546a">If this wasn't you, no action is needed.</p>`,
    ),
  };
}

export function resetPasswordTemplate(to: string, name: string, url: string): EmailMessage {
  const title = 'Reset your password';
  return {
    to,
    subject: `${title} · ${APP_NAME}`,
    text: `Hi ${name},\n\nUse this link to choose a new password:\n${url}\n\nIt expires in 30 minutes and works once. If you didn't ask for this, ignore this email. Your password stays the same.`,
    html: layout(
      title,
      `<p>Hi ${esc(name)},</p><p>Use the button below to choose a new password.</p>${button(url, 'Choose a new password')}<p style="font-size:13px;color:#55546a">It expires in 30 minutes and works once. If you didn't ask for this, ignore this email. Your password stays the same.</p>`,
    ),
  };
}

export function passwordChangedTemplate(to: string, name: string, resetUrl: string): EmailMessage {
  const title = 'Your password was changed';
  return {
    to,
    subject: `${title} · ${APP_NAME}`,
    text: `Hi ${name},\n\nThe password for your ${APP_NAME} account was just changed and all other devices were signed out.\n\nIf this wasn't you, reset your password immediately: ${resetUrl}`,
    html: layout(
      title,
      `<p>Hi ${esc(name)},</p><p>The password for your account was just changed and all other devices were signed out.</p><p><strong>If this wasn't you</strong>, reset your password immediately:</p>${button(resetUrl, 'Reset password')}`,
    ),
  };
}

export function instructorDecisionTemplate(
  to: string,
  name: string,
  approved: boolean,
  notes: string | null,
  studioUrl: string,
): EmailMessage {
  const title = approved ? 'You can now teach' : 'About your application to teach';
  const text = approved
    ? `Hi ${name},\n\nGood news: your application to teach was approved. Create your first course in the Studio:\n${studioUrl}${notes ? `\n\nNote from our team: ${notes}` : ''}`
    : `Hi ${name},\n\nThank you for applying to teach. We can't approve your application yet.${notes ? `\n\nFeedback: ${notes}` : ''}\n\nYou're welcome to apply again once you've addressed this.`;
  const html = layout(
    title,
    approved
      ? `<p>Hi ${esc(name)},</p><p>Good news: your application to teach was approved.</p>${button(studioUrl, 'Open the Studio')}${notes ? `<p><strong>Note from our team:</strong> ${esc(notes)}</p>` : ''}`
      : `<p>Hi ${esc(name)},</p><p>Thank you for applying to teach. We can't approve your application yet.</p>${notes ? `<p><strong>Feedback:</strong> ${esc(notes)}</p>` : ''}<p>You're welcome to apply again once you've addressed this.</p>`,
  );
  return { to, subject: `${title} · ${APP_NAME}`, text, html };
}

export function courseDecisionTemplate(
  to: string,
  name: string,
  courseTitle: string,
  approved: boolean,
  notes: string | null,
  url: string,
): EmailMessage {
  const title = approved ? `"${courseTitle}" is live` : `Changes needed for "${courseTitle}"`;
  const text = approved
    ? `Hi ${name},\n\nYour course "${courseTitle}" was approved and is now published:\n${url}${notes ? `\n\nNote from the reviewer: ${notes}` : ''}`
    : `Hi ${name},\n\nYour course "${courseTitle}" needs a few changes before it can be published.\n\nReviewer feedback: ${notes ?? ''}\n\nEdit and resubmit it in the Studio:\n${url}`;
  const html = layout(
    title,
    approved
      ? `<p>Hi ${esc(name)},</p><p>Your course <strong>${esc(courseTitle)}</strong> was approved and is now published.</p>${button(url, 'View your course')}${notes ? `<p><strong>Note from the reviewer:</strong> ${esc(notes)}</p>` : ''}`
      : `<p>Hi ${esc(name)},</p><p>Your course <strong>${esc(courseTitle)}</strong> needs a few changes before it can be published.</p><p><strong>Reviewer feedback:</strong> ${esc(notes ?? '')}</p>${button(url, 'Edit in the Studio')}`,
  );
  return { to, subject: `${title} · ${APP_NAME}`, text, html };
}
