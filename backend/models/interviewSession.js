import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ['system', 'user', 'assistant'],
      required: true,
    },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const interviewSessionSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    candidateName: { type: String, default: '', trim: true },
    status: {
      type: String,
      enum: ['in_progress', 'completed'],
      default: 'in_progress',
    },
    messages: { type: [messageSchema], default: [] },
    completedAt: { type: Date },
    recruiterSummary: { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.model('InterviewSession', interviewSessionSchema);
