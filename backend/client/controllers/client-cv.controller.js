import mongoose from 'mongoose';
import { ClientCv } from '../../models/client-cv.model.js';
import { uploadsPublicPath } from '../../helpers/upload-basics.js';
import { safeUnlinkUpload } from '../../helpers/upload-fs.js';

const CV_PHOTO_PREFIX = '/uploads/client-cv-photos/';

async function loadCvDoc(userId, cvId) {
  if (!mongoose.isValidObjectId(cvId)) {
    return null;
  }
  return ClientCv.findOne({ _id: cvId, user: userId });
}

/** Supprime le fichier seulement si aucun autre CV du compte ne le partage (CV dupliqués). */
async function unlinkIfUnshared(userId, excludeCvId, url) {
  if (!url || !url.startsWith(CV_PHOTO_PREFIX)) {
    return;
  }
  const shared = await ClientCv.exists({
    _id: { $ne: excludeCvId },
    user: userId,
    customPhotoUrl: url,
  });
  if (!shared) {
    await safeUnlinkUpload(url, { onlyPrefix: CV_PHOTO_PREFIX });
  }
}

export async function listCvs(req, res) {
  try {
    const cvs = await ClientCv.find({ user: req.user.id }).sort({ updatedAt: -1 }).lean();
    return res.json({ cvs });
  } catch (err) {
    console.error('[client/cv] listCvs', err);
    return res.status(500).json({ message: err.message || 'Liste impossible.' });
  }
}

export async function createCv(req, res) {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name || name.length < 2) {
      return res.status(400).json({ message: 'Nom de CV requis (au moins 2 caractères).' });
    }
    if (name.length > 120) {
      return res.status(400).json({ message: 'Nom trop long (120 caractères max).' });
    }
    const editorState =
      req.body?.editorState && typeof req.body.editorState === 'object' && !Array.isArray(req.body.editorState)
        ? req.body.editorState
        : {};
    const cv = await ClientCv.create({
      user: req.user.id,
      name,
      editorState,
    });
    return res.status(201).json({ cv: cv.toObject() });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Un CV avec ce nom existe déjà.' });
    }
    console.error('[client/cv] createCv', err);
    return res.status(500).json({ message: err.message || 'Création impossible.' });
  }
}

export async function getCv(req, res) {
  try {
    const cv = await loadCvDoc(req.user.id, req.params.cvId);
    if (!cv) {
      return res.status(404).json({ message: 'CV introuvable.' });
    }
    return res.json({ cv: cv.toObject() });
  } catch (err) {
    console.error('[client/cv] getCv', err);
    return res.status(500).json({ message: err.message || 'Lecture impossible.' });
  }
}

export async function patchCv(req, res) {
  try {
    const cv = await loadCvDoc(req.user.id, req.params.cvId);
    if (!cv) {
      return res.status(404).json({ message: 'CV introuvable.' });
    }
    const body = req.body || {};
    if (typeof body.name === 'string' && body.name.trim()) {
      const n = body.name.trim();
      if (n.length > 120) {
        return res.status(400).json({ message: 'Nom trop long.' });
      }
      cv.name = n;
    }
    if (body.editorState !== undefined && typeof body.editorState === 'object' && body.editorState !== null) {
      cv.editorState = body.editorState;
    }
    if (body.photoSource === 'profile' || body.photoSource === 'custom') {
      cv.photoSource = body.photoSource;
    }
    if (typeof body.customPhotoUrl === 'string') {
      cv.customPhotoUrl = body.customPhotoUrl.trim();
    }
    await cv.save();
    return res.json({ cv: cv.toObject() });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Un CV avec ce nom existe déjà.' });
    }
    console.error('[client/cv] patchCv', err);
    return res.status(500).json({ message: err.message || 'Mise à jour impossible.' });
  }
}

export async function deleteCv(req, res) {
  try {
    const cv = await loadCvDoc(req.user.id, req.params.cvId);
    if (!cv) {
      return res.status(404).json({ message: 'CV introuvable.' });
    }
    await unlinkIfUnshared(req.user.id, cv._id, cv.customPhotoUrl);
    await ClientCv.deleteOne({ _id: cv._id });
    return res.status(204).send();
  } catch (err) {
    console.error('[client/cv] deleteCv', err);
    return res.status(500).json({ message: err.message || 'Suppression impossible.' });
  }
}

export async function uploadCvPhoto(req, res) {
  try {
    const cv = await loadCvDoc(req.user.id, req.params.cvId);
    if (!cv) {
      return res.status(404).json({ message: 'CV introuvable.' });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'Envoyez une image dans le champ « photo ».' });
    }
    const old = cv.customPhotoUrl;
    const publicPath = uploadsPublicPath('client-cv-photos', req.file.filename);
    await unlinkIfUnshared(req.user.id, cv._id, old);
    cv.customPhotoUrl = publicPath;
    cv.photoSource = 'custom';
    await cv.save();
    return res.json({ customPhotoUrl: publicPath, cv: cv.toObject() });
  } catch (err) {
    console.error('[client/cv] uploadCvPhoto', err);
    return res.status(500).json({ message: err.message || 'Upload impossible.' });
  }
}
