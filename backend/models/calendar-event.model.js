import mongoose from 'mongoose';

const calendarParticipantSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    email: { type: String, trim: true, lowercase: true, default: '' },
    role: {
      type: String,
      enum: ['HOST', 'REQUIRED', 'OPTIONAL', 'OBSERVER'],
      default: 'REQUIRED',
    },
    rsvpStatus: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'DECLINED', 'TENTATIVE'],
      default: 'PENDING',
    },
    notifiedAt: { type: Date, default: null },
  },
  { _id: false }
);

const calendarEventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: [
        'MEETING',
        'DEADLINE',
        'OFFER_EXPIRY',
        'DOCUMENT_DUE',
        'TICKET_DUE',
        'FOLLOWUP',
        'VISA_APPT',
        'EMBASSY_APPT',
        'TALENT_ID',
        'AI_INTERVIEW',
      ],
      required: true,
      index: true,
    },
    sourceModule: { type: String, default: 'calendar' },
    sourceId: { type: mongoose.Schema.Types.ObjectId, default: null },
    startsAt: { type: Date, required: true, index: true },
    endsAt: { type: Date, default: null },
    allDay: { type: Boolean, default: false },
    timezoneRef: { type: String, default: 'Africa/Tunis' },
    color: { type: String, default: '#7B1C2E' },
    status: {
      type: String,
      enum: ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'MISSED'],
      default: 'SCHEDULED',
      index: true,
    },
    priority: {
      type: String,
      enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT'],
      default: 'NORMAL',
    },
    participants: [calendarParticipantSchema],
    candidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate', default: null },
    offerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Offer', default: null },
    agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    location: { type: String, default: '' },
    videoLink: { type: String, default: '' },
    description: { type: String, default: '' },
    recurrence: { type: String, default: null },
    reminders: [{ channel: String, beforeMinutes: Number }],
    cancelledAt: { type: Date, default: null },
  },
  { timestamps: true }
);

calendarEventSchema.index({ agentId: 1, startsAt: 1, endsAt: 1 });
calendarEventSchema.index({ startsAt: 1, endsAt: 1 });

export const CalendarEvent =
  mongoose.models.CalendarEvent || mongoose.model('CalendarEvent', calendarEventSchema);
