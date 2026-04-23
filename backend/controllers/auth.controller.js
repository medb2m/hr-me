import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User } from '../models/user.model.js';
import {
  sendVerifyEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendPasswordChangedEmail,
  isSmtpConfigured,
} from '../email/mailer.js';
import { smtpErrorPayload } from '../email/smtp-errors.js';
import { getFrontendBaseUrl } from '../config/public-url.js';
import { getJwtSecret } from '../utils/jwt.js';

const BCRYPT_ROUNDS = 10;
const EMAIL_VERIFY_HOURS = 48;
const RESET_PASSWORD_MINUTES = 60;

function signToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), email: user.email, role: user.role },
    getJwtSecret(),
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function randomToken() {
  return crypto.randomBytes(32).toString('hex');
}

export async function register(req, res) {
  try {
    const { name, email, password } = req.body || {};
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ message: 'Email is required.' });
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const verifyToken = randomToken();
    const verifyExpires = new Date(Date.now() + EMAIL_VERIFY_HOURS * 60 * 60 * 1000);

    const user = await User.create({
      email: normalizedEmail,
      passwordHash,
      name: typeof name === 'string' ? name.trim() : '',
      role: 'client',
      emailVerified: false,
      emailVerifyToken: verifyToken,
      emailVerifyExpires: verifyExpires,
    });

    if (!isSmtpConfigured()) {
      await User.findByIdAndDelete(user._id);
      return res.status(503).json({
        message:
          'Email is not configured on the server. Set SMTP_* in .env, then try registering again.',
        code: 'EMAIL_NOT_CONFIGURED',
      });
    }

    const base = getFrontendBaseUrl();
    const verifyUrl = `${base}/verify-email?token=${encodeURIComponent(verifyToken)}&email=${encodeURIComponent(user.email)}`;

    try {
      await sendVerifyEmail({
        to: user.email,
        userName: user.name || user.email.split('@')[0],
        verifyUrl,
      });
    } catch (emailErr) {
      await User.findByIdAndDelete(user._id);
      const payload = smtpErrorPayload(emailErr);
      console.error('[auth/register] verification email failed:', emailErr.code, emailErr.message);
      return res.status(503).json({
        message: payload.message,
        code: payload.code,
      });
    }

    return res.status(201).json({
      message: 'Account created. Check your email to verify your address.',
      userId: user._id.toString(),
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }
    console.error('[auth/register]', err);
    return res.status(500).json({ message: err.message || 'Registration failed.' });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    if (!user.emailVerified) {
      return res.status(403).json({
        message: 'Please verify your email before signing in. Check your inbox for the link.',
      });
    }

    const token = signToken(user);
    return res.json({
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name || '',
        role: user.role,
      },
    });
  } catch (err) {
    console.error('[auth/login]', err);
    return res.status(500).json({ message: err.message || 'Sign in failed.' });
  }
}

export async function forgotPassword(req, res) {
  const generic =
    'If an account exists for that email, you will receive password reset instructions shortly.';

  try {
    const { email } = req.body || {};
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ message: 'Email is required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (user) {
      const resetToken = randomToken();
      user.passwordResetToken = resetToken;
      user.passwordResetExpires = new Date(Date.now() + RESET_PASSWORD_MINUTES * 60 * 1000);
      await user.save();

      const base = getFrontendBaseUrl();
      const resetUrl = `${base}/reset-password?token=${encodeURIComponent(resetToken)}`;

      try {
        await sendPasswordResetEmail({
          to: user.email,
          userName: user.name || user.email.split('@')[0],
          resetUrl,
          expiryMinutes: RESET_PASSWORD_MINUTES,
        });
      } catch (emailErr) {
        console.error('[auth/forgot-password] email send failed:', emailErr.code, emailErr.message);
        // Same generic response so we do not reveal whether the address exists or SMTP is down.
      }
    }

    return res.json({ message: generic });
  } catch (err) {
    console.error('[auth/forgot-password]', err);
    return res.status(500).json({ message: err.message || 'Request failed.' });
  }
}

