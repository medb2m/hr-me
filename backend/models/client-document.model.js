import mongoose from 'mongoose';

/**
 * Document téléversé par le candidat dans sa bibliothèque
 * (diplôme, certification, attestation…) — partageable lors d'une candidature.
 */
const clientDocumentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    kind: {
      type: String,
      enum: ['diploma', 'certificate', 'other'],
      default: 'other',
    },
    filename: { type: String, required: true },       // nom de stockage
    path: { type: String, required: true },           // /uploads/client-documents/…
    originalName: { type: String, default: '' },      // nom affiché
    mime: { type: String, default: '' },
    size: { type: Number, default: 0 },
    /** Description éditable — pré-remplie par l'analyse IA. */
    description: { type: String, default: '' },
    /** Analyse IA (Gemini) — extraction automatique à l'upload. */
    aiStatus: {
      type: String,
      enum: ['none', 'analyzing', 'done', 'failed'],
      default: 'none',
    },
    aiTitle: { type: String, default: '' },           // titre détecté
    aiDocType: { type: String, default: '' },         // diploma | certificate | attestation | id | cv | contract | other
    aiIssuer: { type: String, default: '' },          // organisme émetteur
    aiHolder: { type: String, default: '' },          // titulaire
    aiIssueDate: { type: String, default: '' },       // YYYY-MM-DD
    aiExpiryDate: { type: String, default: '' },      // YYYY-MM-DD
    aiSummary: { type: String, default: '' },         // résumé 1-2 phrases
    aiKeywords: { type: [String], default: [] },      // mots-clés métier
    aiError: { type: String, default: '' },           // raison de l'échec
  },
  { timestamps: true }
);

export const ClientDocument =
  mongoose.models.ClientDocument || mongoose.model('ClientDocument', clientDocumentSchema);
