import mongoose from 'mongoose';

const ticketSchema = new mongoose.Schema({
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['Open', 'In Progress', 'Resolved', 'Closed'],
      default: 'Open',
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Urgent'],
      default: 'Low',
    },
    type: {
      type: String,
      enum: [
        'Document Request',
        'Missing Documents',
        'Missing Information',
        'Candidate Follow-Up',
        'Offer Revision',
        'Application Review',
        'Interview Scheduling',
        'Interview Feedback',
        'Onboarding Process',
        'Follow-Up',
        'Bug',
        'Feature Request',
        'Task',
      ],
      default: 'Task',
    },
    category: {
      type: String,
      default: 'General',
    },
    assignedTeam: {
      type: String,
      enum: ['IT', 'Com'],
      required: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // Replace with your User model
    },
    candidateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Candidate', // Replace with your Candidate model
    },
    offerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Offer', // Replace with your Offer model
    },
    deadline: {
      type: Date,
    },
    files: [
      {
        filename: String,
        filepath: String,
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    comments: [
      {
        comment: String,
        commentedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        commentedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    history: [
      {
        status: String,
        changedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {timestamps: true}
  );

  export default mongoose.model('Ticket', ticketSchema);