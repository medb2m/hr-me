import { Position } from '../models/position.js';

export const createPosition = async (req, res) => {
    try {
        const position = new Position(req.body);
        await position.save();
        res.status(201).json(position);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

export const getPositions = async (req, res) => {
    try {
        const positions = await Position.find();
        res.status(200).json(positions);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};
