import express from 'express';

import { createCandidate, getAllCandidates, getCandidateById, updateCandidate } from '../controllers/candidate.controller.js';
import { uploadImage } from '../middleware/multer-config.js';

const router = express.Router();

// Create a new candidate
router.post('/', uploadImage.single('image'), createCandidate);

// Get all candidates
router.get('/', getAllCandidates);

// Get a specific candidate
router.get('/:id', getCandidateById);

// Update a candidate
router.put('/:id', uploadImage.single('image'), updateCandidate);
export default router;
