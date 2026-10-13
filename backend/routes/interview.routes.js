import express from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import {
  completeInterviewSession,
  createInterviewSession,
  getInterviewSessionById,
  getInterviewSessions,
  sendInterviewMessage,
  evaluateSession,
  reviewSession,
  mySessions,
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  accessSession,
  accessStart,
  accessMessage,
  accessComplete,
} from '../controllers/interview.controller.js';

const router = express.Router();

const STAFF_ROLES = new Set(['admin', 'agent', 'director', 'recruiter']);

/** Staff uniquement (équipe interne) — après requireAuth. */
function requireStaff(req, res, next) {
  if (!STAFF_ROLES.has(req.user?.role || '')) {
    return res.status(403).json({ success: false, message: 'Staff access required.' });
  }
  next();
}

// ── Accès public par jeton (lien reçu par e-mail, personne sans compte) ──
router.get('/access/:token', accessSession);
router.post('/access/:token/start', accessStart);
router.post('/access/:token/messages', accessMessage);
router.post('/access/:token/complete', accessComplete);

// ── Utilisateur connecté : ses entretiens à passer ──
router.get('/mine', requireAuth, mySessions);

// ── Staff : templates réutilisables ──
router.get('/templates', requireAuth, requireStaff, listTemplates);
router.post('/templates', requireAuth, requireStaff, createTemplate);
router.patch('/templates/:id', requireAuth, requireStaff, updateTemplate);
router.delete('/templates/:id', requireAuth, requireStaff, deleteTemplate);

// ── Staff : sessions ──
router.post('/sessions', requireAuth, requireStaff, createInterviewSession);
router.get('/sessions', requireAuth, requireStaff, getInterviewSessions);
router.get('/sessions/:id', requireAuth, requireStaff, getInterviewSessionById);
router.post('/sessions/:id/messages', requireAuth, requireStaff, sendInterviewMessage);
router.post('/sessions/:id/evaluate', requireAuth, requireStaff, evaluateSession);
router.patch('/sessions/:id/review', requireAuth, requireStaff, reviewSession);
router.patch('/sessions/:id/complete', requireAuth, requireStaff, completeInterviewSession);

export default router;
