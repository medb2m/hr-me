import express from 'express';
import {
  createTicket,
  updateTicket,
  getAllTickets,
  getTicketById,
  deleteTicket,
  addComment,
  getTicketStatistics,
} from '../controllers/ticket.controller.js';
import { uploadFiles } from '../middleware/multer-uploads.js';

const router = express.Router();

// Route to create a new ticket
router.post('/', uploadFiles.array('files', 5), createTicket);

// Route to update a ticket by ID
router.put('/:id', updateTicket);

// Route to get all tickets (with filtering, sorting, pagination)
router.get('/', getAllTickets);

// Route to get a single ticket by ID
router.get('/:id', getTicketById);

// Route to delete a ticket by ID
router.delete('/:id', deleteTicket);

// Route to add a comment to a ticket
router.post('/:id/comments', addComment);

// Route to get ticket statistics
router.get('/statistics', getTicketStatistics);

export default router;
