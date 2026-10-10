import multer, { diskStorage } from 'multer';
import { mkdirSync } from 'fs';
import { extname, join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = join(__dirname, '../../public/uploads/client-documents');

const ALLOWED = new Map([
  ['application/pdf', '.pdf'],
  ['application/msword', '.doc'],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.docx'],
  ['application/vnd.oasis.opendocument.text', '.odt'],
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
]);

const MAX_BYTES = 10 * 1024 * 1024; // 10 Mo

const storage = diskStorage({
  destination: (req, file, cb) => {
    mkdirSync(DOCS_DIR, { recursive: true });
    cb(null, DOCS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = ALLOWED.get(file.mimetype) || extname(file.originalname) || '.bin';
    cb(null, `doc-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

/** Upload des documents de la bibliothèque candidat — PDF/DOC/images, ≤ 10 Mo. */
export const uploadClientDocument = multer({
  storage,
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('DOCUMENT_FILE_TYPE'));
    }
  },
});
