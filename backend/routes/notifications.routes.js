import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import {
  listNotifications,
  unreadCount,
  markRead,
  markAllRead,
  dismiss,
  snooze,
  createTest,
} from '../controllers/notifications.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/', listNotifications);
router.get('/unread-count', unreadCount);
router.post('/dev/test', createTest);
router.patch('/read-all', markAllRead);
router.patch('/:id/read', markRead);
router.delete('/:id', dismiss);
router.post('/:id/snooze', snooze);

export default router;
