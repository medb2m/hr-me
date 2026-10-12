import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import {
  createMeeting,
  getMeeting,
  listMeetings,
  patchMeetingStatus,
  updateMeeting,
  getJoinToken,
  addParticipant,
  removeParticipant,
} from '../controllers/meetings.controller.js';

const router = Router();
router.use(requireAuth);

router.post('/', createMeeting);
router.get('/', listMeetings);
router.get('/:id/join-token', getJoinToken);
router.post('/:id/participants', addParticipant);
router.delete('/:id/participants', removeParticipant);
router.patch('/:id/status', patchMeetingStatus);
router.patch('/:id', updateMeeting);
router.get('/:id', getMeeting);

export default router;
