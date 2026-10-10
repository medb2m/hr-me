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
const AVATAR_DIR = join(__dirname, '../public/uploads/avatars');

const storage = diskStorage({
  destination: (req, file, cb) => {
    mkdirSync(AVATAR_DIR, { recursive: true });
    cb(null, AVATAR_DIR);
  },
  filename: (req, file, cb) => {
    const ext = extFromProfileImageMime(file.mimetype);
    cb(null, `${req.user.id}-avatar-${Date.now()}${ext}`);
  },
});

export const uploadAccountAvatar = multer({
  storage,
  limits: { fileSize: PROFILE_IMAGE_MAX_BYTES },
  fileFilter: profileImageFileFilter,
});
