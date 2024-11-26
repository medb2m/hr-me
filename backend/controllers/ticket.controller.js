import Ticket from '../models/ticket.js'; // Assuming the model is stored here

// Create a new ticket
export const createTicket = async (req, res) => {
    try {
      const ticketData = { ...req.body };
  
      // Handle uploaded files
      if (req.files && req.files.length > 0) {
        ticketData.files = req.files.map((file) => ({
          filename: file.originalname,
          filepath: `${req.protocol}://${req.get("host")}/uploads/${file.filename}`,
          uploadedAt: new Date(),
        }));
      }
  
      const ticket = new Ticket(ticketData);
      await ticket.save();
  
      res.status(201).json({ success: true, data: ticket });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  };

// Update an existing ticket
export const updateTicket = async (req, res) => {
    try {
      const { id } = req.params;
      const updatedData = req.body;
  
      // Handle file uploads if provided
      if (req.files && req.files.length > 0) {
        updatedData.files = req.files.map((file) => ({
          filename: file.filename,
          filepath: `${req.protocol}://${req.get("host")}/uploads/${file.filename}`,
          uploadedAt: new Date(),
        }));
      }
  
      const updatedTicket = await Ticket.findByIdAndUpdate(id, updatedData, {
        new: true,
        runValidators: true,
      });
  
      if (!updatedTicket) {
        return res.status(404).json({ success: false, message: "Ticket not found" });
      }
  
      res.status(200).json({ success: true, data: updatedTicket });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  };
  

// Get all tickets with filtering, sorting, and pagination
export const getAllTickets = async (req, res) => {
  try {
    const { status, priority, assignedTeam, page = 1, limit = 10 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (assignedTeam) filter.assignedTeam = assignedTeam;

    const tickets = await Ticket.find(filter)
      .sort({ createdAt: -1 }) // Sort by most recent
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Ticket.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: tickets,
      pagination: { total, page: parseInt(page), limit: parseInt(limit) },
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Get a ticket by its ID
export const getTicketById = async (req, res) => {
  try {
    const { id } = req.params;
    const ticket = await Ticket.findById(id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }
    res.status(200).json(ticket);
  } catch (error) {
    res.status(400).json({message: error.message });
  }
};

// Delete a ticket
export const deleteTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const ticket = await Ticket.findByIdAndDelete(id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }
    res.status(200).json({ success: true, message: 'Ticket deleted successfully' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Add a comment to a ticket
export const addComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { comment, commentedBy } = req.body;
    const ticket = await Ticket.findById(id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    ticket.comments.push({ comment, commentedBy });
    await ticket.save();

    res.status(200).json({ success: true, data: ticket });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Get ticket statistics
export const getTicketStatistics = async (req, res) => {
  try {
    const stats = await Ticket.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    res.status(200).json({ success: true, data: stats });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
