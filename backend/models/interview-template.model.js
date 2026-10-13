import mongoose from 'mongoose';

const interviewTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    topics: { type: [String], default: [] },
    instructions: { type: String, default: '', trim: true },
    deadlineHours: { type: Number, default: 48 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

export default mongoose.model('InterviewTemplate', interviewTemplateSchema);
