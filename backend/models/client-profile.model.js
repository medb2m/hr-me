import mongoose from 'mongoose';

/**
 * Profil détaillé « espace candidat » (Europass / overview) : une entrée par utilisateur `client`.
 * Le compte `User` reste pour l’auth ; ce modèle porte prénom, identité étendue, parcours et jalons de complétion.
 */

const workExperienceSchema = new mongoose.Schema(
  {
    jobTitle: { type: String, trim: true, default: '' },
    employer: { type: String, trim: true, default: '' },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    /** Poste en cours (« Présent » sur le CV) — endDate ignorée. */
    current: { type: Boolean, default: false },
    description: { type: String, trim: true, default: '' },
  },
  { _id: true }
);

const educationSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true, default: '' },
    organization: { type: String, trim: true, default: '' },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    /** Formation en cours. */
    current: { type: Boolean, default: false },
  },
  { _id: true }
);

const languageEntrySchema = new mongoose.Schema(
  {
    language: { type: String, trim: true, default: '' },
    cefrLevel: { type: String, trim: true, default: '' },
  },
  { _id: true }
);

/** Photos profil précédemment enregistrées (fichiers conservés jusqu’à suppression explicite). */
const profilePhotoHistoryEntrySchema = new mongoose.Schema(
  {
    url: { type: String, trim: true, required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const clientProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    /** Prénom (champ principal demandé pour le profil détaillé). */
    prenom: { type: String, trim: true, default: '' },
    /** Nom de famille. */
    nom: { type: String, trim: true, default: '' },
    birthDate: { type: Date, default: null },
    profilePhotoUrl: { type: String, trim: true, default: '' },
    profilePhotoHistory: { type: [profilePhotoHistoryEntrySchema], default: [] },
    phone: { type: String, trim: true, default: '' },
    /** Numéros de téléphone supplémentaires (plusieurs possibles). */
    phones: { type: [String], default: [] },
    /** Liens externes : préréglages (LinkedIn, GitHub…) ou nom personnalisé. */
    links: {
      type: [
        {
          label: { type: String, trim: true, default: '' },
          url: { type: String, trim: true, default: '' },
        },
      ],
      default: [],
    },
    city: { type: String, trim: true, default: '' },
    country: { type: String, trim: true, default: '' },
    nationality: { type: String, trim: true, default: '' },
    headline: { type: String, trim: true, default: '' },

    workExperiences: { type: [workExperienceSchema], default: [] },
    educations: { type: [educationSchema], default: [] },
    skills: { type: [String], default: [] },
    languagesSpoken: { type: [languageEntrySchema], default: [] },
    digitalSkills: { type: [String], default: [] },

    /** Aligné sur les sections de complétion de l’overview (drapeaux manuels ou dérivés plus tard). */
    sectionFlags: {
      personalInfo: { type: Boolean, default: false },
      workHistory: { type: Boolean, default: false },
      education: { type: Boolean, default: false },
      skills: { type: Boolean, default: false },
      languages: { type: Boolean, default: false },
      digitalSkills: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

export const ClientProfile =
  mongoose.models.ClientProfile || mongoose.model('ClientProfile', clientProfileSchema);

/**
 * Crée une fiche profil vide si absente (ex. comptes créés avant ce modèle).
 * @param {import('mongoose').Types.ObjectId} userId
 */
export async function ensureClientProfileForUser(userId) {
  const existing = await ClientProfile.findOne({ user: userId });
  if (existing) {
    return existing;
  }
  return ClientProfile.create({ user: userId });
}
