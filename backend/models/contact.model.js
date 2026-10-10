import mongoose from 'mongoose';

/** Message envoyé via le formulaire de contact public (page /contact). */
const contactSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 190 },
    phone: { type: String, trim: true, maxlength: 40, default: '' },
    /** Entreprise (optionnel — ex. demande de partenariat). */
    company: { type: String, trim: true, maxlength: 140, default: '' },
    subject: { type: String, trim: true, maxlength: 140, default: '' },
    message: { type: String, required: true, trim: true, maxlength: 5000 },
    /** 'new' | 'archived' — boîte de réception admin. */
    status: { type: String, enum: ['new', 'archived'], default: 'new', index: true },
  },
  { timestamps: true }
);

contactSchema.index({ createdAt: -1 });

export const Contact = mongoose.model('Contact', contactSchema);
