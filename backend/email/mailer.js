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

  const from = process.env.MAIL_FROM || `"${process.env.APP_NAME || 'Al Wassit'}" <noreply@localhost>`;

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

/** @param {{ to: string, userName: string, verifyUrl: string, verifyCode?: string }} p */
export async function sendVerifyEmail({ to, userName, verifyUrl, verifyCode }) {
  const v = templateDefaults({ userName, verifyUrl, verifyCode });
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

/** Confirmation envoyée à un visiteur après le formulaire /contact. */
export async function sendContactConfirmation({ to, userName, subject, messageExcerpt }) {
  const v = templateDefaults({ userName, subject, messageExcerpt });
  const html = renderTemplate('contact-confirmation.html', v);
  const text = `Bonjour ${userName},\n\nNous avons bien reçu votre message (sujet : ${subject}). Notre équipe vous répondra sous 24-48 h.\n\n— ${v.appName}`;
  return sendMail({
    to,
    subject: `Message bien reçu — ${v.appName}`,
    html,
    text,
  });
}

/** Invitation à une réunion / entretien (template meeting-invite, pièce ICS en PJ). */
export async function sendMeetingInviteEmail({
  to,
  participantName,
  meetingTitle,
  meetingKind,
  meetingDate,
  meetingTime,
  meetingDuration,
  meetingTimezone,
  organizerName,
  roleLabel,
  videoLink,
  pinCode,
  ics,
}) {
  const pinBlock = pinCode
    ? `<div style="background:#fffbe6; border:1px solid #fde68a; border-radius:12px; padding:14px 20px; text-align:center; margin:0 0 8px;">
        <span style="font-size:11px; font-weight:800; letter-spacing:.1em; text-transform:uppercase; color:#92400e;">Code d'accès (PIN)</span><br />
        <span style="font-size:24px; font-weight:800; letter-spacing:.3em; color:#0f172a;">${pinCode}</span>
      </div>`
    : '';
  const v = templateDefaults({
    participantName: participantName ? ` ${participantName}` : '',
    meetingTitle,
    meetingKind,
    meetingDate,
    meetingTime,
    meetingDuration,
    meetingTimezone,
    organizerName,
    roleLabel,
    videoLink,
    pinBlock,
  });
  const html = renderTemplate('meeting-invite.html', v);
  const text = `Bonjour${v.participantName},\n\n${meetingKind} : ${meetingTitle}\nOrganisé par : ${organizerName}\nDate : ${meetingDate} à ${meetingTime} (${meetingTimezone}) · Durée : ${meetingDuration}\nVotre rôle : ${roleLabel}\n\nRejoindre : ${videoLink}\n${pinCode ? `Code PIN : ${pinCode}\n` : ''}\n— ${v.appName}`;
  return sendMail({
    to,
    subject: `[${v.appName}] ${meetingKind} : ${meetingTitle}`,
    html,
    text,
    attachments: ics ? [{ filename: 'invite.ics', content: ics }] : undefined,
  });
}

function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Invitation à un entretien IA : lien tokenisé + délai + thèmes + conseils. */
export async function sendInterviewInviteEmail({
  to,
  name,
  title,
  topics,
  deadlineHours,
  scheduledAt,
  passUrl,
  organizerName,
}) {
  const deadline = deadlineHours
    ? `Vous avez ${deadlineHours} h pour le réaliser`
    : 'À réaliser dès que possible';
  const scheduled = scheduledAt
    ? new Intl.DateTimeFormat('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(scheduledAt))
    : 'Dès maintenant';
  const topicsText =
    Array.isArray(topics) && topics.length ? topics.join(' · ') : 'Parcours et expérience';
  const v = templateDefaults({
    participantName: name ? ` ${name}` : '',
    title,
    organizerName: organizerName || "l'équipe Al Wassit",
    deadline,
    scheduled,
    topics: topicsText,
    passUrl,
  });
  const html = renderTemplate('interview-invite.html', v);
  const text = `Bonjour${v.participantName},\n\n${v.organizerName} vous invite à passer l'entretien automatisé « ${title} ».\n${deadline} — prévu : ${scheduled}.\nThèmes : ${topicsText}\n\nCommencer : ${passUrl}\n\n— ${v.appName}`;
  return sendMail({
    to,
    subject: `[${v.appName}] Entretien IA à passer : ${title}`,
    html,
    text,
  });
}

/** Récap envoyé au CRÉATEUR d'une réunion (≠ invitation des participants). */
export async function sendMeetingCreatedEmail({
  to,
  organizerName,
  meetingTitle,
  meetingKind,
  meetingDate,
  meetingTime,
  meetingDuration,
  meetingTimezone,
  pinCode,
  videoLink,
  manageLink,
  invitees,
  ics,
}) {
  const rows = (invitees || [])
    .map(
      (p, i) => `<tr>
          <td style="padding:10px 16px; ${i > 0 ? 'border-top:1px solid #e2e8f0;' : ''}">
            <span style="font-size:13px; font-weight:700; color:#0f172a;">${escHtml(p.name || p.email)}</span><br />
            <span style="font-size:12px; color:#64748b;">${escHtml(p.email)}</span>
          </td>
          <td style="padding:10px 16px; ${i > 0 ? 'border-top:1px solid #e2e8f0;' : ''} text-align:right;">
            <span style="display:inline-block; background:#fef9c3; color:#854d0e; font-size:11px; font-weight:700; padding:3px 10px; border-radius:999px;">${escHtml(p.roleLabel)}</span>
          </td>
        </tr>`
    )
    .join('');
  const inviteesRows =
    rows ||
    `<tr><td style="padding:14px 16px; font-size:13px; color:#94a3b8;">Aucun invité — réunion privée.</td></tr>`;
  const v = templateDefaults({
    participantName: organizerName ? ` ${organizerName}` : '',
    meetingTitle,
    meetingKind,
    meetingDate,
    meetingTime,
    meetingDuration,
    meetingTimezone,
    pinCode,
    videoLink,
    manageLink,
    inviteeCount: String((invitees || []).length),
    inviteesRows,
  });
  const list = (invitees || []).map((p) => `  - ${p.name || p.email} <${p.email}> — ${p.roleLabel}`).join('\n');
  const html = renderTemplate('meeting-created.html', v);
  const text = `Bonjour${v.participantName},\n\nVotre réunion « ${meetingTitle} » est créée.\nDate : ${meetingDate} à ${meetingTime} (${meetingTimezone}) · Durée : ${meetingDuration}\nCode PIN : ${pinCode}\n\nParticipants notifiés :\n${list || '  Aucun'}\n\nGérer : ${manageLink}\nLien salle : ${videoLink}\n\n— ${v.appName}`;
  return sendMail({
    to,
    subject: `[${v.appName}] Réunion créée : ${meetingTitle}`,
    html,
    text,
    attachments: ics ? [{ filename: 'invite.ics', content: ics }] : undefined,
  });
}

/** Annulation de réunion (template meeting-cancelled, ICS METHOD:CANCEL en PJ). */
export async function sendMeetingCancelledEmail({
  to,
  participantName,
  meetingTitle,
  meetingKind,
  meetingDate,
  meetingTime,
  meetingTimezone,
  organizerName,
  ics,
}) {
  const v = templateDefaults({
    participantName: participantName ? ` ${participantName}` : '',
    meetingTitle,
    meetingKind,
    meetingDate,
    meetingTime,
    meetingTimezone,
    organizerName,
  });
  const html = renderTemplate('meeting-cancelled.html', v);
  const text = `Bonjour${v.participantName},\n\n${meetingKind} annulée : ${meetingTitle}\nPrévue le : ${meetingDate} à ${meetingTime} (${meetingTimezone})\nOrganisée par : ${organizerName}\n\nElle a été retirée de votre calendrier. Si elle est reprogrammée, vous recevrez une nouvelle invitation.\n\n— ${v.appName}`;
  return sendMail({
    to,
    subject: `[${v.appName}] Annulée : ${meetingTitle}`,
    html,
    text,
    attachments: ics ? [{ filename: 'invite.ics', content: ics }] : undefined,
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
