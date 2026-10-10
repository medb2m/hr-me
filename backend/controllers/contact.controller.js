import mongoose from 'mongoose';
import { Contact } from '../models/contact.model.js';
import { sendContactConfirmation } from '../email/mailer.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_SUBJECTS = [
  'Question générale',
  'Candidature / placement',
  'Partenariat entreprise',
  'Recruteur / employeur',
  'Autre',
];

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * POST /api/contact — formulaire de contact public.
 * `{ name, email, phone?, company?, subject?, message, website? }`
 * `website` = honeypot anti-bot : rempli ⇒ accepté silencieusement sans persister.
 */
export async function submitContact(req, res) {
  try {
    const body = req.body || {};

    // Honeypot — un bot remplit le champ invisible ; on simule le succès.
    if (typeof body.website === 'string' && body.website.trim() !== '') {
      return res.status(201).json({ message: 'Message envoyé.' });
    }

    const name = String(body.name ?? '').trim().slice(0, 120);
    const email = String(body.email ?? '').trim().toLowerCase().slice(0, 190);
    const phone = String(body.phone ?? '').trim().slice(0, 40);
    const company = String(body.company ?? '').trim().slice(0, 140);
    const message = String(body.message ?? '').trim().slice(0, 5000);
    let subject = String(body.subject ?? '').trim().slice(0, 140);
    if (subject && !VALID_SUBJECTS.includes(subject)) {
      subject = 'Autre';
    }

    if (name.length < 2) {
      return res.status(400).json({ message: 'Votre nom est requis.' });
    }
    if (!email || !EMAIL_RE.test(email)) {
      return res.status(400).json({ message: 'Une adresse e-mail valide est requise.' });
    }
    if (message.length < 10) {
      return res.status(400).json({ message: 'Le message doit contenir au moins 10 caractères.' });
    }

    const contact = await Contact.create({
      name,
      email,
      phone,
      company,
      subject: subject || 'Question générale',
      message,
    });

    // Confirmation au visiteur — n'échoue jamais la requête si SMTP tombe.
    sendContactConfirmation({
      to: email,
      userName: name,
      subject: contact.subject,
      messageExcerpt: escapeHtml(message.slice(0, 400)),
    }).catch((err) => console.error('[contact] confirmation email failed:', err?.message || err));

    return res.status(201).json({ message: 'Message envoyé. Un e-mail de confirmation vous a été adressé.' });
  } catch (err) {
    console.error('[contact] submit', err);
    return res.status(500).json({ message: "Envoi impossible pour le moment — réessayez plus tard." });
  }
}

function publicContact(c) {
  return {
    id: c._id.toString(),
    name: c.name,
    email: c.email,
    phone: c.phone || '',
    company: c.company || '',
    subject: c.subject || '',
    message: c.message,
    status: c.status,
    createdAt: c.createdAt,
  };
}

/**
 * GET /api/admin/contacts — liste paginée.
 * Query: `page`, `limit` (def 10), `status` (new|archived|all), `q` (nom/email/société/sujet).
 */
export async function listContacts(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const filter = {};

    const status = String(req.query.status || '').trim();
    if (status === 'new' || status === 'archived') {
      filter.status = status;
    }

    const q = String(req.query.q || '').trim();
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: rx }, { email: rx }, { company: rx }, { subject: rx }];
    }

    const [total, newCount, contacts] = await Promise.all([
      Contact.countDocuments(filter),
      Contact.countDocuments({ status: 'new' }),
      Contact.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
    ]);

    return res.json({
      contacts: contacts.map(publicContact),
      total,
      newCount,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      limit,
    });
  } catch (err) {
    console.error('[admin/contacts] list', err);
    return res.status(500).json({ message: 'Impossible de charger les messages.' });
  }
}

/** PUT /api/admin/contacts/:id — `{ status: 'new' | 'archived' }`. */
export async function updateContact(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Identifiant invalide.' });
    }
    const status = String(req.body?.status || '').trim();
    if (!['new', 'archived'].includes(status)) {
      return res.status(400).json({ message: 'Statut invalide.' });
    }
    const contact = await Contact.findByIdAndUpdate(id, { status }, { new: true });
    if (!contact) {
      return res.status(404).json({ message: 'Message introuvable.' });
    }
    return res.json({ contact: publicContact(contact) });
  } catch (err) {
    console.error('[admin/contacts] update', err);
    return res.status(500).json({ message: 'Mise à jour impossible.' });
  }
}

/** DELETE /api/admin/contacts/:id */
export async function deleteContact(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Identifiant invalide.' });
    }
    const contact = await Contact.findById(id);
    if (!contact) {
      return res.status(404).json({ message: 'Message introuvable.' });
    }
    await contact.deleteOne();
    return res.json({ message: 'Message supprimé.', id });
  } catch (err) {
    console.error('[admin/contacts] delete', err);
    return res.status(500).json({ message: 'Suppression impossible.' });
  }
}
