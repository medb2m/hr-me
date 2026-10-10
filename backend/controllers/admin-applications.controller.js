import mongoose from 'mongoose';
import { Application } from '../models/application.js';
import { Offer } from '../models/offer.js';
import { ClientProfile } from '../models/client-profile.model.js';
import { ClientCv } from '../models/client-cv.model.js';
import { User } from '../models/user.model.js';

const STATUS_VALUES = new Set(['pending', 'review', 'accepted', 'rejected']);

function normStatus(s) {
  return s === 'applied' ? 'pending' : s;
}

function fileDto(f) {
  return {
    name: f.originalName || f.filename,
    path: f.path,
    mime: f.mime || '',
    size: f.size || 0,
  };
}

function appDto(a, profile = null, user = null) {
  return {
    id: a._id,
    status: normStatus(a.status),
    source: a.source || 'client',
    applicantName: a.applicantName || '',
    applicantEmail: a.applicantEmail || '',
    message: a.message || '',
    cv: a.cv ? fileDto(a.cv) : null,
    attachments: (a.attachments || []).map(fileDto),
    sharedProfile: !!a.sharedProfile,
    sharedCv: a.sharedCv?.id ? { id: a.sharedCv.id, name: a.sharedCv.name || '' } : null,
    sharedDocs: (a.sharedDocs || []).map((f) => ({ ...fileDto(f), kind: f.kind || 'other' })),
    adminNotes: a.adminNotes || '',
    createdAt: a.createdAt,
    user: user
      ? { id: user._id, email: user.email, role: user.role, name: user.name || '', avatarUrl: user.avatarUrl || '' }
      : null,
    profile,
  };
}

/** DTO offre embarqué dans une candidature (détail). */
function offerDto(o) {
  if (!o) return null;
  return {
    id: o._id,
    name: o.name,
    partner: o.partner,
    companyLogo: o.companyLogo || '',
    country: o.country || { code: '', name: '' },
    city: o.city || '',
    contract: o.contract || '',
    salary: o.salary || '',
    sector: o.sector || '',
    status: o.status,
    deadline: o.deadline || null,
    expired: !!o.deadline && new Date(o.deadline).getTime() < Date.now(),
  };
}

/**
 * GET /api/admin/offers/:id/applications?status=&source=
 * Candidatures d'une offre + infos postulant (User + ClientProfile).
 */
export const listOfferApplications = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: 'Offre introuvable.' });
    }
    const offer = await Offer.findById(req.params.id)
      .select('name partner companyLogo country city contract status deadline')
      .lean();
    if (!offer) return res.status(404).json({ message: 'Offre introuvable.' });

    const filter = { offer: offer._id };
    const status = String(req.query.status || '');
    const source = String(req.query.source || '');
    if (STATUS_VALUES.has(status)) filter.status = status;
    if (['candidate', 'client', 'agent'].includes(source)) filter.source = source;

    const apps = await Application.find(filter).sort({ createdAt: -1 }).lean();

    const userIds = apps.map((a) => a.appliedBy).filter(Boolean);
    const [users, profiles] = await Promise.all([
      User.find({ _id: { $in: userIds } }).select('email role name avatarUrl').lean(),
      ClientProfile.find({ user: { $in: userIds } })
        .select('user prenom nom phone city country nationality profilePhotoUrl headline')
        .lean(),
    ]);
    const userMap = new Map(users.map((u) => [String(u._id), u]));
    const profMap = new Map(profiles.map((p) => [String(p.user), p]));

    const counters = { total: 0, pending: 0, review: 0, accepted: 0, rejected: 0 };
    const allApps = await Application.find({ offer: offer._id }).select('status').lean();
    for (const a of allApps) {
      const s = normStatus(a.status);
      counters.total++;
      if (s in counters) counters[s]++;
    }

    res.json({
      offer: offerDto(offer),
      applications: apps.map((a) => {
        const u = a.appliedBy ? userMap.get(String(a.appliedBy)) : null;
        const p = a.appliedBy ? profMap.get(String(a.appliedBy)) : null;
        const profile = p
          ? {
              name: `${p.prenom || ''} ${p.nom || ''}`.trim(),
              phone: p.phone || '',
              city: p.city || '',
              country: p.country || '',
              nationality: p.nationality || '',
              photoUrl: p.profilePhotoUrl || '',
              headline: p.headline || '',
            }
          : null;
        return appDto(a, profile, u);
      }),
      counters,
    });
  } catch (error) {
    console.error('[admin-applications/list]', error);
    res.status(500).json({ message: 'Impossible de charger les candidatures.' });
  }
};

