import mongoose from 'mongoose';
import { Offer } from '../models/offer.js';
import { Application } from '../models/application.js';
import { chatCompletion } from '../services/llm.service.js';
import { uploadsPublicPath } from '../helpers/upload-basics.js';

const MODE_VALUES = new Set(['onsite', 'hybrid', 'remote']);
const STATUS_VALUES = new Set(['draft', 'published', 'closed']);
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function str(v, max = 300) {
  return String(v ?? '').trim().slice(0, max);
}

/** Champs modifiables via create/update (whitelist). */
function pickBody(b) {
  const out = {};
  out.name = str(b.name, 180);
  out.partner = str(b.partner, 180);
  out.companyLogo = str(b.companyLogo, 400);
  out.description = String(b.description ?? '').slice(0, 50000);
  out.price = Number.isFinite(+b.price) ? +b.price : 0;
  out.country = {
    code: str(b.country?.code, 3).toUpperCase(),
    name: str(b.country?.name, 80),
  };
  out.city = str(b.city, 120);
  out.workMode = MODE_VALUES.has(b.workMode) ? b.workMode : 'onsite';
  out.openings = Math.min(500, Math.max(1, parseInt(b.openings, 10) || 1));
  out.skills = Array.isArray(b.skills)
    ? b.skills.map((s) => str(s, 60)).filter(Boolean).slice(0, 30)
    : [];
  out.contract = str(b.contract, 60);
  out.salary = str(b.salary, 80);
  out.sector = str(b.sector, 80);
  out.urgent = !!b.urgent;
  out.publishDate = b.publishDate ? new Date(b.publishDate) : null;
  out.deadline = b.deadline ? new Date(b.deadline) : null;
  out.status = STATUS_VALUES.has(b.status) ? b.status : 'published';
  if (out.publishDate && Number.isNaN(out.publishDate.getTime())) out.publishDate = null;
  if (out.deadline && Number.isNaN(out.deadline.getTime())) out.deadline = null;
  return out;
}

function validate(data) {
  if (!data.name) return 'Le titre de l\u2019offre est requis.';
  if (!data.partner) return 'L\u2019entreprise est requise.';
  if (data.publishDate && data.deadline && data.deadline < data.publishDate) {
    return 'La date de fin doit être après la date de publication.';
  }
  return '';
}

/** DTO liste/détail — ajoute isExpired, daysLeft et compteurs de candidatures. */
function toDto(o, appStats = { total: 0, candidate: 0, client: 0, agent: 0 }) {
  const now = Date.now();
  const dl = o.deadline ? new Date(o.deadline).getTime() : null;
  const isExpired = dl !== null && dl < now;
  const daysLeft = dl === null ? null : Math.ceil((dl - now) / MS_PER_DAY);
  return {
    id: o._id,
    name: o.name,
    partner: o.partner,
    companyLogo: o.companyLogo || '',
    description: o.description || '',
    price: o.price ?? 0,
    country: o.country || { code: '', name: '' },
    city: o.city || '',
    workMode: o.workMode || 'onsite',
    openings: o.openings ?? 1,
    skills: o.skills || [],
    contract: o.contract || '',
    salary: o.salary || '',
    sector: o.sector || '',
    urgent: !!o.urgent,
    publishDate: o.publishDate || null,
    deadline: o.deadline || null,
    status: o.status || 'published',
    isExpired,
    daysLeft,
    postedBy: {
      role: o.postedBy?.role || '',
      label: o.postedBy?.label || '',
    },
    lastModifiedAt: o.lastModifiedAt || o.updatedAt || null,
    createdAt: o.createdAt,
    applications: appStats,
  };
}

