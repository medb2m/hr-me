import mongoose from 'mongoose';
import { ClientProfile, ensureClientProfileForUser } from '../../models/client-profile.model.js';
import { uploadsPublicPath } from '../../helpers/upload-basics.js';
import { safeUnlinkUpload } from '../../helpers/upload-fs.js';

const CLIENT_UPLOAD_PREFIX = '/uploads/client-profiles/';

function isClientProfileUploadUrl(url) {
  const u = String(url || '').trim();
  return u.startsWith(CLIENT_UPLOAD_PREFIX);
}

function historyHasUrl(profile, url) {
  const u = String(url || '').trim();
  return profile.profilePhotoHistory.some((h) => h.url === u);
}

function pushPhotoHistory(profile, url) {
  const u = String(url || '').trim();
  if (!isClientProfileUploadUrl(u) || historyHasUrl(profile, u)) {
    return;
  }
  profile.profilePhotoHistory.push({ url: u, uploadedAt: new Date() });
}

/**
 * GET /api/client/profile — fiche `ClientProfile` du compte connecté.
 */
export async function getProfile(req, res) {
  try {
    const profile = await ensureClientProfileForUser(req.user.id);
    return res.json({ profile: profile.toObject() });
  } catch (err) {
    console.error('[client/profile] getProfile', err);
    return res.status(500).json({ message: err.message || 'Impossible de charger le profil.' });
  }
}

/**
 * PATCH ou PUT /api/client/profile — mise à jour partielle.
 * `birthDate` : chaîne `YYYY-MM-DD` ou `null` / `""` pour effacer.
 * `phones` : tableau de chaînes (max 6, 40 car. chacun).
 * `links` : tableau { label, url } (max 10 ; url normalisée en https).
 */
