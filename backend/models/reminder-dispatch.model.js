import mongoose from 'mongoose';

/** Dedup key per meeting + reminder window (e.g. `mId:1440` for 24h). */
const reminderDispatchSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    meetingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Meeting' },
  },
  { timestamps: true }
);

reminderDispatchSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 * 4 });

export const ReminderDispatch =
  mongoose.models.ReminderDispatch || mongoose.model('ReminderDispatch', reminderDispatchSchema);
