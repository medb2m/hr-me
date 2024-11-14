import mongoose from 'mongoose';

const candidateSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: Number, required: true },
  offer: String,
  position: String,
  status: { type: String, default: 'waiting' },
  experience: Number,
  skills: [String],
  image : String
});

export default mongoose.model('Candidate', candidateSchema);