export async function patchProfile(req, res) {
  try {
    const body = req.body || {};
    const hasBirth = Object.prototype.hasOwnProperty.call(body, 'birthDate');
    const hasPhones = Object.prototype.hasOwnProperty.call(body, 'phones');
    const hasLinks = Object.prototype.hasOwnProperty.call(body, 'links');
    const hasHeadline = Object.prototype.hasOwnProperty.call(body, 'headline');
    const hasWork = Object.prototype.hasOwnProperty.call(body, 'workExperiences');
    const hasEdu = Object.prototype.hasOwnProperty.call(body, 'educations');
    const hasSkills = Object.prototype.hasOwnProperty.call(body, 'skills');
    const hasDigital = Object.prototype.hasOwnProperty.call(body, 'digitalSkills');
    const hasLangs = Object.prototype.hasOwnProperty.call(body, 'languagesSpoken');
    if (
      !hasBirth && !hasPhones && !hasLinks && !hasHeadline &&
      !hasWork && !hasEdu && !hasSkills && !hasDigital && !hasLangs
    ) {
      return res.status(400).json({
        message: 'Aucun champ modifiable dans le corps de la requête.',
      });
    }

    const profile = await ensureClientProfileForUser(req.user.id);

    if (hasBirth) {
      const raw = body.birthDate;
      if (raw === null || raw === '') {
        profile.birthDate = null;
      } else if (typeof raw === 'string') {
        const m = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!m) {
          return res.status(400).json({ message: 'Date de naissance invalide (attendu : YYYY-MM-DD).' });
        }
        const y = parseInt(m[1], 10);
        const mo = parseInt(m[2], 10);
        const d = parseInt(m[3], 10);
        const dt = new Date(Date.UTC(y, mo - 1, d));
        if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) {
          return res.status(400).json({ message: 'Date de naissance invalide.' });
        }
        profile.birthDate = dt;
      } else {
        return res.status(400).json({ message: 'birthDate invalide.' });
      }
    }

    if (hasPhones) {
      if (!Array.isArray(body.phones)) {
        return res.status(400).json({ message: '« phones » doit être un tableau de numéros.' });
      }
      if (body.phones.length > 6) {
        return res.status(400).json({ message: 'Maximum 6 numéros de téléphone.' });
      }
      const phones = [];
      for (const p of body.phones) {
        const v = String(p ?? '').trim();
        if (!v) continue;
        if (v.length > 40) {
          return res.status(400).json({ message: 'Numéro trop long (40 caractères max).' });
        }
        phones.push(v);
      }
      profile.phones = phones;
    }

    if (hasLinks) {
      if (!Array.isArray(body.links)) {
        return res.status(400).json({ message: '« links » doit être un tableau { label, url }.' });
      }
      if (body.links.length > 10) {
        return res.status(400).json({ message: 'Maximum 10 liens.' });
      }
      const links = [];
      for (const l of body.links) {
        if (!l || typeof l !== 'object') continue;
        const label = String(l.label ?? '').trim().slice(0, 40);
        let url = String(l.url ?? '').trim();
        if (!url) continue;
        if (url.length > 300) {
          return res.status(400).json({ message: 'URL trop longue (300 caractères max).' });
        }
        if (!/^https?:\/\//i.test(url)) {
          url = `https://${url}`;
        }
        if (!/^https?:\/\/[^\s]+\.[^\s]{2,}/i.test(url)) {
          return res.status(400).json({ message: `URL invalide : ${label || url}` });
        }
        links.push({ label: label || 'Lien', url });
      }
      profile.links = links;
    }

    if (hasHeadline) {
      const v = String(body.headline ?? '').trim();
      if (v.length > 2000) {
        return res.status(400).json({ message: 'Accroche trop longue (2000 caractères max).' });
      }
      profile.headline = v;
    }

    const parseDateOrNull = (v) => {
      const s = String(v ?? '').trim();
      if (!s) return null;
      const dt = new Date(s.length === 7 ? `${s}-15` : s);
      return Number.isNaN(dt.getTime()) ? null : dt;
    };

    if (hasWork) {
      if (!Array.isArray(body.workExperiences) || body.workExperiences.length > 20) {
        return res.status(400).json({ message: '« workExperiences » : tableau de 20 entrées max.' });
      }
      profile.workExperiences = body.workExperiences
        .filter((w) => w && typeof w === 'object')
        .map((w) => ({
          jobTitle: String(w.jobTitle ?? '').trim().slice(0, 120),
          employer: String(w.employer ?? '').trim().slice(0, 120),
          startDate: parseDateOrNull(w.startDate),
          endDate: w.current ? null : parseDateOrNull(w.endDate),
          current: !!w.current,
          description: String(w.description ?? '').trim().slice(0, 3000),
        }))
        .filter((w) => w.jobTitle || w.employer || w.description);
    }

    if (hasEdu) {
      if (!Array.isArray(body.educations) || body.educations.length > 20) {
        return res.status(400).json({ message: '« educations » : tableau de 20 entrées max.' });
      }
      profile.educations = body.educations
        .filter((e) => e && typeof e === 'object')
        .map((e) => ({
          title: String(e.title ?? '').trim().slice(0, 120),
          organization: String(e.organization ?? '').trim().slice(0, 120),
          startDate: parseDateOrNull(e.startDate),
          endDate: e.current ? null : parseDateOrNull(e.endDate),
          current: !!e.current,
        }))
        .filter((e) => e.title || e.organization);
    }

    if (hasSkills) {
      if (!Array.isArray(body.skills) || body.skills.length > 40) {
        return res.status(400).json({ message: '« skills » : 40 compétences max.' });
      }
      profile.skills = body.skills.map((s) => String(s ?? '').trim().slice(0, 60)).filter(Boolean);
    }

    if (hasDigital) {
      if (!Array.isArray(body.digitalSkills) || body.digitalSkills.length > 40) {
        return res.status(400).json({ message: '« digitalSkills » : 40 entrées max.' });
      }
      profile.digitalSkills = body.digitalSkills
        .map((s) => String(s ?? '').trim().slice(0, 60))
        .filter(Boolean);
    }

    if (hasLangs) {
      if (!Array.isArray(body.languagesSpoken) || body.languagesSpoken.length > 15) {
        return res.status(400).json({ message: '« languagesSpoken » : 15 langues max.' });
      }
      profile.languagesSpoken = body.languagesSpoken
        .filter((l) => l && typeof l === 'object')
        .map((l) => ({
          language: String(l.language ?? '').trim().slice(0, 60),
          cefrLevel: String(l.cefrLevel ?? '').trim().slice(0, 10),
        }))
        .filter((l) => l.language);
    }

    await profile.save();
    return res.json({ profile: profile.toObject() });
  } catch (err) {
    console.error('[client/profile] patchProfile', err);
    return res.status(500).json({ message: err.message || 'Mise à jour impossible.' });
  }
}

/**
 * POST /api/client/profile/photo — multipart champ `photo` ; met à jour `profilePhotoUrl`.
 */
