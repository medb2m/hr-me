import multer, { diskStorage } from 'multer';
import { mkdirSync } from 'fs';
import { extname, join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TICKETS_DIR = join(__dirname, '../public/uploads/tickets');

const ALLOWED = new Map([
  ['application/pdf', '.pdf'],
  ['application/msword', '.doc'],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.docx'],
  ['application/vnd.oasis.opendocument.text', '.odt'],
  ['application/zip', '.zip'],
  ['text/plain', '.txt'],
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
]);

const MAX_BYTES = 10 * 1024 * 1024; // 10 Mo par fichier

const storage = diskStorage({
  destination: (req, file, cb) => {
    mkdirSync(TICKETS_DIR, { recursive: true });
    cb(null, TICKETS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = ALLOWED.get(file.mimetype) || extname(file.originalname) || '.bin';
    cb(null, `tk-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

/** PJ des tickets (support + internes) — PDF/DOC/images/zip, ≤ 10 Mo, ≤ 5 fichiers. */
export const uploadTicketFiles = multer({
  storage,
  limits: { fileSize: MAX_BYTES, files: 5 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('TICKET_FILE_TYPE'));
    }
  },
});
