import mongoose from 'mongoose';

/**
 * Bibliothèque de compétences — suggestions du sélecteur de compétences.
 * Enrichie en continu : une compétence saisie par un utilisateur qui n'existe
 * pas encore est enregistrée (`source: 'user'`) et ressort ensuite dans les
 * suggestions de tout le monde (tri par `count` d'utilisation).
 */
const skillSchema = new mongoose.Schema(
  {
    /** Clé normalisée unique (minuscules, sans accents, sans espaces doubles). */
    key: { type: String, required: true, unique: true, index: true },
    /** Libellé d'affichage tel que proposé. */
    label: { type: String, trim: true, required: true },
    /** 'skill' (métier) | 'digital' (numérique) | 'language'. */
    kind: { type: String, enum: ['skill', 'digital', 'language'], default: 'skill' },
    /** Catégorie métier pour le regroupement visuel. */
    category: { type: String, trim: true, default: 'autre' },
    /** Nombre d'utilisations — fait remonter les entrées populaires. */
    count: { type: Number, default: 0 },
    source: { type: String, enum: ['seed', 'user'], default: 'seed' },
  },
  { timestamps: true }
);

skillSchema.index({ kind: 1, count: -1 });

export const Skill = mongoose.models.Skill || mongoose.model('Skill', skillSchema);

/** Normalise un libellé en clé de déduplication (insensible casse/accents). */
export function skillKey(label) {
  return String(label || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}
