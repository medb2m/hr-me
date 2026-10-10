import multer, { diskStorage } from 'multer';
import { mkdirSync } from 'fs';
import { extname, join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APPS_DIR = join(__dirname, '../public/uploads/applications');

const ALLOWED = new Map([
  ['application/pdf', '.pdf'],
  ['application/msword', '.doc'],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.docx'],
  ['application/vnd.oasis.opendocument.text', '.odt'],
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
]);

const MAX_BYTES = 10 * 1024 * 1024; // 10 Mo par fichier

const storage = diskStorage({
  destination: (req, file, cb) => {
    mkdirSync(APPS_DIR, { recursive: true });
    cb(null, APPS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = ALLOWED.get(file.mimetype) || extname(file.originalname) || '.bin';
    cb(null, `app-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

/** Upload des pièces jointes de candidature (CV + diplômes…) — PDF/DOC/images, ≤ 10 Mo. */
export const uploadApplicationDocs = multer({
  storage,
  limits: { fileSize: MAX_BYTES, files: 6 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('APPLICATION_FILE_TYPE'));
    }
  },
});
