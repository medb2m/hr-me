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
  skills: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Skill',
    },
  ],
  image : String,
  dossier: [
    {
      fileType: {
        type: String,
        enum: ['passport', 'cv', 'diploma', 'other'], // Ensure 'other' is included
        required: true,
      },
      filename: { type: String, required: true },
      filepath: { type: String, required: true },
      uploadedAt: { type: Date, default: Date.now },
      status: { type: String, default: 'uploaded' },
    },
  ],
},
{timestamps: true}
);

export default mongoose.model('Candidate', candidateSchema);