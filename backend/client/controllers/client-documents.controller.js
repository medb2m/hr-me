import mongoose from 'mongoose';
import { ClientDocument } from '../../models/client-document.model.js';
import { uploadsPublicPath } from '../../helpers/upload-basics.js';
import { safeUnlinkUpload } from '../../helpers/upload-fs.js';

const DOC_PREFIX = '/uploads/client-documents/';
const KINDS = new Set(['diploma', 'certificate', 'other']);

function dto(d) {
  return {
    id: d._id,
    kind: d.kind,
    name: d.originalName || d.filename,
    path: d.path,
    mime: d.mime || '',
    size: d.size || 0,
    createdAt: d.createdAt,
  };
}

/** GET /api/client/documents — bibliothèque du candidat. */
export async function listDocuments(req, res) {
  try {
    const docs = await ClientDocument.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .lean();
    return res.json({ documents: docs.map(dto) });
  } catch (err) {
    console.error('[client/docs] list', err);
    return res.status(500).json({ message: 'Liste impossible.' });
  }
}

/** POST /api/client/documents — multipart `document` + `kind` + `name`? */
export async function uploadDocument(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Envoyez un fichier dans le champ « document ».' });
    }
    const kind = KINDS.has(req.body?.kind) ? req.body.kind : 'other';
    const name = String(req.body?.name || req.file.originalname || '').trim().slice(0, 200);
    const doc = await ClientDocument.create({
      user: req.user.id,
      kind,
      filename: req.file.filename,
      path: uploadsPublicPath('client-documents', req.file.filename),
      originalName: name || req.file.originalname,
      mime: req.file.mimetype,
      size: req.file.size,
    });
    return res.status(201).json({ document: dto(doc.toObject()) });
  } catch (err) {
    console.error('[client/docs] upload', err);
    return res.status(500).json({ message: 'Upload impossible.' });
  }
}

/** DELETE /api/client/documents/:id */
export async function deleteDocument(req, res) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: 'Document introuvable.' });
    }
    const doc = await ClientDocument.findOne({ _id: req.params.id, user: req.user.id });
    if (!doc) {
      return res.status(404).json({ message: 'Document introuvable.' });
    }
    await safeUnlinkUpload(doc.path, { onlyPrefix: DOC_PREFIX });
    await ClientDocument.deleteOne({ _id: doc._id });
    return res.status(204).send();
  } catch (err) {
    console.error('[client/docs] delete', err);
    return res.status(500).json({ message: 'Suppression impossible.' });
  }
}
