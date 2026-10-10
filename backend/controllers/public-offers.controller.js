import mongoose from 'mongoose';
import { Offer } from '../models/offer.js';
import { Application } from '../models/application.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Offres visibles publiquement : publiées ET non expirées. */
function publicFilter() {
  return {
    status: 'published',
    $or: [{ deadline: null }, { deadline: { $gte: new Date() } }],
  };
}

function publicDto(o, applicationsCount = 0, applied = false) {
  const dl = o.deadline ? new Date(o.deadline).getTime() : null;
  const now = Date.now();
  return {
    id: o._id,
    name: o.name,
    partner: o.partner,
    companyLogo: o.companyLogo || '',
    country: o.country || { code: '', name: '' },
    city: o.city || '',
    workMode: o.workMode || 'onsite',
    contract: o.contract || '',
    salary: o.salary || '',
    sector: o.sector || '',
    urgent: !!o.urgent,
    openings: o.openings ?? 1,
    skills: o.skills || [],
    publishDate: o.publishDate || o.createdAt || null,
    deadline: o.deadline || null,
    daysLeft: dl === null ? null : Math.ceil((dl - now) / MS_PER_DAY),
    applicationsCount,
    applied,
    createdAt: o.createdAt,
  };
}

/**
 * GET /api/offer/public — offres publiées non expirées.
 * Urgentes d'abord puis publication récente. `applied` si token présent.
 */
export const listPublicOffers = async (req, res) => {
  try {
    const offers = await Offer.find(publicFilter()).lean();
    const ids = offers.map((o) => o._id);

    const [counts, mine] = await Promise.all([
      Application.aggregate([
        { $match: { offer: { $in: ids } } },
        { $group: { _id: '$offer', n: { $sum: 1 } } },
      ]),
      req.user
        ? Application.find({ appliedBy: req.user.id, offer: { $in: ids } })
            .select('offer')
            .lean()
        : Promise.resolve([]),
    ]);
    const countMap = new Map(counts.map((c) => [String(c._id), c.n]));
    const appliedSet = new Set(mine.map((a) => String(a.offer)));

    const list = offers
      .map((o) => publicDto(o, countMap.get(String(o._id)) || 0, appliedSet.has(String(o._id))))
      .sort((a, b) => {
        if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
        return new Date(b.publishDate || 0) - new Date(a.publishDate || 0);
      });

    res.json({ offers: list });
  } catch (error) {
    console.error('[public-offers/list]', error);
    res.status(500).json({ message: 'Impossible de charger les offres.' });
  }
};

/** GET /api/offer/public/:id — détail complet + compteurs. */
export const getPublicOffer = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: 'Offre introuvable.' });
    }
    const o = await Offer.findOne({ _id: req.params.id, ...publicFilter() }).lean();
    if (!o) return res.status(404).json({ message: 'Offre introuvable ou expirée.' });

    const [count, mine] = await Promise.all([
      Application.countDocuments({ offer: o._id }),
      req.user
        ? Application.findOne({ appliedBy: req.user.id, offer: o._id })
            .select('status')
            .lean()
        : Promise.resolve(null),
    ]);

    res.json({
      offer: { ...publicDto(o, count, !!mine), description: o.description || '', myStatus: mine?.status || '' },
    });
  } catch (error) {
    console.error('[public-offers/get]', error);
    res.status(500).json({ message: 'Impossible de charger l\u2019offre.' });
  }
};
