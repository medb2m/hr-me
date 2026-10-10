import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { requireClientRole } from '../middleware/require-client.middleware.js';
import { uploadClientProfilePhoto } from '../middleware/client-profile-photo.multer.js';
import { multerSingleHandler } from '../../helpers/multer-upload-wrap.js';
import { uploadClientCvPhoto } from '../middleware/client-cv-photo.multer.js';
import { uploadClientDocument } from '../middleware/client-document.multer.js';
import * as clientProfile from '../controllers/client-profile.controller.js';
import * as clientCv from '../controllers/client-cv.controller.js';
import * as clientDocs from '../controllers/client-documents.controller.js';

const router = Router();

router.use(requireAuth);
router.use(requireClientRole);

router.get('/profile', clientProfile.getProfile);
router.patch('/profile', clientProfile.patchProfile);
/** Même logique que PATCH (certains proxys / anciens clients gèrent mieux PUT). */
router.put('/profile', clientProfile.patchProfile);
router.post(
  '/profile/photo',
  multerSingleHandler(uploadClientProfilePhoto, 'photo'),
  clientProfile.uploadProfilePhoto,
);
router.delete('/profile/photo', clientProfile.deleteProfilePhoto);
router.delete('/profile/photo/history/:historyId', clientProfile.deleteProfilePhotoHistoryEntry);
router.patch('/profile/photo/active', clientProfile.activateProfilePhotoFromHistory);

router.get('/cvs', clientCv.listCvs);
router.post('/cvs', clientCv.createCv);
router.get('/cvs/:cvId', clientCv.getCv);
router.patch('/cvs/:cvId', clientCv.patchCv);
router.put('/cvs/:cvId', clientCv.patchCv);
router.delete('/cvs/:cvId', clientCv.deleteCv);
router.post(
  '/cvs/:cvId/photo',
  multerSingleHandler(uploadClientCvPhoto, 'photo'),
  clientCv.uploadCvPhoto,
);

router.get('/documents', clientDocs.listDocuments);
router.post(
  '/documents',
  multerSingleHandler(uploadClientDocument, 'document'),
  clientDocs.uploadDocument,
);
router.delete('/documents/:id', clientDocs.deleteDocument);

export default router;
