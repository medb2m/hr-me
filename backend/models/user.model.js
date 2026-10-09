import mongoose from 'mongoose';

/**
 * Self-service sign-ups use role `client`.
 * `admin`, `recruiter`, and `candidate` are created by administrators (not via public register).
 * Détails profil candidat (prénom, parcours, etc.) : modèle `ClientProfile` lié par `user`.
 */
const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true },
    name: { type: String, trim: true, default: '' },
    role: {
      type: String,
      enum: ['client', 'admin', 'candidate', 'recruiter'],
      default: 'client',
    },
    emailVerified: { type: Boolean, default: false },
    emailVerifyToken: { type: String, default: null },
    emailVerifyExpires: { type: Date, default: null },
    passwordResetToken: { type: String, default: null },
    passwordResetExpires: { type: Date, default: null },
    /** Email change flow: new address stays pending until confirmed via link. */
    pendingEmail: { type: String, lowercase: true, trim: true, default: null },
    emailChangeToken: { type: String, default: null },
    emailChangeExpires: { type: Date, default: null },
    /** IANA zone for calendar / meeting display (e.g. Africa/Tunis). */
    timeZone: { type: String, trim: true, default: null },
  },
  { timestamps: true }
);

export const User = mongoose.models.User || mongoose.model('User', userSchema);
