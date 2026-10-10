import mongoose from 'mongoose';

const applicationFileSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true },      // nom de stockage
    path: { type: String, required: true },          // /uploads/applications/…
    originalName: { type: String, default: '' },     // nom affiché à l'utilisateur
    mime: { type: String, default: '' },
    size: { type: Number, default: 0 },
    kind: { type: String, default: '' },             // diploma | certificate | other (docs partagés)
  },
  { _id: true },
);

const applicationSchema = new mongoose.Schema({
  // Candidat interne (parcours agence) — optionnel : un client postule via son compte User.
  candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate' },
  offer: { type: mongoose.Schema.Types.ObjectId, ref: 'Offer', required: true },
  position: { type: mongoose.Schema.Types.ObjectId, ref: 'Position' },
  // Cycle de vie : pending (envoyée) → review (en révision) → accepted | rejected.
  status: {
    type: String,
    enum: ['pending', 'applied', 'review', 'accepted', 'rejected'],
    default: 'pending',
  },
  notes: { type: String },
  adminNotes: { type: String, default: '' },

  // Qui a déposé la candidature — distingue les types de postulation.
  source: {
    type: String,
    enum: ['candidate', 'client', 'agent'],
    default: 'candidate',
  },
  appliedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  applicantName: { type: String, trim: true, default: '' },
  applicantEmail: { type: String, trim: true, default: '' },

  // Lettre de motivation + pièces jointes.
  message: { type: String, default: '' },
  cv: { type: applicationFileSchema, default: null },
  attachments: { type: [applicationFileSchema], default: [] },

  // « Partager mon profil » — le postulant partage son dossier plateforme.
  sharedProfile: { type: Boolean, default: false },
  sharedCv: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: 'ClientCv', default: null },
    name: { type: String, default: '' },
  },
  // Documents de la bibliothèque candidat copiés dans la candidature (snapshot).
  sharedDocs: { type: [applicationFileSchema], default: [] },
},
{timestamps: true}
);

applicationSchema.index({ offer: 1 });
applicationSchema.index({ appliedBy: 1, offer: 1 });

export const Application = mongoose.model('Application', applicationSchema);
