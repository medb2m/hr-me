import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { User } from '../models/user.model.js';
import {
  sendEmailChangeVerify,
  sendPasswordChangedEmail,
  isSmtpConfigured,
} from '../email/mailer.js';
import { smtpErrorPayload } from '../email/smtp-errors.js';
import { getFrontendBaseUrl } from '../config/public-url.js';
import { cleanPersonNameInput } from '../helpers/person-name.js';

const BCRYPT_ROUNDS = 10;
const EMAIL_CHANGE_HOURS = 48;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function publicUser(u) {
  return {
    id: u._id.toString(),
    email: u.email,
    name: u.name || '',
    role: u.role,
    emailVerified: Boolean(u.emailVerified),
    pendingEmail: u.pendingEmail || null,
    timeZone: u.timeZone || null,
    avatarUrl: u.avatarUrl || '',
    createdAt: u.createdAt,
  };
}

/** GET /api/users/me — current account for the settings page. */
export async function getMe(req, res) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    return res.json({ user: publicUser(user) });
  } catch (err) {
    console.error('[users/me] getMe', err);
    return res.status(500).json({ message: err.message || 'Could not load account.' });
  }
}

/**
 * PUT /api/users/me — update editable profile fields (`name`, `timeZone`).
 * Email goes through the dedicated confirm flow (POST /me/email-change).
 */
export async function updateMe(req, res) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const body = req.body || {};
    if (Object.prototype.hasOwnProperty.call(body, 'name')) {
      const { name: cleanName, error: nameError } = cleanPersonNameInput(body.name);
      if (nameError) {
        return res.status(400).json({ message: nameError });
      }
      user.name = cleanName;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'timeZone')) {
      const tz = typeof body.timeZone === 'string' ? body.timeZone.trim() : '';
      if (tz && tz.length <= 64) {
        try {
          Intl.DateTimeFormat('en', { timeZone: tz });
          user.timeZone = tz;
        } catch {
          return res.status(400).json({ message: 'Invalid time zone.' });
        }
      } else {
        user.timeZone = null;
      }
    }

    await user.save();
    return res.json({ user: publicUser(user) });
  } catch (err) {
    console.error('[users/me] updateMe', err);
    return res.status(500).json({ message: err.message || 'Update failed.' });
  }
}

/**
 * POST /api/users/me/email-change — body `{ newEmail }`.
 * Sends a confirmation link to the *new* address; the switch happens via
 * POST /confirm-email-change so the account is never locked to a bad inbox.
 */
export async function requestEmailChange(req, res) {
  try {
    const raw = req.body?.newEmail;
    const newEmail = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
    if (!newEmail || !EMAIL_RE.test(newEmail)) {
      return res.status(400).json({ message: 'A valid new email address is required.' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    if (newEmail === user.email) {
      return res.status(400).json({ message: 'This is already your email address.' });
    }
    const taken = await User.findOne({ email: newEmail });
    if (taken) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }
    if (!isSmtpConfigured()) {
      return res.status(503).json({
        message: 'Email is not configured on the server.',
        code: 'EMAIL_NOT_CONFIGURED',
      });
    }

    const token = crypto.randomBytes(32).toString('hex');
    user.pendingEmail = newEmail;
    user.emailChangeToken = token;
    user.emailChangeExpires = new Date(Date.now() + EMAIL_CHANGE_HOURS * 60 * 60 * 1000);
    await user.save();

    const base = getFrontendBaseUrl();
    const confirmUrl = `${base}/confirm-email-change?token=${encodeURIComponent(token)}`;

    try {
      await sendEmailChangeVerify({
        to: newEmail,
        userName: user.name || user.email.split('@')[0],
        confirmUrl,
      });
    } catch (emailErr) {
      user.pendingEmail = null;
      user.emailChangeToken = null;
      user.emailChangeExpires = null;
      await user.save();
      const payload = smtpErrorPayload(emailErr);
      console.error('[users/me] email-change send failed:', emailErr.code, emailErr.message);
      return res.status(503).json({ message: payload.message, code: payload.code });
    }

    return res.json({
      user: publicUser(user),
      message: `Confirmation link sent to ${newEmail}.`,
    });
  } catch (err) {
    console.error('[users/me] requestEmailChange', err);
    return res.status(500).json({ message: err.message || 'Request failed.' });
  }
}

/** POST /api/users/me/email-change/cancel — drop a pending email change. */
export async function cancelEmailChange(req, res) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    user.pendingEmail = null;
    user.emailChangeToken = null;
    user.emailChangeExpires = null;
    await user.save();
    return res.json({ user: publicUser(user) });
  } catch (err) {
    console.error('[users/me] cancelEmailChange', err);
    return res.status(500).json({ message: err.message || 'Request failed.' });
  }
}