/** GET /api/admin/offers — liste paginée + filtres + compteurs. */
export const listOffers = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const q = str(req.query.q, 120);
    const status = str(req.query.status, 20);
    const mode = str(req.query.mode, 20);
    const country = str(req.query.country, 3).toUpperCase();
    const sort = str(req.query.sort, 20) || 'recent';

    const filter = {};
    const now = new Date();
    if (q) {
      const rx = new RegExp(escapeRegExp(q), 'i');
      filter.$or = [
        { name: rx },
        { partner: rx },
        { 'country.name': rx },
        { city: rx },
        { skills: rx },
      ];
    }
    if (MODE_VALUES.has(mode)) filter.workMode = mode;
    if (country) filter['country.code'] = country;
    if (status === 'expired') {
      filter.deadline = { $ne: null, $lt: now };
    } else if (STATUS_VALUES.has(status)) {
      filter.status = status;
    }

    const sortSpec =
      sort === 'deadline'
        ? { deadline: 1, createdAt: -1 }
        : sort === 'name'
          ? { name: 1 }
          : { createdAt: -1 };

    const [total, offers, counters] = await Promise.all([
      Offer.countDocuments(filter),
      Offer.find(filter)
        .sort(sortSpec)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      // Compteurs globaux pour les onglets de filtre.
      Promise.all([
        Offer.countDocuments({}),
        Offer.countDocuments({ status: 'published' }),
        Offer.countDocuments({ status: 'draft' }),
        Offer.countDocuments({ status: 'closed' }),
        Offer.countDocuments({ deadline: { $ne: null, $lt: now } }),
        Application.countDocuments({}),
      ]),
    ]);

    // Candidatures par offre, ventilées par source (candidate/client/agent).
    const ids = offers.map((o) => o._id);
    const aggs = await Application.aggregate([
      { $match: { offer: { $in: ids } } },
      { $group: { _id: { offer: '$offer', source: '$source' }, n: { $sum: 1 } } },
    ]);
    const statsByOffer = new Map();
    for (const a of aggs) {
      const key = String(a._id.offer);
      const cur = statsByOffer.get(key) || { total: 0, candidate: 0, client: 0, agent: 0 };
      const src = ['candidate', 'client', 'agent'].includes(a._id.source)
        ? a._id.source
        : 'candidate';
      cur[src] += a.n;
      cur.total += a.n;
      statsByOffer.set(key, cur);
    }
    // Fallback : offres dont la candidature n'existe que dans le tableau legacy `applications`.
    for (const o of offers) {
      const key = String(o._id);
      const cur = statsByOffer.get(key) || { total: 0, candidate: 0, client: 0, agent: 0 };
      const legacy = Array.isArray(o.applications) ? o.applications.length : 0;
      if (legacy > cur.total) {
        cur.candidate += legacy - cur.total;
        cur.total = legacy;
      }
      statsByOffer.set(key, cur);
    }

    res.json({
      offers: offers.map((o) =>
        toDto(o, statsByOffer.get(String(o._id)) || { total: 0, candidate: 0, client: 0, agent: 0 }),
      ),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      limit,
      counters: {
        total: counters[0],
        published: counters[1],
        draft: counters[2],
        closed: counters[3],
        expired: counters[4],
        applications: counters[5],
      },
    });
  } catch (error) {
    console.error('[admin-offers/list]', error);
    res.status(500).json({ message: 'Impossible de charger les offres.' });
  }
};

/** GET /api/admin/offers/:id */
export const getOffer = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: 'Offre introuvable.' });
    }
    const o = await Offer.findById(req.params.id).lean();
    if (!o) return res.status(404).json({ message: 'Offre introuvable.' });
    const aggs = await Application.aggregate([
      { $match: { offer: o._id } },
      { $group: { _id: '$source', n: { $sum: 1 } } },
    ]);
    const stats = { total: 0, candidate: 0, client: 0, agent: 0 };
    for (const a of aggs) {
      const src = ['candidate', 'client', 'agent'].includes(a._id) ? a._id : 'candidate';
      stats[src] += a.n;
      stats.total += a.n;
    }
    const legacy = Array.isArray(o.applications) ? o.applications.length : 0;
    if (legacy > stats.total) {
      stats.candidate += legacy - stats.total;
      stats.total = legacy;
    }
    res.json({ offer: toDto(o, stats) });
  } catch (error) {
    console.error('[admin-offers/get]', error);
    res.status(500).json({ message: 'Impossible de charger l\u2019offre.' });
  }
};

/** POST /api/admin/offers */
export const createOffer = async (req, res) => {
  try {
    const data = pickBody(req.body || {});
    const err = validate(data);
    if (err) return res.status(400).json({ message: err });
    const offer = new Offer({
      ...data,
      postedBy: { user: req.admin.id, role: 'admin', label: req.admin.email },
      lastModifiedAt: new Date(),
      lastModifiedBy: req.admin.id,
    });
    await offer.save();
    res.status(201).json({ offer: toDto(offer.toObject()) });
  } catch (error) {
    console.error('[admin-offers/create]', error);
    res.status(400).json({ message: 'Création impossible.' });
  }
};

/** PUT /api/admin/offers/:id — met aussi à jour lastModifiedAt/lastModifiedBy. */
export const updateOffer = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: 'Offre introuvable.' });
    }
    const data = pickBody(req.body || {});
    const err = validate(data);
    if (err) return res.status(400).json({ message: err });
    const offer = await Offer.findByIdAndUpdate(
      req.params.id,
      { ...data, lastModifiedAt: new Date(), lastModifiedBy: req.admin.id },
      { new: true },
    ).lean();
    if (!offer) return res.status(404).json({ message: 'Offre introuvable.' });
    res.json({ offer: toDto(offer) });
  } catch (error) {
    console.error('[admin-offers/update]', error);
    res.status(400).json({ message: 'Mise à jour impossible.' });
  }
};

