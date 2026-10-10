import multer, { diskStorage } from 'multer';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  extFromProfileImageMime,
  profileImageFileFilter,
  PROFILE_IMAGE_MAX_BYTES,
} from '../helpers/upload-basics.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOGO_DIR = join(__dirname, '../public/uploads/company-logos');

const storage = diskStorage({
  destination: (req, file, cb) => {
    mkdirSync(LOGO_DIR, { recursive: true });
    cb(null, LOGO_DIR);
  },
  filename: (req, file, cb) => {
    const ext = extFromProfileImageMime(file.mimetype);
    cb(null, `logo-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
  },
});

/** Upload d'un logo d'entreprise pour les offres (JPEG/PNG/WebP, ≤ 2 Mo). */
export const uploadCompanyLogo = multer({
  storage,
  limits: { fileSize: PROFILE_IMAGE_MAX_BYTES },
  fileFilter: profileImageFileFilter,
});
