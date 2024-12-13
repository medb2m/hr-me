import express from 'express';

import { checkDossierStatus, createCandidate, getAllCandidates, getCandidateById, getDossier, updateCandidate, updateDossier } from '../controllers/candidate.controller.js';
import { uploadImage } from '../middleware/multer-config.js';
import { uploadFiles } from '../middleware/multer-uploads.js';

const router = express.Router();

// Create a new candidate
router.post('/', uploadImage.single('image'), createCandidate);

// Get all candidates
router.get('/', getAllCandidates);

// Get a specific candidate
router.get('/:id', getCandidateById);

// Update a candidate
router.put('/:id', uploadImage.single('image'), updateCandidate);

// Dossier
router.post('/:id/dossier', uploadFiles.array('files', 5), updateDossier);
router.get('/:id/dossier', getDossier);
router.get('/:id/dossier/status', checkDossierStatus);

export default router;