export async function resetPassword(req, res) {
  try {
    const { token, password } = req.body || {};
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ message: 'Reset token is required.' });
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    }

    const user = await User.findOne({
      passwordResetToken: token.trim(),
      passwordResetExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({
        message: 'This reset link is invalid or expired. Request a new one from forgot password.',
      });
    }

    user.passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    await user.save();

    let passwordChangedEmailSent = true;
    try {
      await sendPasswordChangedEmail({
        to: user.email,
        userName: user.name || user.email.split('@')[0],
      });
    } catch (emailErr) {
      passwordChangedEmailSent = false;
      console.error(
        '[auth/reset-password] notification email failed (password was still updated):',
        emailErr.code,
        emailErr.message
      );
    }

    return res.json({
      message: 'Password has been reset. You can sign in now.',
      passwordChangedEmailSent,
      ...(passwordChangedEmailSent === false && {
        mailNotice:
          'Your password was updated, but we could not send a confirmation email. You can still sign in.',
      }),
    });
  } catch (err) {
    console.error('[auth/reset-password]', err);
    return res.status(500).json({ message: err.message || 'Could not reset password.' });
  }
}

export async function verifyEmail(req, res) {
  try {
    const { token, email: emailHint } = req.body || {};
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ message: 'Verification token is required.' });
    }

    const trimmedToken = token.trim();
    const normalizedHint =
      typeof emailHint === 'string' && emailHint.trim()
        ? emailHint.trim().toLowerCase()
        : '';

    let user = await User.findOne({
      emailVerifyToken: trimmedToken,
      emailVerifyExpires: { $gt: new Date() },
    });

    // Token missing (e.g. already consumed) but client passes email — recover "already verified" after a partial failure.
    if (!user && normalizedHint) {
      const already = await User.findOne({ email: normalizedHint, emailVerified: true });
      if (already) {
        return res.json({
          message: 'Email already verified. You can sign in.',
          alreadyVerified: true,
          welcomeEmailSent: true,
        });
      }
    }

    if (!user) {
      return res.status(400).json({
        message:
          'This verification link is invalid or expired. If you already opened the link once, try signing in — your email may already be verified. Otherwise register again or use resend verification.',
        code: 'VERIFY_TOKEN_INVALID',
      });
    }

    if (user.emailVerified) {
      return res.json({
        message: 'Email already verified. You can sign in.',
        alreadyVerified: true,
        welcomeEmailSent: true,
      });
    }

    user.emailVerified = true;
    user.emailVerifyToken = null;
    user.emailVerifyExpires = null;
    await user.save();

    const base = getFrontendBaseUrl();
    const loginUrl = `${base}/login`;

    let welcomeEmailSent = true;
    let mailNotice = null;
    let mailCode = null;
    try {
      await sendWelcomeEmail({
        to: user.email,
        userName: user.name || user.email.split('@')[0],
        loginUrl,
      });
    } catch (welcomeErr) {
      welcomeEmailSent = false;
      const payload = smtpErrorPayload(welcomeErr);
      mailNotice = payload.message;
      mailCode = payload.code;
      console.error(
        '[auth/verify-email] welcome email failed (verification succeeded):',
        welcomeErr.code,
        welcomeErr.message
      );
    }

    return res.json({
      message: 'Email verified successfully. You can sign in now.',
      alreadyVerified: false,
      welcomeEmailSent,
      ...(mailNotice && { mailNotice, mailCode }),
    });
  } catch (err) {
    console.error('[auth/verify-email]', err);
    return res.status(500).json({ message: err.message || 'Verification failed.' });
  }
}

/**
 * Resend verification for an existing unverified account (e.g. SMTP failed at register).
 * Requires password to limit abuse.
 */
