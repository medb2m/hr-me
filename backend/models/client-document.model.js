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
  },
  { timestamps: true }
);

export const ClientDocument =
  mongoose.models.ClientDocument || mongoose.model('ClientDocument', clientDocumentSchema);
