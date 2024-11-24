import mongoose from 'mongoose';

const offerSchema = new mongoose.Schema({
    name: { type: String, required: true },
    partner: { type: String, required: true },
    description: { type: String },
    price: { type: Number, required: true },
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