export async function resendVerification(req, res) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    if (user.emailVerified) {
      return res.status(400).json({ message: 'This account is already verified. Sign in.' });
    }

    if (!isSmtpConfigured()) {
      return res.status(503).json({
        message: 'Email is not configured on the server.',
        code: 'EMAIL_NOT_CONFIGURED',
      });
    }

    const verifyToken = randomToken();
    user.emailVerifyToken = verifyToken;
    user.emailVerifyExpires = new Date(Date.now() + EMAIL_VERIFY_HOURS * 60 * 60 * 1000);
    await user.save();

    const base = getFrontendBaseUrl();
    const verifyUrl = `${base}/verify-email?token=${encodeURIComponent(verifyToken)}&email=${encodeURIComponent(user.email)}`;

    try {
      await sendVerifyEmail({
        to: user.email,
        userName: user.name || user.email.split('@')[0],
        verifyUrl,
      });
    } catch (emailErr) {
      const payload = smtpErrorPayload(emailErr);
      console.error('[auth/resend-verification] email failed:', emailErr.code, emailErr.message);
      return res.status(503).json({
        message: payload.message,
        code: payload.code,
      });
    }

    return res.json({ message: 'Verification email sent. Check your inbox.' });
  } catch (err) {
    console.error('[auth/resend-verification]', err);
    return res.status(500).json({ message: err.message || 'Request failed.' });
  }
}

/** True if no user with role `admin` exists (first-time setup). */
export async function adminStatus(req, res) {
  try {
    const count = await User.countDocuments({ role: 'admin' });
    return res.json({ needsBootstrap: count === 0 });
  } catch (err) {
    console.error('[auth/admin/status]', err);
    return res.status(500).json({ message: 'Could not read admin status.' });
  }
}

/**
 * Create the first (and only via this endpoint) administrator.
 * Optional: set ADMIN_BOOTSTRAP_SECRET in .env and send header X-Admin-Bootstrap-Secret.
 */
export async function bootstrapAdmin(req, res) {
  try {
    const adminCount = await User.countDocuments({ role: 'admin' });
    if (adminCount > 0) {
      return res.status(403).json({
        message: 'An administrator already exists. Use admin sign-in.',
        code: 'ADMIN_EXISTS',
      });
    }

    const expectedSecret = process.env.ADMIN_BOOTSTRAP_SECRET?.trim();
    if (expectedSecret) {
      const sent = req.headers['x-admin-bootstrap-secret'];
      if (sent !== expectedSecret) {
        return res.status(403).json({
          message: 'Invalid or missing bootstrap secret.',
          code: 'BOOTSTRAP_FORBIDDEN',
        });
      }
    }

    const { name, email, password } = req.body || {};
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ message: 'Email is required.' });
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({
        message: 'This email is already registered. Use a different email or admin sign-in.',
      });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await User.create({
      email: normalizedEmail,
      passwordHash,
      name: typeof name === 'string' ? name.trim() : '',
      role: 'admin',
      emailVerified: true,
      emailVerifyToken: null,
      emailVerifyExpires: null,
    });

    const token = signToken(user);
    return res.status(201).json({
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name || '',
        role: user.role,
      },
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'This email is already registered.' });
    }
    console.error('[auth/admin/bootstrap]', err);
    return res.status(500).json({ message: err.message || 'Bootstrap failed.' });
  }
}

/** Sign in only if the account has role `admin`. */
export async function adminLogin(req, res) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({
        message: 'This account is not an administrator.',
        code: 'NOT_ADMIN',
      });
    }

    if (!user.emailVerified) {
      return res.status(403).json({
        message: 'Please verify this email before signing in.',
      });
    }

    const token = signToken(user);
    return res.json({
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name || '',
        role: user.role,
      },
    });
  } catch (err) {
    console.error('[auth/admin/login]', err);
    return res.status(500).json({ message: err.message || 'Sign in failed.' });
  }
}
