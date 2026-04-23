import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import {
  createMeeting,
  getMeeting,
  listMeetings,
  patchMeetingStatus,
  getJoinToken,
  addParticipant,
} from '../controllers/meetings.controller.js';

const router = Router();
router.use(requireAuth);

router.post('/', createMeeting);
router.get('/', listMeetings);
router.get('/:id/join-token', getJoinToken);
router.post('/:id/participants', addParticipant);
router.patch('/:id/status', patchMeetingStatus);
router.get('/:id', getMeeting);

export default router;
