/**
 * Pays destinations (placement international) — code ISO alpha-2 + nom FR.
 * Le drapeau est dérivé du code via `flagEmoji()` (indicateurs régionaux).
 */
export interface CountryOption {
  code: string;
  name: string;
}

export const COUNTRIES: CountryOption[] = [
  { code: 'FR', name: 'France' },
  { code: 'DE', name: 'Allemagne' },
  { code: 'IT', name: 'Italie' },
  { code: 'ES', name: 'Espagne' },
  { code: 'PT', name: 'Portugal' },
  { code: 'BE', name: 'Belgique' },
  { code: 'NL', name: 'Pays-Bas' },
  { code: 'LU', name: 'Luxembourg' },
  { code: 'CH', name: 'Suisse' },
  { code: 'AT', name: 'Autriche' },
  { code: 'PL', name: 'Pologne' },
  { code: 'CZ', name: 'Tchéquie' },
  { code: 'SK', name: 'Slovaquie' },
  { code: 'HU', name: 'Hongrie' },
  { code: 'RO', name: 'Roumanie' },
  { code: 'BG', name: 'Bulgarie' },
  { code: 'HR', name: 'Croatie' },
  { code: 'SI', name: 'Slovénie' },
  { code: 'GR', name: 'Grèce' },
  { code: 'AL', name: 'Albanie' },
  { code: 'RS', name: 'Serbie' },
  { code: 'MT', name: 'Malte' },
  { code: 'CY', name: 'Chypre' },
  { code: 'IE', name: 'Irlande' },
  { code: 'GB', name: 'Royaume-Uni' },
  { code: 'SE', name: 'Suède' },
  { code: 'NO', name: 'Norvège' },
  { code: 'DK', name: 'Danemark' },
  { code: 'FI', name: 'Finlande' },
  { code: 'EE', name: 'Estonie' },
  { code: 'LV', name: 'Lettonie' },
  { code: 'LT', name: 'Lituanie' },
  { code: 'CA', name: 'Canada' },
  { code: 'US', name: 'États-Unis' },
  { code: 'MX', name: 'Mexique' },
  { code: 'QA', name: 'Qatar' },
  { code: 'AE', name: 'Émirats arabes unis' },
  { code: 'SA', name: 'Arabie saoudite' },
  { code: 'KW', name: 'Koweït' },
  { code: 'BH', name: 'Bahreïn' },
  { code: 'OM', name: 'Oman' },
  { code: 'TR', name: 'Turquie' },
  { code: 'IL', name: 'Israël' },
  { code: 'TN', name: 'Tunisie' },
  { code: 'MA', name: 'Maroc' },
  { code: 'DZ', name: 'Algérie' },
  { code: 'EG', name: 'Égypte' },
  { code: 'SN', name: 'Sénégal' },
  { code: 'CI', name: 'Côte d\u2019Ivoire' },
  { code: 'JP', name: 'Japon' },
  { code: 'KR', name: 'Corée du Sud' },
  { code: 'SG', name: 'Singapour' },
  { code: 'AU', name: 'Australie' },
  { code: 'NZ', name: 'Nouvelle-Zélande' },
];

/** « FR » → « 🇫🇷 » (fallback « 🏳️ » si code invalide). */
export function flagEmoji(code: string): string {
  const c = (code || '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return '🏳️';
  return String.fromCodePoint(...[...c].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
}

export function countryByCode(code: string): CountryOption | undefined {
  return COUNTRIES.find((c) => c.code === (code || '').toUpperCase());
}
