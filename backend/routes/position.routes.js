import express from 'express';
import { createPosition, getPositions } from '../controllers/position.controller.js';

const router = express.Router();

router.post('/', createPosition);
router.get('/', getPositions);

export default router;
