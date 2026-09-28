import { unlink } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Résout un chemin disque depuis une URL publique `/uploads/...`.
 * @param {string} publicPath
 * @returns {string | null}
 */
export function resolveDiskPathFromUploadsPublicUrl(publicPath) {
  if (!publicPath || typeof publicPath !== 'string') {
    return null;
  }
  if (!publicPath.startsWith('/uploads/')) {
    return null;
  }
  const rel = publicPath.slice('/uploads/'.length);
  if (!rel || rel.includes('..')) {
    return null;
  }
  return join(__dirname, '../public/uploads', rel);
}

/**
 * Supprime un fichier sous `public/uploads/` si l’URL correspond au préfixe attendu (sécurité).
 * @param {string | null | undefined} publicPath
 * @param {{ onlyPrefix: string }} options onlyPrefix ex. `/uploads/client-profiles/`
 */
export async function safeUnlinkUpload(publicPath, options) {
  const prefix = options.onlyPrefix;
  if (!publicPath || typeof publicPath !== 'string' || !publicPath.startsWith(prefix)) {
    return;
  }
  const disk = resolveDiskPathFromUploadsPublicUrl(publicPath);
  if (!disk) {
    return;
  }
  try {
    await unlink(disk);
  } catch {
    // fichier déjà absent ou permission : ignorer
  }
}
