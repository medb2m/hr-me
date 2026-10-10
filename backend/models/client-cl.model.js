import mongoose from 'mongoose';

/**
 * Lettre de motivation candidat : plusieurs par utilisateur, nom unique par compte.
 * `editorState` : JSON flexible (destinataire, objet, date, corps HTML…).
 */
const clientClSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    editorState: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
  },
  { timestamps: true }
);

clientClSchema.index({ user: 1, name: 1 }, { unique: true });

export const ClientCl = mongoose.models.ClientCl || mongoose.model('ClientCl', clientClSchema);