export async function uploadProfilePhoto(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: 'Envoyez une image dans le champ « photo » (JPEG, PNG ou WebP).',
      });
    }

    const profile = await ensureClientProfileForUser(req.user.id);
    const oldUrl = String(profile.profilePhotoUrl || '').trim();

    const publicPath = uploadsPublicPath('client-profiles', req.file.filename);
    /** Conserver l’ancienne image sur disque pour l’historique (suppression explicite côté utilisateur). */
    if (oldUrl && isClientProfileUploadUrl(oldUrl) && oldUrl !== publicPath) {
      pushPhotoHistory(profile, oldUrl);
    }

    profile.profilePhotoUrl = publicPath;
    await profile.save();

    return res.json({
      profilePhotoUrl: publicPath,
      profile: profile.toObject(),
    });
  } catch (err) {
    console.error('[client/profile] uploadProfilePhoto', err);
    return res.status(500).json({ message: err.message || 'Upload impossible.' });
  }
}

/**
 * DELETE /api/client/profile/photo — retire l’URL et supprime le fichier local s’il est sous notre préfixe.
 */
export async function deleteProfilePhoto(req, res) {
  try {
    const profile = await ensureClientProfileForUser(req.user.id);
    const oldUrl = String(profile.profilePhotoUrl || '').trim();
    profile.profilePhotoUrl = '';
    profile.profilePhotoHistory = profile.profilePhotoHistory.filter((h) => h.url !== oldUrl);
    await profile.save();
    await safeUnlinkUpload(oldUrl, { onlyPrefix: CLIENT_UPLOAD_PREFIX });
    return res.json({ profile: profile.toObject() });
  } catch (err) {
    console.error('[client/profile] deleteProfilePhoto', err);
    return res.status(500).json({ message: err.message || 'Suppression impossible.' });
  }
}

/**
 * DELETE /api/client/profile/photo/history/:historyId — supprime une entrée d’historique et le fichier associé.
 */
export async function deleteProfilePhotoHistoryEntry(req, res) {
  try {
    const historyId = req.params.historyId;
    if (!mongoose.isValidObjectId(historyId)) {
      return res.status(400).json({ message: 'Identifiant d’historique invalide.' });
    }
    const profile = await ensureClientProfileForUser(req.user.id);
    const entry = profile.profilePhotoHistory.id(historyId);
    if (!entry) {
      return res.status(404).json({ message: 'Entrée introuvable.' });
    }
    const url = String(entry.url || '').trim();
    if (url === String(profile.profilePhotoUrl || '').trim()) {
      return res.status(400).json({
        message: 'Cette image est la photo de profil active — supprimez-la via « Supprimer (serveur) ».',
      });
    }
    await entry.deleteOne();
    await profile.save();
    await safeUnlinkUpload(url, { onlyPrefix: CLIENT_UPLOAD_PREFIX });
    return res.json({ profile: profile.toObject() });
  } catch (err) {
    console.error('[client/profile] deleteProfilePhotoHistoryEntry', err);
    return res.status(500).json({ message: err.message || 'Suppression impossible.' });
  }
}

/**
 * PATCH /api/client/profile/photo/active — body `{ historyId }` : promouvoir une photo de l’historique en photo active (sans nouvel upload).
 */
export async function activateProfilePhotoFromHistory(req, res) {
  try {
    const historyId = req.body?.historyId;
    if (!mongoose.isValidObjectId(historyId)) {
      return res.status(400).json({ message: 'Identifiant d’historique invalide.' });
    }
    const profile = await ensureClientProfileForUser(req.user.id);
    const entry = profile.profilePhotoHistory.id(historyId);
    if (!entry) {
      return res.status(404).json({ message: 'Entrée introuvable.' });
    }
    const targetUrl = String(entry.url || '').trim();
    if (!isClientProfileUploadUrl(targetUrl)) {
      return res.status(400).json({ message: 'URL d’image invalide.' });
    }
    const current = String(profile.profilePhotoUrl || '').trim();
    if (current && isClientProfileUploadUrl(current) && current !== targetUrl) {
      pushPhotoHistory(profile, current);
    }
    await entry.deleteOne();
    profile.profilePhotoUrl = targetUrl;
    await profile.save();
    return res.json({ profile: profile.toObject() });
  } catch (err) {
    console.error('[client/profile] activateProfilePhotoFromHistory', err);
    return res.status(500).json({ message: err.message || 'Mise à jour impossible.' });
  }
}
