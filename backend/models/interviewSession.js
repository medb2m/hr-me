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

const topicScoreSchema = new mongoose.Schema(
  {
    topic: { type: String, default: '' },
    score: { type: Number, default: null },
    comment: { type: String, default: '' },
  },
  { _id: false }
);

const interviewSessionSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    candidateName: { type: String, default: '', trim: true },

    // Personne affectée (compte ou simple e-mail)
    assignee: {
      name: { type: String, default: '', trim: true },
      email: { type: String, default: '', trim: true, lowercase: true },
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    },

    // Thèmes/points sur lesquels l'IA doit insister
    topics: { type: [String], default: [] },
    instructions: { type: String, default: '', trim: true },

    // Planification + fenêtre de passage (ex. 48 h)
    scheduledAt: { type: Date, default: null },
    deadlineHours: { type: Number, default: null },
    expiresAt: { type: Date, default: null },

    templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'InterviewTemplate', default: null },
    isDemo: { type: Boolean, default: false },
    inviteToken: { type: String, default: '', index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'expired'],
      default: 'pending',
    },
    messages: { type: [messageSchema], default: [] },
    completedAt: { type: Date },
    recruiterSummary: { type: String, default: '' },

    // Évaluation IA : avis + note par sujet (bouton « Résumé »)
    evaluation: {
      summary: { type: String, default: '' },
      overall: { type: Number, default: null },
      topics: { type: [topicScoreSchema], default: [] },
      generatedAt: { type: Date, default: null },
    },

    // Note manuelle du recruteur (liste, tri, évaluation globale)
    review: {
      score: { type: Number, default: null },
      comment: { type: String, default: '' },
      updatedAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

export default mongoose.model('InterviewSession', interviewSessionSchema);
