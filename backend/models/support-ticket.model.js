import mongoose from 'mongoose';

/**
 * Ticket — module 09 (support candidats/clients + tickets internes agents/admins).
 * `kind` distingue la demande support utilisateur du ticket de travail interne.
 */
const attachmentSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true },
    path: { type: String, required: true },
    originalName: { type: String, default: '' },
    mime: { type: String, default: '' },
    size: { type: Number, default: 0 },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const commentSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    authorName: { type: String, default: '' },
    authorRole: { type: String, default: '' },
    body: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const historySchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    changedByName: { type: String, default: '' },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const ticketSchema = new mongoose.Schema(
  {
    subject: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    /** support = demande candidat/client ; internal = ticket de travail équipe. */
    kind: { type: String, enum: ['support', 'internal'], required: true, index: true },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'waiting', 'resolved', 'closed'],
      default: 'open',
      index: true,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
      index: true,
    },
    category: { type: String, default: 'general', index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    createdByName: { type: String, default: '' },
    createdByRole: { type: String, default: '' },
    createdByEmail: { type: String, default: '' },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    assignedToName: { type: String, default: '' },
    attachments: { type: [attachmentSchema], default: [] },
    comments: { type: [commentSchema], default: [] },
    history: { type: [historySchema], default: [] },
    resolvedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

ticketSchema.index({ kind: 1, status: 1, priority: -1, createdAt: -1 });

export const SupportTicket =
  mongoose.models.SupportTicket || mongoose.model('SupportTicket', ticketSchema);
