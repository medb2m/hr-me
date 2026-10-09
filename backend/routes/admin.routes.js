import { Router } from 'express';
import { requireAdmin } from '../middleware/admin-auth.middleware.js';
import * as users from '../controllers/admin-users.controller.js';

/** Routes API réservées admin (JWT + rôle admin). */
const router = Router();

router.use(requireAdmin);

router.get('/health', (_req, res) => {
  res.json({ ok: true, scope: 'admin-api' });
});

router.get('/users/stats', users.userStats);
router.get('/users', users.listUsers);
router.post('/users', users.createUser);
router.put('/users/:id', users.updateUser);
router.delete('/users/:id', users.deleteUser);

export default router;
