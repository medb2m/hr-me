import mongoose from 'mongoose';

const candidateSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: Number, required: true },
  passportNumber: { type: String, unique: true },
  cin: { type: String, unique: true },
  offers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Offer' }],
  position: { type: mongoose.Schema.Types.ObjectId, ref: 'Position' },
  status: { type: String, default: 'waiting' },
  experience: Number,
  skills: [String],
  image : String
},
{timestamps: true}
);

export default mongoose.model('Candidate', candidateSchema);