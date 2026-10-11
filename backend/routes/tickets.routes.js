import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { uploadTicketFiles } from '../middleware/ticket-upload.multer.js';
import {
  createTicket,
  listTickets,
  getBoard,
  getTicket,
  patchTicket,
  addComment,
  getStats,
  listAssignees,
} from '../controllers/tickets.controller.js';

const router = Router();

router.use(requireAuth);

router.post('/', uploadTicketFiles.array('files', 5), createTicket);
router.get('/', listTickets);
router.get('/board', getBoard);
router.get('/stats', getStats);
router.get('/assignees', listAssignees);
router.get('/:id', getTicket);
router.patch('/:id', patchTicket);
router.post('/:id/comments', addComment);

export default router;
