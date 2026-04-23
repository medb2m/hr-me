import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import {
  listEvents,
  getEvent,
  createEvent,
  patchEvent,
  cancelEvent,
  downloadIcs,
  conflicts,
} from '../controllers/calendar.controller.js';

const router = Router();
router.use(requireAuth);

router.get('/events', listEvents);
router.get('/conflicts', conflicts);
router.post('/events', createEvent);
router.get('/events/:id/ics', downloadIcs);
router.get('/events/:id', getEvent);
router.patch('/events/:id', patchEvent);
router.delete('/events/:id', cancelEvent);

export default router;
