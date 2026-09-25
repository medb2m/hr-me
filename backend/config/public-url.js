/**
 * URL publique du front (liens dans les e-mails, etc.).
 * Priorité : FRONTEND_URL → PUBLIC_APP_URL → défaut local.
 * Si .env contient par erreur deux URLs séparées par une virgule, on prend la première.
 */
export function getFrontendBaseUrl() {
  let u =
    process.env.FRONTEND_URL?.trim() ||
    process.env.PUBLIC_APP_URL?.trim() ||
    'http://localhost:4200';
  if (u.includes(',')) {
    u = u.split(',')[0].trim();
  }
  return u.replace(/\/+$/, '');
}
