/** Types MIME autorisés pour une photo de profil (avatar). */
export const PROFILE_IMAGE_MIMES = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
]);

/** Taille max avatar (bytes). */
export const PROFILE_IMAGE_MAX_BYTES = 2 * 1024 * 1024;

/**
 * @param {string} mime
 * @returns {string}
 */
export function extFromProfileImageMime(mime) {
  return PROFILE_IMAGE_MIMES.get(mime) || '.jpg';
}

/**
 * Chemin public servi par `express.static` sur `/uploads`.
 * @param {string} subdir ex. `client-profiles` (sans slash)
 * @param {string} filename
 * @returns {string}
 */
export function uploadsPublicPath(subdir, filename) {
  const safe = String(subdir || '').replace(/^\/+|\/+$/g, '');
  return `/uploads/${safe}/${filename}`;
}

/**
 * Filtre Multer : uniquement JPEG / PNG / Webp.
 * @type {import('multer').Options['fileFilter']}
 */
export function profileImageFileFilter(req, file, cb) {
  if (PROFILE_IMAGE_MIMES.has(file.mimetype)) {
    cb(null, true);
  } else {
    const e = new Error('PROFILE_IMAGE_TYPE');
    cb(e);
  }
}
