import mongoose from 'mongoose';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ClientDocument } from '../../models/client-document.model.js';
import { uploadsPublicPath } from '../../helpers/upload-basics.js';
import { safeUnlinkUpload } from '../../helpers/upload-fs.js';
import {
  analyzeDocumentBuffer,
  analyzeDocumentText,
} from '../../services/gemini.service.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_ROOT = join(__dirname, '../../public');

const DOC_PREFIX = '/uploads/client-documents/';
const KINDS = new Set(['diploma', 'certificate', 'other']);
const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const GEMINI_MIMES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

function dto(d) {
  return {
    id: d._id,
    kind: d.kind,
    name: d.originalName || d.filename,
    path: d.path,
    mime: d.mime || '',
    size: d.size || 0,
    description: d.description || '',
    aiStatus: d.aiStatus || 'none',
    ai: {
      title: d.aiTitle || '',
      docType: d.aiDocType || '',
      issuer: d.aiIssuer || '',
      holder: d.aiHolder || '',
      issueDate: d.aiIssueDate || '',
      expiryDate: d.aiExpiryDate || '',
      summary: d.aiSummary || '',
      keywords: d.aiKeywords || [],
      error: d.aiError || '',
    },
    createdAt: d.createdAt,
  };
}

function fileSystemPath(doc) {
  const rel = String(doc.path || '').replace(/^\/+/, '');
  return join(PUBLIC_ROOT, rel);
}

/** Texte brut approximatif depuis un binaire .doc/.odt (secours, sans lib). */
function roughTextFromBuffer(buf) {
  const latin = buf.toString('latin1');
  const runs = latin.match(/[\x20-\x7EÀ-ž]{5,}/g) || [];
  return runs.join(' ').replace(/\s+/g, ' ').slice(0, 12000);
}

async function extractDocxText(buf) {
  try {
    const mammoth = await import('mammoth');
    const { value } = await mammoth.extractRawText({ buffer: buf });
    return String(value || '').slice(0, 12000);
  } catch {
    return '';
  }
}

/**
 * Analyse IA en arrière-plan — le doc est créé tout de suite avec
 * `aiStatus: 'analyzing'` puis enrichi quand Gemini répond.
 */
async function analyzeInBackground(docId) {
  const doc = await ClientDocument.findById(docId);
  if (!doc) {
    return;
  }
  try {
    const buf = await readFile(fileSystemPath(doc));
    let result = null;
    if (GEMINI_MIMES.has(doc.mime)) {
      // PDF + images → Gemini natif (lit aussi les scans).
      result = await analyzeDocumentBuffer(buf, doc.mime);
    } else {
      // DOCX/ODT/DOC → texte extrait puis analysé.
      const text =
        doc.mime ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          ? await extractDocxText(buf)
          : roughTextFromBuffer(buf);
      if (text.trim().length > 30) {
        result = await analyzeDocumentText(text);
      }
    }

    if (result) {
      const patch = {
        aiStatus: 'done',
        aiTitle: result.title || '',
        aiDocType: result.docType || 'other',
        aiIssuer: result.issuer || '',
        aiHolder: result.holder || '',
        aiIssueDate: result.issueDate || '',
        aiExpiryDate: result.expiryDate || '',
        aiSummary: result.summary || '',
        aiKeywords: result.keywords || [],
        aiError: '',
      };
      // Si le nom vient du nom de fichier, l'IA propose un meilleur titre.
      if (!doc.originalName || doc.originalName === doc.filename) {
        patch.originalName = result.title || doc.originalName;
      }
      // Kind suggéré par l'IA quand l'utilisateur n'a pas choisi de type.
      if (doc.kind === 'other' && ['diploma', 'certificate'].includes(result.docType)) {
        patch.kind = result.docType;
      }
      if (!doc.description && result.summary) {
        patch.description = result.summary;
      }
      await ClientDocument.updateOne({ _id: docId }, { $set: patch });
    } else {
      await ClientDocument.updateOne(
        { _id: docId },
        { $set: { aiStatus: 'failed', aiError: 'Contenu illisible par l’IA.' } },
      );
    }
  } catch (err) {
    console.error('[client/docs] analyse IA', err);
    await ClientDocument.updateOne(
      { _id: docId },
      {
        $set: {
          aiStatus: 'failed',
          aiError: err.statusCode === 503 ? 'Service IA non configuré.' : 'Analyse indisponible.',
        },
      },
    ).catch(() => {});
  }
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
      aiStatus: 'analyzing',
    });
    // Analyse IA en arrière-plan — le client poll la liste pour le résultat.
    analyzeInBackground(doc._id);
    return res.status(201).json({ document: dto(doc.toObject()) });
  } catch (err) {
    console.error('[client/docs] upload', err);
    return res.status(500).json({ message: 'Upload impossible.' });
  }
}

/** PATCH /api/client/documents/:id — name/kind/description éditables. */
export async function patchDocument(req, res) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: 'Document introuvable.' });
    }
    const patch = {};
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'name')) {
      patch.originalName = String(req.body.name || '').trim().slice(0, 200);
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'kind')) {
      if (!KINDS.has(req.body.kind)) {
        return res.status(400).json({ message: 'Type de document invalide.' });
      }
      patch.kind = req.body.kind;
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'description')) {
      patch.description = String(req.body.description || '').trim().slice(0, 600);
    }
    if (!Object.keys(patch).length) {
      return res.status(400).json({ message: 'Aucun champ modifiable.' });
    }
    const doc = await ClientDocument.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { $set: patch },
      { new: true },
    );
    if (!doc) {
      return res.status(404).json({ message: 'Document introuvable.' });
    }
    return res.json({ document: dto(doc.toObject()) });
  } catch (err) {
    console.error('[client/docs] patch', err);
    return res.status(500).json({ message: 'Mise à jour impossible.' });
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