/** GET /api/admin/applications/:id — détail + profil du postulant. */
export const getApplication = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: 'Candidature introuvable.' });
    }
    const a = await Application.findById(req.params.id)
      .populate({
        path: 'offer',
        select:
          'name partner companyLogo country city workMode contract salary sector urgent deadline status description skills openings publishDate',
      })
      .lean();
    if (!a) return res.status(404).json({ message: 'Candidature introuvable.' });

    const [user, profile, sharedCvDoc] = await Promise.all([
      a.appliedBy
        ? User.findById(a.appliedBy).select('email role name avatarUrl createdAt').lean()
        : null,
      a.appliedBy ? ClientProfile.findOne({ user: a.appliedBy }).lean() : null,
      a.sharedCv?.id ? ClientCv.findById(a.sharedCv.id).lean() : null,
    ]);

    const prof = profile
      ? {
          name: `${profile.prenom || ''} ${profile.nom || ''}`.trim(),
          prenom: profile.prenom || '',
          nom: profile.nom || '',
          phone: profile.phone || '',
          phones: profile.phones || [],
          links: profile.links || [],
          city: profile.city || '',
          country: profile.country || '',
          nationality: profile.nationality || '',
          birthDate: profile.birthDate || null,
          photoUrl: profile.profilePhotoUrl || '',
          headline: profile.headline || '',
          skills: profile.skills || [],
          digitalSkills: profile.digitalSkills || [],
          languagesSpoken: profile.languagesSpoken || [],
          workExperiences: (profile.workExperiences || []).slice(0, 10),
          educations: (profile.educations || []).slice(0, 10),
        }
      : null;

    res.json({
      application: {
        ...appDto(a, prof, user),
        offer: offerDto(a.offer),
        // Document CV partagé complet (editorState) — pour l'aperçu « feuille CV » admin.
        sharedCvDoc: sharedCvDoc
          ? {
              _id: sharedCvDoc._id,
              name: sharedCvDoc.name || '',
              editorState: sharedCvDoc.editorState || {},
              photoSource: sharedCvDoc.photoSource || 'profile',
              customPhotoUrl: sharedCvDoc.customPhotoUrl || '',
            }
          : null,
      },
    });
  } catch (error) {
    console.error('[admin-applications/get]', error);
    res.status(500).json({ message: 'Impossible de charger la candidature.' });
  }
};

/** PUT /api/admin/applications/:id — { status?, adminNotes? }. */
export const updateApplication = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: 'Candidature introuvable.' });
    }
    const update = {};
    const status = String(req.body?.status || '');
    if (status) {
      if (!STATUS_VALUES.has(status)) {
        return res.status(400).json({ message: 'Statut invalide.' });
      }
      update.status = status;
    }
    if (req.body?.adminNotes !== undefined) {
      update.adminNotes = String(req.body.adminNotes).slice(0, 3000);
    }
    const a = await Application.findByIdAndUpdate(req.params.id, update, { new: true }).lean();
    if (!a) return res.status(404).json({ message: 'Candidature introuvable.' });
    res.json({ application: appDto(a) });
  } catch (error) {
    console.error('[admin-applications/update]', error);
    res.status(500).json({ message: 'Mise à jour impossible.' });
  }
};