/** DELETE /api/admin/offers/:id */
export const deleteOffer = async (req, res) => {
  try {
    await Offer.findByIdAndDelete(req.params.id);
    await Application.deleteMany({ offer: req.params.id });
    res.json({ message: 'Offre supprimée.' });
  } catch (error) {
    console.error('[admin-offers/delete]', error);
    res.status(500).json({ message: 'Suppression impossible.' });
  }
};

/** POST /api/admin/offers/logo — upload logo (multipart `logo`) → { url }. */
export const uploadLogo = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Aucun fichier reçu.' });
  }
  res.json({ url: uploadsPublicPath('company-logos', req.file.filename) });
};

/* ------------------------------- IA --------------------------------- */

const DESC_SYSTEM = `Tu es un rédacteur RH senior pour une agence de placement international (Al Wassit).
Rédige une description d'offre d'emploi professionnelle, claire et attractive EN FRANÇAIS.
Réponds UNIQUEMENT avec du HTML prêt à afficher, sans balise <html>/<body>, sans markdown.
Structure attendue :
- <p> courte accroche (2-3 phrases : poste, contexte, pourquoi c'est une opportunité)
- <h3>Missions</h3> puis <ul><li>… (4 à 6 puces)
- <h3>Profil recherché</h3> puis <ul><li>… (4 à 6 puces : diplôme, expérience, compétences, langues)
- <h3>Nous offrons</h3> puis <ul><li>… (3 à 5 puces : salaire/fourchette si donnée, logement, accompagnement visa, cadre)
Ton : professionnel, chaleureux, orienté placement international. N'invente pas de montants précis sauf si fournis.`;

/** POST /api/admin/offers/generate-description — { title, partner, country, city, workMode, skills, prompt } → { description }. */
export const generateDescription = async (req, res) => {
  try {
    const b = req.body || {};
    const ctx = [
      b.title ? `Poste : ${str(b.title, 150)}` : '',
      b.partner ? `Entreprise : ${str(b.partner, 120)}` : '',
      b.country ? `Pays : ${str(b.country, 80)}` : '',
      b.city ? `Ville : ${str(b.city, 80)}` : '',
      b.workMode
        ? `Mode de travail : ${{ onsite: 'sur site', hybrid: 'hybride', remote: 'remote' }[b.workMode] || b.workMode}`
        : '',
      Array.isArray(b.skills) && b.skills.length
        ? `Compétences demandées : ${b.skills.map((s) => str(s, 40)).join(', ')}`
        : '',
      b.prompt ? `Consignes de l'utilisateur : ${str(b.prompt, 1500)}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    if (!ctx.trim()) {
      return res.status(400).json({ message: 'Indique au moins le poste ou une consigne.' });
    }
    const description = await chatCompletion([
      { role: 'system', content: DESC_SYSTEM },
      { role: 'user', content: ctx },
    ]);
    res.json({ description });
  } catch (err) {
    console.error('[admin-offers/generate-description]', err);
    res
      .status(err.statusCode || 500)
      .json({ message: err.message || 'Génération impossible.' });
  }
};

const SKILLS_SYSTEM = `Tu es un expert en recrutement international.
À partir d'un intitulé de poste et/ou d'une description d'offre, propose de 6 à 12 compétences clés (hard skills principalement, langues si pertinent).
Réponds UNIQUEMENT avec un tableau JSON de chaînes, ex. ["Soudure TIG","Lecture de plan","Anglais B2"]. Pas de texte autour.`;

/** POST /api/admin/offers/suggest-skills — { title, description } → { skills: string[] }. */
export const suggestSkills = async (req, res) => {
  try {
    const title = str(req.body?.title, 150);
    const rawDesc = String(req.body?.description ?? '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 4000);
    if (!title && !rawDesc) {
      return res.status(400).json({ message: 'Renseigne le poste ou la description.' });
    }
    const raw = await chatCompletion([
      { role: 'system', content: SKILLS_SYSTEM },
      { role: 'user', content: `Poste : ${title}\nDescription : ${rawDesc}` },
    ]);
    let skills = [];
    try {
      const m = raw.match(/\[[\s\S]*\]/);
      const arr = m ? JSON.parse(m[0]) : [];
      skills = arr.map((s) => String(s).trim()).filter(Boolean).slice(0, 15);
    } catch {
      skills = [];
    }
    res.json({ skills });
  } catch (err) {
    console.error('[admin-offers/suggest-skills]', err);
    res
      .status(err.statusCode || 500)
      .json({ message: err.message || 'Suggestion impossible.' });
  }
};
