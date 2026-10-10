/**
 * Normalisation intelligente d'un nom de personne saisi en un seul champ.
 * - espaces multiples / bords nettoyés
 * - capitalisation mot à mot (y compris après '-' et apostrophes)
 * - particules usuelles laissées en minuscules au milieu du nom
 *   (ben, el, de, van…) mais capitalisées en première position.
 */

const NAME_PARTICLES = new Set([
  'ben',
  'bin',
  'bint',
  'ould',
  'ouled',
  'el',
  'al',
  'de',
  'del',
  'della',
  'di',
  'da',
  'dos',
  'du',
  'des',
  'van',
  'von',
  'der',
  'den',
  'ten',
  'la',
  'le',
  'ou',
]);

/** Lettres Unicode + apostrophes (droite et typographique) + tiret + espace. */
const NAME_RE = /^[\p{L}][\p{L}''’\- ]*$/u;

const MAX_NAME_LEN = 80;

function cap(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export function normalizePersonName(raw) {
  const s = String(raw || '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!s) {
    return '';
  }
  return s
    .split(' ')
    .map((word, idx) =>
      word
        .split(/([-'’])/)
        .map((part) => {
          if (part === '-' || part === "'" || part === '’') {
            return part;
          }
          const lower = part.toLowerCase();
          if (idx > 0 && NAME_PARTICLES.has(lower)) {
            return lower;
          }
          return cap(lower);
        })
        .join(''),
    )
    .join(' ');
}

export function isValidPersonName(name) {
  return !!name && name.length <= MAX_NAME_LEN && NAME_RE.test(name);
}

/**
 * Valide + normalise la saisie « nom complet » d'un formulaire.
 * @returns {{ name: string, error?: string }} name vide si non fourni (champ optionnel).
 */
export function cleanPersonNameInput(raw) {
  const trimmed = String(raw || '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!trimmed) {
    return { name: '' };
  }
  const normalized = normalizePersonName(trimmed);
  if (!isValidPersonName(normalized)) {
    return { name: '', error: 'Le nom ne peut contenir que des lettres, espaces, tirets et apostrophes (80 caractères max).' };
  }
  return { name: normalized };
}
