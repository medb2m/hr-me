import mongoose from 'mongoose';

const offerSchema = new mongoose.Schema({
    name: { type: String, required: true },          // titre de l'offre
    partner: { type: String, required: true },       // entreprise
    companyLogo: { type: String, default: '' },      // /uploads/company-logos/…
    description: { type: String, default: '' },      // HTML riche
    price: { type: Number, default: 0 },

    // Localisation & organisation du poste
    country: {
        code: { type: String, default: '' },         // ISO alpha-2 (FR, IT, QA…)
        name: { type: String, default: '' },
    },
    city: { type: String, default: '' },
    workMode: {
        type: String,
        enum: ['onsite', 'hybrid', 'remote'],
        default: 'onsite',
    },
    openings: { type: Number, default: 1, min: 1 },  // nombre de postes
    skills: [{ type: String }],

    // Conditions affichées sur les cartes publiques
    contract: { type: String, default: '' },         // CDI, CDD 12 mois, Saisonnier…
    salary: { type: String, default: '' },           // « 2 600 – 3 100 € »
    sector: { type: String, default: '' },           // Santé, BTP, IT…
    urgent: { type: Boolean, default: false },       // badge « Urgent »

    // Cycle de vie de la publication
    publishDate: { type: Date },
    deadline: { type: Date },
    status: {
        type: String,
        enum: ['draft', 'published', 'closed'],
        default: 'published',
    },

    // Traçabilité — qui a posté (admin, et plus tard client/agent…)
    postedBy: {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        role: { type: String, default: '' },
        label: { type: String, default: '' },        // snapshot e-mail/nom
    },
    lastModifiedAt: { type: Date },
    lastModifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    positions: [{
        positionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Position', required: true },
        candidatesNeeded: { type: Number, required: true },
        candidatesAchieved: { type: Number, default: 0 }
    }],
    applications: [
      {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Application', 
      },
  ],
},
{timestamps: true}
);

// Virtual to check if the required number of candidates has been achieved for each position
offerSchema.virtual('isAchieved').get(function () {
    return this.positions.every(pos => pos.candidatesAchieved >= pos.candidatesNeeded);
});

// Instance method to add a candidate to a position
offerSchema.methods.addCandidateToPosition = async function (candidateId, positionId) {
    const position = this.positions.find((pos) => pos.positionId.toString() === positionId.toString());
  
    if (!position) {
      throw new Error('Position not found in offer');
    }
  
    if (position.candidatesAchieved >= position.candidatesNeeded) {
      throw new Error('Position is already filled');
    }
  
    position.candidatesAchieved += 1;
    await this.save();
  
    const Candidate = mongoose.model('Candidate');
    await Candidate.findByIdAndUpdate(candidateId, {
      offer: this._id,
      position: positionId,
      status: 'assigned',
    });
};

export const Offer = mongoose.model('Offer', offerSchema);
