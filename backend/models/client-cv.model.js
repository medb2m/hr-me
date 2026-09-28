import mongoose from 'mongoose';

/**
 * CV candidat : plusieurs par utilisateur, nom unique par compte.
 * `editorState` : JSON flexible (sections visibles, texte profil vs personnalisé, etc.).
 */
const clientCvSchema = new mongoose.Schema(
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
    photoSource: {
      type: String,
      enum: ['profile', 'custom'],
      default: 'profile',
    },
    customPhotoUrl: { type: String, trim: true, default: '' },
    editorState: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
  },
  { timestamps: true }
);

clientCvSchema.index({ user: 1, name: 1 }, { unique: true });

export const ClientCv = mongoose.models.ClientCv || mongoose.model('ClientCv', clientCvSchema);
