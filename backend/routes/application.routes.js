import express from 'express';
import { createApplication, getAllApplicationsByCandidate, getAllApplicationsByOffer, getAssignedCandidatesByOfferId } from '../controllers/application.controller.js';
import { apply, myApplications } from '../controllers/applications.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { uploadApplicationDocs } from '../middleware/application-doc.multer.js';

const router = express.Router();

// Postuler / mes candidatures (JWT, tout rôle connecté)
router.post(
  '/',
  requireAuth,
  uploadApplicationDocs.fields([
    { name: 'cv', maxCount: 1 },
    { name: 'attachments', maxCount: 5 },
  ]),
  apply,
);
router.get('/mine', requireAuth, myApplications);

// Legacy
router.post('/legacy', createApplication)
router.get('/candidate/:id', getAllApplicationsByCandidate)
router.get('/offer/:id', getAllApplicationsByOffer)
router.get('/assigned/:id', getAssignedCandidatesByOfferId)

export default router;
