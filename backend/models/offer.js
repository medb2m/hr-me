import mongoose from 'mongoose';

const offerSchema = new mongoose.Schema({
    name: { type: String, required: true },
    partner: { type: String, required: true },
    description: { type: String },
    positions: [{
        positionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Position', required: true },
        candidatesNeeded: { type: Number, required: true },
        candidatesAchieved: { type: Number, default: 0 }
    }]
});

// Virtual to check if the required number of candidates has been achieved for each position
offerSchema.virtual('isAchieved').get(function () {
    return this.positions.every(pos => pos.candidatesAchieved >= pos.candidatesNeeded);
});

export const Offer = mongoose.model('Offer', offerSchema);
