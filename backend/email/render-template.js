import fs from 'fs';
import path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const templatesDir = path.join(__dirname, 'templates');

/**
 * Valeurs par défaut pour les modèles HTML transactionnels.
 * @param {Record<string, string | number | undefined>} vars
 */
export function templateDefaults(vars = {}) {
  return {
    appName: process.env.APP_NAME || 'HR-Me',
    supportEmail: process.env.SUPPORT_EMAIL || 'support@localhost',
    ...vars,
  };
}

/**
 * Charge un fichier HTML dans `email/templates/` et remplace `{{clé}}`.
 * Si le fichier est absent, renvoie un HTML minimal pour ne pas bloquer l’envoi.
 */
export function renderTemplate(name, vars) {
  const file = path.join(templatesDir, name);
  let html;
  try {
    html = fs.readFileSync(file, 'utf8');
  } catch {
    return minimalFallback(name, vars);
  }
  let out = html;
  for (const [k, val] of Object.entries(vars)) {
    out = out.split(`{{${k}}}`).join(String(val ?? ''));
  }
  return out;
}

function minimalFallback(name, v) {
  const user = v.userName || v.email || 'there';
  const links = [
    v.verifyUrl,
    v.resetUrl,
    v.loginUrl,
    v.magicUrl,
    v.confirmUrl,
  ].filter(Boolean);
  const linkBlock = links.length ? `<p><a href="${links[0]}">${links[0]}</a></p>` : '';
  return `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;padding:24px">
  <p>Hi ${escapeHtml(String(user))},</p>
  <p>This is an automatic message from <strong>${escapeHtml(String(v.appName || 'HR-Me'))}</strong>.</p>
  ${linkBlock}
  <p style="color:#64748b;font-size:12px">Template file missing: ${escapeHtml(name)}</p>
</body></html>`;
}

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
