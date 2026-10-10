import mongoose from 'mongoose';
import { ClientCl } from '../../models/client-cl.model.js';

async function loadClDoc(userId, clId) {
  if (!mongoose.isValidObjectId(clId)) {
    return null;
  }
  return ClientCl.findOne({ _id: clId, user: userId });
}

function validName(raw) {
  const name = String(raw || '').trim();
  if (name.length < 2) {
    return { error: 'Nom de lettre requis (au moins 2 caractères).' };
  }
  if (name.length > 120) {
    return { error: 'Nom trop long (120 caractères max).' };
  }
  return { name };
}

function duplicateError(res, err) {
  if (err.code === 11000) {
    return res.status(409).json({ message: 'Une lettre avec ce nom existe déjà.' });
  }
  return null;
}

export async function listCls(req, res) {
  try {
    const cls = await ClientCl.find({ user: req.user.id }).sort({ updatedAt: -1 }).lean();
    return res.json({ cls });
  } catch (err) {
    console.error('[client/cl] listCls', err);
    return res.status(500).json({ message: err.message || 'Liste impossible.' });
  }
}

export async function createCl(req, res) {
  try {
    const { name, error } = validName(req.body?.name);
    if (error) {
      return res.status(400).json({ message: error });
    }
    const editorState =
      req.body?.editorState && typeof req.body.editorState === 'object' && !Array.isArray(req.body.editorState)
        ? req.body.editorState
        : {};
    const cl = await ClientCl.create({ user: req.user.id, name, editorState });
    return res.status(201).json({ cl: cl.toObject() });
  } catch (err) {
    const dup = duplicateError(res, err);
    if (dup) return dup;
    console.error('[client/cl] createCl', err);
    return res.status(500).json({ message: err.message || 'Création impossible.' });
  }
}

export async function getCl(req, res) {
  try {
    const cl = await loadClDoc(req.user.id, req.params.clId);
    if (!cl) {
      return res.status(404).json({ message: 'Lettre introuvable.' });
    }
    return res.json({ cl: cl.toObject() });
  } catch (err) {
    console.error('[client/cl] getCl', err);
    return res.status(500).json({ message: err.message || 'Lecture impossible.' });
  }
}

export async function patchCl(req, res) {
  try {
    const cl = await loadClDoc(req.user.id, req.params.clId);
    if (!cl) {
      return res.status(404).json({ message: 'Lettre introuvable.' });
    }
    const body = req.body || {};
    if (typeof body.name === 'string' && body.name.trim()) {
      const { name, error } = validName(body.name);
      if (error) {
        return res.status(400).json({ message: error });
      }
      cl.name = name;
    }
    if (body.editorState !== undefined && typeof body.editorState === 'object' && body.editorState !== null) {
      cl.editorState = body.editorState;
    }
    await cl.save();
    return res.json({ cl: cl.toObject() });
  } catch (err) {
    const dup = duplicateError(res, err);
    if (dup) return dup;
    console.error('[client/cl] patchCl', err);
    return res.status(500).json({ message: err.message || 'Mise à jour impossible.' });
  }
}

export async function deleteCl(req, res) {
  try {
    const cl = await loadClDoc(req.user.id, req.params.clId);
    if (!cl) {
      return res.status(404).json({ message: 'Lettre introuvable.' });
    }
    await ClientCl.deleteOne({ _id: cl._id });
    return res.status(204).send();
  } catch (err) {
    console.error('[client/cl] deleteCl', err);
    return res.status(500).json({ message: 'Suppression impossible.' });
  }
}
