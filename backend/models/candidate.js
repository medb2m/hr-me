import mongoose from 'mongoose';

const candidateSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  position: String,
  status: { type: String, default: 'waiting' },
  experience: Number,
  skills: [String],
});

export default mongoose.model('Candidate', candidateSchema);
