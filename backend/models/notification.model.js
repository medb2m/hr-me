import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    recipientRole: { type: String, default: '' },
    type: { type: String, required: true, index: true },
    category: {
      type: String,
      enum: [
        'MEETING',
        'CALENDAR',
        'DOCUMENT',
        'CANDIDATE',
        'OFFER',
        'TICKET',
        'MESSAGE',
        'SYSTEM',
        'TALENT_ID',
      ],
      default: 'SYSTEM',
      index: true,
    },
    priority: {
      type: String,
      enum: ['SILENT', 'LOW', 'NORMAL', 'HIGH', 'URGENT', 'CRITICAL'],
      default: 'NORMAL',
    },
    title: { type: String, required: true },
    body: { type: String, default: '' },
    actionUrl: { type: String, default: null },
    actionLabel: { type: String, default: null },
    icon: { type: String, default: 'bell' },
    color: { type: String, default: '#7B1C2E' },
    sourceModule: { type: String, default: '' },
    sourceId: { type: mongoose.Schema.Types.ObjectId, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    sound: { type: String, default: 'chime_medium' },
    read: { type: Boolean, default: false, index: true },
    readAt: { type: Date, default: null },
    dismissed: { type: Boolean, default: false },
    dismissedAt: { type: Date, default: null },
    groupedKey: { type: String, default: null },
    expiresAt: { type: Date, default: null },
    snoozeUntil: { type: Date, default: null },
    deliveredVia: [{ type: String }],
  },
  { timestamps: true }
);

notificationSchema.index({ recipientId: 1, read: 1, createdAt: -1 });
notificationSchema.index({ recipientId: 1, dismissed: 1, snoozeUntil: 1, createdAt: -1 });

export const Notification =
  mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