/**
 * POST /api/users/confirm-email-change — body `{ token }` (public, link from email).
 * Switches the account to `pendingEmail`, keeps it verified, issues a fresh session shape.
 */
export async function confirmEmailChange(req, res) {
  try {
    const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
    if (!token) {
      return res.status(400).json({ message: 'Confirmation token is required.' });
    }

    const user = await User.findOne({
      emailChangeToken: token,
      emailChangeExpires: { $gt: new Date() },
    });
    if (!user || !user.pendingEmail) {
      return res.status(400).json({
        message: 'This confirmation link is invalid or expired. Request a new email change.',
        code: 'EMAIL_CHANGE_TOKEN_INVALID',
      });
    }

    const taken = await User.findOne({ email: user.pendingEmail });
    if (taken) {
      user.pendingEmail = null;
      user.emailChangeToken = null;
      user.emailChangeExpires = null;
      await user.save();
      return res.status(409).json({
        message: 'This email address is now used by another account.',
        code: 'EMAIL_TAKEN',
      });
    }

    user.email = user.pendingEmail;
    user.emailVerified = true;
    user.pendingEmail = null;
    user.emailChangeToken = null;
    user.emailChangeExpires = null;
    await user.save();

    return res.json({ user: publicUser(user), message: 'Email address updated.' });
  } catch (err) {
    console.error('[users] confirmEmailChange', err);
    return res.status(500).json({ message: err.message || 'Confirmation failed.' });
  }
}

/**
 * POST /api/users/me/avatar — multipart `photo` (JPEG/PNG/WebP ≤ 2 Mo).
 * Enregistre le fichier sous /uploads/avatars et le définit comme photo de compte.
 */
export async function uploadAvatar(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Aucune image reçue (champ « photo »).' });
    }
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    user.avatarUrl = `/uploads/avatars/${req.file.filename}`;
    await user.save();
    return res.json({ user: publicUser(user) });
  } catch (err) {
    console.error('[users/me] uploadAvatar', err);
    return res.status(500).json({ message: err.message || 'Upload failed.' });
  }
}

/**
 * PUT /api/users/me/avatar — body `{ url }` : réutilise une image déjà
 * servie par l'app (ex. une photo de l'historique du dossier candidat).
 * Seuls les chemins internes `/uploads/…` ou `/img/…` sont acceptés.
 */
export async function setAvatarFromUrl(req, res) {
  try {
    const url = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
    if (!/^\/(uploads|img)\/[\w\-./]+$/i.test(url) || url.includes('..')) {
      return res.status(400).json({ message: 'URL de photo invalide.' });
    }
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    user.avatarUrl = url;
    await user.save();
    return res.json({ user: publicUser(user) });
  } catch (err) {
    console.error('[users/me] setAvatarFromUrl', err);
    return res.status(500).json({ message: err.message || 'Update failed.' });
  }
}

/** DELETE /api/users/me/avatar — revient à la photo par défaut. */
export async function removeAvatar(req, res) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    user.avatarUrl = '';
    await user.save();
    return res.json({ user: publicUser(user) });
  } catch (err) {
    console.error('[users/me] removeAvatar', err);
    return res.status(500).json({ message: err.message || 'Update failed.' });
  }
}

/**
 * PUT /api/users/me/password — body `{ currentPassword, newPassword }`.
 */
export async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || typeof currentPassword !== 'string') {
      return res.status(400).json({ message: 'Current password is required.' });
    }
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters.' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const match = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!match) {
      return res.status(401).json({ message: 'Current password is incorrect.' });
    }

    user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await user.save();

    let notificationSent = true;
    try {
      await sendPasswordChangedEmail({
        to: user.email,
        userName: user.name || user.email.split('@')[0],
      });
    } catch (emailErr) {
      notificationSent = false;
      console.error('[users/me] password-changed email failed:', emailErr.code, emailErr.message);
    }

    return res.json({ message: 'Password updated.', notificationSent });
  } catch (err) {
    console.error('[users/me] changePassword', err);
    return res.status(500).json({ message: err.message || 'Update failed.' });
  }
}
