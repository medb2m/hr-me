import mongoose from 'mongoose';

const meetingChatSchema = new mongoose.Schema(
  {
    meetingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Meeting', required: true, index: true },
    roomId: { type: String, required: true, index: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    senderName: { type: String, trim: true, default: '' },
    senderAvatar: { type: String, default: '' },
    content: { type: String, default: '', maxlength: 4000 },
    imageUrl: { type: String, default: '' },
    sentAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

meetingChatSchema.index({ roomId: 1, createdAt: 1 });

export const MeetingChat =
  mongoose.models.MeetingChat || mongoose.model('MeetingChat', meetingChatSchema);
