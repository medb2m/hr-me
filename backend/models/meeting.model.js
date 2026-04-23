import mongoose from 'mongoose';

const participantSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    email: { type: String, trim: true, lowercase: true, default: '' },
    name: { type: String, trim: true, default: '' },
    role: {
      type: String,
      enum: ['host', 'recruiter', 'candidate', 'observer'],
      required: true,
    },
    joinAt: { type: Date, default: null },
    leaveAt: { type: Date, default: null },
    noShow: { type: Boolean, default: false },
    feedbackRating: { type: Number, min: 1, max: 5, default: null },
  },
  { _id: false }
);

const meetingSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 300 },
    type: {
      type: String,
      enum: ['screening', 'technical', 'final', 'ai_automated'],
      default: 'screening',
    },
    status: {
      type: String,
      enum: ['SCHEDULED', 'WAITING', 'IN_PROGRESS', 'ENDED', 'ARCHIVED'],
      default: 'SCHEDULED',
      index: true,
    },
    scheduledAt: { type: Date, required: true, index: true },
    durationMin: { type: Number, required: true, min: 5, max: 480, default: 30 },
    timezone: { type: String, default: 'Africa/Tunis' },
    language: { type: String, enum: ['fr', 'en', 'ar', 'it'], default: 'fr' },
    description: { type: String, default: '' },
    offerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Offer', default: null },
    candidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate', default: null },
    createdByAgentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    roomId: { type: String, required: true, unique: true, index: true },
    pinCode: { type: String, required: true },
    participants: [participantSchema],
    recordingUrl: { type: String, default: null },
    transcriptUrl: { type: String, default: null },
    aiReportJson: { type: mongoose.Schema.Types.Mixed, default: null },
    notesSnapshot: { type: String, default: '' },
    recurrenceRule: { type: String, default: null },
  },
  { timestamps: true }
);

meetingSchema.index({ createdByAgentId: 1, scheduledAt: 1 });
meetingSchema.index({ 'participants.userId': 1, scheduledAt: 1 });

export const Meeting = mongoose.models.Meeting || mongoose.model('Meeting', meetingSchema);
