import { Router } from 'express';
import * as auth from '../controllers/auth.controller.js';

const router = Router();

router.post('/register', auth.register);
router.post('/login', auth.login);
router.post('/forgot-password', auth.forgotPassword);
router.post('/reset-password', auth.resetPassword);
router.post('/verify-email', auth.verifyEmail);
router.post('/resend-verification', auth.resendVerification);

router.get('/admin/status', auth.adminStatus);
router.post('/admin/bootstrap', auth.bootstrapAdmin);
router.post('/admin/login', auth.adminLogin);

export default router;
