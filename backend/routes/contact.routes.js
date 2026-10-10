import { Router } from 'express';
import { submitContact } from '../controllers/contact.controller.js';

/** POST /api/contact — formulaire public (page /contact). */
const router = Router();

router.post('/', submitContact);

export default router;
