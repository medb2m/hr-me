/**
 * Normalisation intelligente d'un nom de personne saisi en un seul champ.
 * Miroir de `backend/helpers/person-name.js` — garder les deux alignés.
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

function cap(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** « mohamed ben mohamed » → « Mohamed ben Mohamed » ; « jean-paul » → « Jean-Paul ». */
export function normalizePersonName(raw: string): string {
  const s = (raw || '').trim().replace(/\s+/g, ' ');
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

export function isValidPersonName(name: string): boolean {
  return !!name && name.length <= MAX_NAME_LEN && NAME_RE.test(name);
}
