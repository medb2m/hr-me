import nodemailer from 'nodemailer';
import { renderTemplate, templateDefaults } from './render-template.js';

let transporter;

/** True when SMTP env is set (actual send may still fail on auth / network). */
export function isSmtpConfigured() {
  return Boolean(process.env.SMTP_HOST?.trim());
}

function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE === '1' || process.env.SMTP_SECURE === 'true';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host) {
    console.warn(
      '[email] SMTP_HOST is not set — emails will not send. Configure SMTP in .env (see .env.example).'
    );
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
    connectionTimeout: 25_000,
    greetingTimeout: 15_000,
    socketTimeout: 25_000,
  });

  return transporter;
}

/**
 * Low-level send. Returns { messageId } or throws.
 * If SMTP is not configured, logs and resolves with { skipped: true }.
 */
export async function sendMail({ to, subject, html, text, replyTo, attachments }) {
  const tx = getTransporter();
  if (!tx) {
    console.info('[email] (dry run) Would send to', to, '—', subject);
    return { skipped: true };
  }

  const from = process.env.MAIL_FROM || `"${process.env.APP_NAME || 'HR-Me'}" <noreply@localhost>`;

  return tx.sendMail({
    from,
    to,
    subject,
    html,
    text: text || undefined,
    replyTo: replyTo || process.env.SUPPORT_EMAIL,
    attachments: Array.isArray(attachments) ? attachments : undefined,
  });
}

function htmlToPlainSummary(html, linkLabel, url) {
  return `${linkLabel}\n${url}\n\nIf you did not request this, you can ignore this email.`;
}

// --- Transactional helpers (call from auth routes after you add users + tokens) ---
// Required template vars are filled from env via templateDefaults(); you pass URLs and names.

/** @param {{ to: string, userName: string, verifyUrl: string }} p */
export async function sendVerifyEmail({ to, userName, verifyUrl }) {
  const v = templateDefaults({ userName, verifyUrl });
  const html = renderTemplate('verify-email.html', v);
  const text = htmlToPlainSummary(html, 'Verify your email:', verifyUrl);
  return sendMail({
    to,
    subject: `Confirm your email — ${v.appName}`,
    html,
    text,
  });
}

/** @param {{ to: string, userName: string, resetUrl: string, expiryMinutes?: string|number }} p */
export async function sendPasswordResetEmail({ to, userName, resetUrl, expiryMinutes = '60' }) {
  const v = templateDefaults({ userName, resetUrl, expiryMinutes: String(expiryMinutes) });
  const html = renderTemplate('reset-password.html', v);
  const text = htmlToPlainSummary(html, 'Reset your password:', resetUrl);
  return sendMail({
    to,
    subject: `Reset your password — ${v.appName}`,
    html,
    text,
  });
}

/** @param {{ to: string, userName: string, loginUrl: string }} p */
export async function sendWelcomeEmail({ to, userName, loginUrl }) {
  const v = templateDefaults({ userName, loginUrl });
  const html = renderTemplate('welcome.html', v);
  const text = `Welcome to ${v.appName}, ${userName}.\nSign in: ${loginUrl}`;
  return sendMail({
    to,
    subject: `Welcome to ${v.appName}`,
    html,
    text,
  });
}

/** @param {{ to: string, userName: string }} p */
export async function sendPasswordChangedEmail({ to, userName }) {
  const v = templateDefaults({ userName });
  const html = renderTemplate('password-changed.html', v);
  const text = `Hi ${userName}, your ${v.appName} password was changed. If this wasn’t you, contact ${v.supportEmail}.`;
  return sendMail({
    to,
    subject: `Your password was updated — ${v.appName}`,
    html,
    text,
  });
}

/** @param {{ to: string, userName: string, confirmUrl: string }} p — send to the *new* address */
export async function sendEmailChangeVerify({ to, userName, confirmUrl }) {
  const v = templateDefaults({ userName, confirmUrl });
  const html = renderTemplate('email-change-verify.html', v);
  const text = htmlToPlainSummary(html, 'Confirm your new email:', confirmUrl);
  return sendMail({
    to,
    subject: `Confirm new email address — ${v.appName}`,
    html,
    text,
  });
}

/** Passwordless one-time sign-in link @param {{ to: string, userName: string, magicUrl: string, expiryMinutes?: string|number }} p */
export async function sendMagicLinkEmail({ to, userName, magicUrl, expiryMinutes = '15' }) {
  const v = templateDefaults({ userName, magicUrl, expiryMinutes: String(expiryMinutes) });
  const html = renderTemplate('magic-link.html', v);
  const text = htmlToPlainSummary(html, 'Sign in:', magicUrl);
  return sendMail({
    to,
    subject: `Your sign-in link — ${v.appName}`,
    html,
    text,
  });
}
