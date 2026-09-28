import { Router } from 'express';

/** Routes API réservées admin (JWT) — à étendre selon les modules métier. */
const router = Router();

router.get('/health', (_req, res) => {
  res.json({ ok: true, scope: 'admin-api' });
});

export default router;
