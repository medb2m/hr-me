import { Offer } from '../models/offer.js';
import { Position } from '../models/position.js';

export const createOffer = async (req, res) => {
    try {
        const offer = new Offer(req.body);
        await offer.save();
        res.status(201).json(offer);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

export const getOffers = async (req, res) => {
    try {
        const offers = await Offer.find().populate('positions.positionId').populate('applications');
        res.status(200).json(offers);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

export const getOfferById = async (req, res) => {
    try {
        const offer = await Offer.findById(req.params.id).populate('positions.positionId').populate('applications');
        if (!offer) return res.status(404).json({ error: 'Offer not found' });
        res.status(200).json(offer);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

export const updateOffer = async (req, res) => {
    try {
        const offer = await Offer.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.status(200).json(offer);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

export const deleteOffer = async (req, res) => {
    try {
        await Offer.findByIdAndDelete(req.params.id);
        res.status(204).end();
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

