import express from 'express';
import { postTtsSpeak } from '../controllers/tts.controller.js';

const router = express.Router();

router.post('/speak', postTtsSpeak);

export default router;
