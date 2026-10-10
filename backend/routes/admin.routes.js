import { Router } from 'express';
import { requireAdmin } from '../middleware/admin-auth.middleware.js';
import * as users from '../controllers/admin-users.controller.js';
import * as offers from '../controllers/admin-offers.controller.js';
import * as applications from '../controllers/admin-applications.controller.js';
import { uploadCompanyLogo } from '../middleware/company-logo.multer.js';
import { deleteContact, listContacts, updateContact } from '../controllers/contact.controller.js';

/** Routes API réservées admin (JWT + rôle admin). */
const router = Router();

router.use(requireAdmin);

router.get('/health', (_req, res) => {
  res.json({ ok: true, scope: 'admin-api' });
});

router.get('/users/stats', users.userStats);
router.get('/users', users.listUsers);
router.post('/users', users.createUser);
router.put('/users/:id', users.updateUser);
router.delete('/users/:id', users.deleteUser);

router.get('/contacts', listContacts);
router.put('/contacts/:id', updateContact);
router.delete('/contacts/:id', deleteContact);

// Gestion des offres d'emploi (admin)
router.post('/offers/logo', uploadCompanyLogo.single('logo'), offers.uploadLogo);
router.post('/offers/generate-description', offers.generateDescription);
router.post('/offers/suggest-skills', offers.suggestSkills);
router.get('/offers', offers.listOffers);
router.post('/offers', offers.createOffer);
router.get('/offers/:id', offers.getOffer);
router.put('/offers/:id', offers.updateOffer);
router.delete('/offers/:id', offers.deleteOffer);

// Candidatures (admin) — par offre, détail, changement de statut
router.get('/offers/:id/applications', applications.listOfferApplications);
router.get('/applications/:id', applications.getApplication);
router.put('/applications/:id', applications.updateApplication);

export default router;
