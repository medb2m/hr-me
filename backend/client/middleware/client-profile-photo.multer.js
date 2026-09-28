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
const CLIENT_PROFILE_PHOTO_DIR = join(__dirname, '../../public/uploads/client-profiles');

const storage = diskStorage({
  destination: (req, file, cb) => {
    mkdirSync(CLIENT_PROFILE_PHOTO_DIR, { recursive: true });
    cb(null, CLIENT_PROFILE_PHOTO_DIR);
  },
  filename: (req, file, cb) => {
    const ext = extFromProfileImageMime(file.mimetype);
    cb(null, `${req.user.id}-${Date.now()}${ext}`);
  },
});

export const uploadClientProfilePhoto = multer({
  storage,
  limits: { fileSize: PROFILE_IMAGE_MAX_BYTES },
  fileFilter: profileImageFileFilter,
});
