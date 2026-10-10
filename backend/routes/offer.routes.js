import express from 'express';
import { createOffer, getOffers, getOfferById, updateOffer, deleteOffer } from '../controllers/offer.controller.js';
import { getPublicOffer, listPublicOffers } from '../controllers/public-offers.controller.js';
import { optionalAuth } from '../middleware/optional-auth.middleware.js';

const router = express.Router();

// Catalogue public (espace client) — publiées et non expirées uniquement.
router.get('/public', optionalAuth, listPublicOffers);
router.get('/public/:id', optionalAuth, getPublicOffer);

// Legacy CRUD
router.post('/', createOffer);
router.get('/', getOffers);
router.get('/:id', getOfferById);
router.put('/:id', updateOffer);
router.delete('/:id', deleteOffer);


export default router;
