import mongoose from 'mongoose';

const applicationSchema = new mongoose.Schema({
  candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate', required: true },
  offer: { type: mongoose.Schema.Types.ObjectId, ref: 'Offer', required: true },
  position: { type: mongoose.Schema.Types.ObjectId, ref: 'Position', required: true },
  status: { type: String, default: 'applied' }, // e.g., 'applied', 'interviewing', 'rejected', 'hired'
  appliedAt: { type: Date, default: Date.now },
  notes: { type: String }, // Additional notes for the application
});

// Ensure uniqueness of candidate-offer-position combinations
applicationSchema.index({ candidate: 1, offer: 1, position: 1 }, { unique: true });

export const Application = mongoose.model('Application', applicationSchema);
