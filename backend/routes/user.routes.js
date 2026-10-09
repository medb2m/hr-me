import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import * as users from '../controllers/user.controller.js';

const router = Router();

// Public: link clicked from the confirmation email (works logged out too).
router.post('/confirm-email-change', users.confirmEmailChange);

router.use(requireAuth);

router.get('/me', users.getMe);
router.put('/me', users.updateMe);
router.put('/me/password', users.changePassword);
router.post('/me/email-change', users.requestEmailChange);
router.post('/me/email-change/cancel', users.cancelEmailChange);

export default router;
