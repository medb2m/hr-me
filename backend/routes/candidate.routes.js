import express from 'express';

import { createCandidate, getAllCandidates, getCandidateById } from '../controllers/candidate.controller.js';

const router = express.Router();

// Create a new candidate
router.post('/candidates', createCandidate);

// Get all candidates
router.get('/candidates', getAllCandidates);

// Get a specific candidate
router.get('/candidates/:id', getCandidateById);

export default router;
