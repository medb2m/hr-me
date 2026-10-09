import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import { User } from '../models/user.model.js';
import { ensureClientProfileForUser } from '../models/client-profile.model.js';

const BCRYPT_ROUNDS = 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES = ['client', 'candidate', 'agent', 'director', 'recruiter', 'admin'];

function publicUser(u) {
  return {
    id: u._id.toString(),
    email: u.email,
    name: u.name || '',
    role: u.role,
    emailVerified: Boolean(u.emailVerified),
    pendingEmail: u.pendingEmail || null,
    timeZone: u.timeZone || null,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}

/**
 * GET /api/admin/users — paginated list.
 * Query: `page` (1+), `limit` (1-100, def 10), `role`, `q` (name/email contains).
 */
export async function listUsers(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const filter = {};

    const role = typeof req.query.role === 'string' ? req.query.role.trim() : '';
    if (role) {
      if (!ROLES.includes(role)) {
        return res.status(400).json({ message: 'Rôle invalide.' });
      }
      filter.role = role;
    }

    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: rx }, { email: rx }];
    }

    const [total, users] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
    ]);

    return res.json({
      users: users.map(publicUser),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      limit,
    });
  } catch (err) {
    console.error('[admin/users] list', err);
    return res.status(500).json({ message: err.message || 'Impossible de charger les utilisateurs.' });
  }
}

/** GET /api/admin/users/stats — dashboard counters. */
export async function userStats(req, res) {
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [byRole, total, verified, recent] = await Promise.all([
      User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
      User.countDocuments(),
      User.countDocuments({ emailVerified: true }),
      User.countDocuments({ createdAt: { $gte: since } }),
    ]);
    const roles = Object.fromEntries(ROLES.map((r) => [r, 0]));
    for (const row of byRole) {
      if (row._id in roles) roles[row._id] = row.count;
    }
    return res.json({ total, verified, unverified: total - verified, recent30d: recent, byRole: roles });
  } catch (err) {
    console.error('[admin/users] stats', err);
    return res.status(500).json({ message: 'Statistiques indisponibles.' });
  }
}

/**
 * POST /api/admin/users — create any account type. `{ name, email, role, password, emailVerified? }`
 * Admin-created accounts are verified by default (no inbox loop needed).
 */
export async function createUser(req, res) {
  try {
    const { name, email, role, password, emailVerified } = req.body || {};
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!normalizedEmail || !EMAIL_RE.test(normalizedEmail)) {
      return res.status(400).json({ message: 'Une adresse e-mail valide est requise.' });
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ message: 'Le mot de passe doit contenir au moins 8 caractères.' });
    }
    const r = typeof role === 'string' ? role.trim() : 'client';
    if (!ROLES.includes(r)) {
      return res.status(400).json({ message: 'Rôle invalide.' });
    }

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ message: 'Un compte existe déjà avec cet e-mail.' });
    }

    const user = await User.create({
      email: normalizedEmail,
      passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
      name: typeof name === 'string' ? name.trim() : '',
      role: r,
      emailVerified: emailVerified === false ? false : true,
    });

    if (r === 'client' || r === 'candidate') {
      try {
        await ensureClientProfileForUser(user._id);
      } catch (e) {
        console.error('[admin/users] ensureClientProfile', e);
      }
    }

    return res.status(201).json({ user: publicUser(user) });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Un compte existe déjà avec cet e-mail.' });
    }
    console.error('[admin/users] create', err);
    return res.status(500).json({ message: err.message || 'Création impossible.' });
  }
}

/**
 * PUT /api/admin/users/:id — `{ name, email, role, emailVerified, password? }`.
 * `password` optional: resets the password when provided (≥8 chars).
 */
export async function updateUser(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Identifiant invalide.' });
    }
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur introuvable.' });
    }

    const body = req.body || {};
    const isSelf = id === req.admin.id;

    if (Object.prototype.hasOwnProperty.call(body, 'name')) {
      user.name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : '';
    }
    if (Object.prototype.hasOwnProperty.call(body, 'email')) {
      const em = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      if (!em || !EMAIL_RE.test(em)) {
        return res.status(400).json({ message: 'Adresse e-mail invalide.' });
      }
      if (em !== user.email) {
        const taken = await User.findOne({ email: em });
        if (taken) {
          return res.status(409).json({ message: 'Cet e-mail est déjà utilisé.' });
        }
        user.email = em;
        user.pendingEmail = null;
        user.emailChangeToken = null;
        user.emailChangeExpires = null;
      }
    }
    if (Object.prototype.hasOwnProperty.call(body, 'role')) {
      const r = String(body.role || '').trim();
      if (!ROLES.includes(r)) {
        return res.status(400).json({ message: 'Rôle invalide.' });
      }
      if (isSelf && r !== 'admin') {
        return res.status(400).json({ message: 'Vous ne pouvez pas retirer votre propre rôle admin.' });
      }
      user.role = r;
      if (r === 'client' || r === 'candidate') {
        try {
          await ensureClientProfileForUser(user._id);
        } catch (e) {
          console.error('[admin/users] ensureClientProfile', e);
        }
      }
    }
    if (Object.prototype.hasOwnProperty.call(body, 'emailVerified')) {
      if (isSelf && body.emailVerified === false) {
        return res.status(400).json({ message: 'Impossible de dé-vérifier votre propre compte.' });
      }
      user.emailVerified = Boolean(body.emailVerified);
      if (user.emailVerified) {
        user.emailVerifyToken = null;
        user.emailVerifyExpires = null;
      }
    }
    if (body.password != null && body.password !== '') {
      if (typeof body.password !== 'string' || body.password.length < 8) {
        return res.status(400).json({ message: 'Le mot de passe doit contenir au moins 8 caractères.' });
      }
      user.passwordHash = await bcrypt.hash(body.password, BCRYPT_ROUNDS);
    }

    await user.save();
    return res.json({ user: publicUser(user) });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Cet e-mail est déjà utilisé.' });
    }
    console.error('[admin/users] update', err);
    return res.status(500).json({ message: err.message || 'Mise à jour impossible.' });
  }
}

/** DELETE /api/admin/users/:id — self-deletion is blocked. */
export async function deleteUser(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Identifiant invalide.' });
    }
    if (id === req.admin.id) {
      return res.status(400).json({ message: 'Vous ne pouvez pas supprimer votre propre compte.' });
    }
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur introuvable.' });
    }
    await user.deleteOne();
    return res.json({ message: 'Utilisateur supprimé.', id });
  } catch (err) {
    console.error('[admin/users] delete', err);
    return res.status(500).json({ message: err.message || 'Suppression impossible.' });
  }
}
