import mongoose from 'mongoose';
import { Offer } from '../models/offer.js';
import { Application } from '../models/application.js';
import { ClientCv } from '../models/client-cv.model.js';
import { ClientCl } from '../models/client-cl.model.js';
import { ClientDocument } from '../models/client-document.model.js';
import { uploadsPublicPath } from '../helpers/upload-basics.js';

const ROLE_TO_SOURCE = {
  candidate: 'candidate',
  client: 'client',
  agent: 'agent',
  recruiter: 'agent',
  admin: 'agent',
  director: 'agent',
};

function fileDto(file) {
  return {
    filename: file.filename,
    path: uploadsPublicPath('applications', file.filename),
    originalName: file.originalname || file.filename,
    mime: file.mimetype,
    size: file.size,
  };
}

/**
 * POST /api/applications — postuler (JWT requis, tout rôle connecté).
 * Multipart : offerId, name, email?, message ; fichiers `cv` (1) + `attachments` (≤5).
 */
export const apply = async (req, res) => {
  try {
    const offerId = String(req.body?.offerId || '');
    if (!mongoose.isValidObjectId(offerId)) {
      return res.status(400).json({ message: 'Offre invalide.' });
    }
    const offer = await Offer.findById(offerId);
    if (!offer) return res.status(404).json({ message: 'Offre introuvable.' });
    if (offer.status !== 'published') {
      return res.status(400).json({ message: 'Cette offre n\u2019est plus ouverte.' });
    }
    if (offer.deadline && new Date(offer.deadline).getTime() < Date.now()) {
      return res.status(400).json({ message: 'La date limite de cette offre est dépassée.' });
    }

    const already = await Application.findOne({ appliedBy: req.user.id, offer: offerId });
    if (already) {
      return res.status(409).json({ message: 'Tu as déjà postulé à cette offre.' });
    }

    const name = String(req.body?.name || '').trim().slice(0, 120);
    if (!name) {
      return res.status(400).json({ message: 'Le nom complet est requis.' });
    }
    const message = String(req.body?.message || '').trim().slice(0, 5000);

    const files = req.files || {};
    const cvArr = files.cv || [];
    const attArr = (files.attachments || []).slice(0, 5);

    // « Partager mon profil » : CV de l'espace + documents de la bibliothèque.
    const shareProfile = ['1', 'true', 'yes'].includes(String(req.body?.shareProfile || ''));
    const sharedCvId = String(req.body?.sharedCvId || '');
    let sharedCv = { id: null, name: '' };
    if (mongoose.isValidObjectId(sharedCvId)) {
      const cvDoc = await ClientCv.findOne({ _id: sharedCvId, user: req.user.id })
        .select('name')
        .lean();
      if (cvDoc) sharedCv = { id: cvDoc._id, name: cvDoc.name };
    }

    // Motivation : message libre OU lettre complète de l'espace.
    const letterMode = req.body?.letterMode === 'letter' ? 'letter' : 'message';
    const sharedClId = String(req.body?.sharedClId || '');
    let sharedCl = { id: null, name: '' };
    if (letterMode === 'letter' && mongoose.isValidObjectId(sharedClId)) {
      const clDoc = await ClientCl.findOne({ _id: sharedClId, user: req.user.id })
        .select('name')
        .lean();
      if (clDoc) sharedCl = { id: clDoc._id, name: clDoc.name };
    }

    let sharedDocIds = req.body?.sharedDocIds;
    if (typeof sharedDocIds === 'string') {
      // multipart : un seul champ = string ; JSON possible aussi
      try {
        const parsed = JSON.parse(sharedDocIds);
        sharedDocIds = Array.isArray(parsed) ? parsed : [sharedDocIds];
      } catch {
        sharedDocIds = [sharedDocIds];
      }
    }
    sharedDocIds = (Array.isArray(sharedDocIds) ? sharedDocIds : [])
      .filter((id) => mongoose.isValidObjectId(id))
      .slice(0, 10);

    let sharedDocs = [];
    if (sharedDocIds.length) {
      const docs = await ClientDocument.find({
        _id: { $in: sharedDocIds },
        user: req.user.id,
      }).lean();
      sharedDocs = docs.map((d) => ({
        filename: d.filename,
        path: d.path,
        originalName: d.originalName || d.filename,
        mime: d.mime || '',
        size: d.size || 0,
        kind: d.kind || 'other',
      }));
    }

    const application = new Application({
      offer: offerId,
      appliedBy: req.user.id,
      applicantName: name,
      applicantEmail: String(req.body?.email || req.user.email).trim().slice(0, 200),
      source: ROLE_TO_SOURCE[req.user.role] || 'client',
      status: 'pending',
      message,
      cv: cvArr[0] ? fileDto(cvArr[0]) : null,
      attachments: attArr.map(fileDto),
      sharedProfile: shareProfile || !!sharedCv.id || !!sharedCl.id || sharedDocs.length > 0,
      sharedCv,
      letterMode,
      sharedCl,
      sharedDocs,
    });
    await application.save();

    offer.applications.push(application._id);
    await offer.save();

    res.status(201).json({
      application: {
        id: application._id,
        status: application.status,
        createdAt: application.createdAt,
      },
    });
  } catch (error) {
    console.error('[applications/apply]', error);
    res.status(500).json({ message: 'Envoi de la candidature impossible.' });
  }
};

/** GET /api/applications/mine — mes candidatures (JWT). */
export const myApplications = async (req, res) => {
  try {
    const apps = await Application.find({ appliedBy: req.user.id })
      .populate({
        path: 'offer',
        select:
          'name partner companyLogo country city workMode contract salary sector urgent deadline status',
      })
      .sort({ createdAt: -1 })
      .lean();
    res.json({
      applications: apps.map((a) => ({
        id: a._id,
        status: a.status === 'applied' ? 'pending' : a.status,
        message: a.message || '',
        hasCv: !!a.cv,
        attachmentsCount: (a.attachments || []).length,
        sharedProfile: !!a.sharedProfile,
        sharedCvName: a.sharedCv?.name || '',
        letterMode: a.letterMode === 'letter' ? 'letter' : 'message',
        sharedClName: a.sharedCl?.name || '',
        sharedDocsCount: (a.sharedDocs || []).length,
        createdAt: a.createdAt,
        offer: a.offer
          ? {
              id: a.offer._id,
              name: a.offer.name,
              partner: a.offer.partner,
              companyLogo: a.offer.companyLogo || '',
              country: a.offer.country || { code: '', name: '' },
              city: a.offer.city || '',
              workMode: a.offer.workMode || 'onsite',
              contract: a.offer.contract || '',
              salary: a.offer.salary || '',
              sector: a.offer.sector || '',
              deadline: a.offer.deadline || null,
              offerStatus: a.offer.status,
              expired:
                !!a.offer.deadline && new Date(a.offer.deadline).getTime() < Date.now(),
            }
          : null,
      })),
    });
  } catch (error) {
    console.error('[applications/mine]', error);
    res.status(500).json({ message: 'Impossible de charger tes candidatures.' });
  }
};
