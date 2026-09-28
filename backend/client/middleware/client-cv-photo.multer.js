import multer, { diskStorage } from 'multer';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  extFromProfileImageMime,
  profileImageFileFilter,
  PROFILE_IMAGE_MAX_BYTES,
} from '../../helpers/upload-basics.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIR = join(__dirname, '../../public/uploads/client-cv-photos');

const storage = diskStorage({
  destination: (req, file, cb) => {
    mkdirSync(DIR, { recursive: true });
    cb(null, DIR);
  },
  filename: (req, file, cb) => {
    const ext = extFromProfileImageMime(file.mimetype);
    const cv = req.params.cvId || 'cv';
    cb(null, `${req.user.id}-${cv}-${Date.now()}${ext}`);
  },
});

export const uploadClientCvPhoto = multer({
  storage,
  limits: { fileSize: PROFILE_IMAGE_MAX_BYTES },
  fileFilter: profileImageFileFilter,
});
