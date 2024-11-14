import mongoose from 'mongoose';

const positionSchema = new mongoose.Schema({
    name: { type: String, required: true }
});

export const Position = mongoose.model('Position', positionSchema);