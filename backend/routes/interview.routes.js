import express from 'express';
import {
  completeInterviewSession,
  createInterviewSession,
  getInterviewSessionById,
  getInterviewSessions,
  sendInterviewMessage,
} from '../controllers/interview.controller.js';

const router = express.Router();

router.post('/sessions', createInterviewSession);
router.get('/sessions', getInterviewSessions);
router.get('/sessions/:id', getInterviewSessionById);
router.post('/sessions/:id/messages', sendInterviewMessage);
router.patch('/sessions/:id/complete', completeInterviewSession);

export default router;
