import express from 'express';
import { createApplication, getAllApplicationsByCandidate, getAllApplicationsByOffer, getAssignedCandidatesByOfferId } from '../controllers/application.controller.js';

const router = express.Router();

router.post('/', createApplication)
router.get('/candidate/:id', getAllApplicationsByCandidate)
router.get('/offer/:id', getAllApplicationsByOffer)
router.get('/assigned/:id', getAssignedCandidatesByOfferId)

export default router;