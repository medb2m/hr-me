import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { chatCompletion } from '../services/llm.service.js';

const router = Router();

const CORRECT_SYSTEM = `Tu es un correcteur linguistique professionnel (français par défaut, conserve la langue du texte).
Corrige l'orthographe, la grammaire, la ponctuation et la typographie du texte reçu.
Règles :
- Si le texte contient des balises HTML, conserve-les EXACTEMENT telles quelles (mêmes balises, mêmes attributs) — corrige uniquement le texte visible.
- Ne change ni le sens, ni le ton, ni la structure.
- Réponds UNIQUEMENT avec le texte corrigé, sans commentaire ni explication.`;

/**
 * POST /api/ai/correct-text — correction orthographique/grammaticale (LLM Groq).
 * Body: { text } — texte brut ou HTML. Réponse: { corrected }.
 */
router.post('/correct-text', requireAuth, async (req, res) => {
  try {
    const text = String(req.body?.text ?? '');
    if (!text.trim()) {
      return res.status(400).json({ message: 'Aucun texte à corriger.' });
    }
    if (text.length > 20000) {
      return res.status(400).json({ message: 'Texte trop long (20 000 caractères max).' });
    }
    const corrected = await chatCompletion([
      { role: 'system', content: CORRECT_SYSTEM },
      { role: 'user', content: text },
    ]);
    return res.json({ corrected });
  } catch (err) {
    console.error('[ai/correct-text]', err);
    const status = err.statusCode || 500;
    return res.status(status).json({ message: err.message || 'Correction impossible.' });
  }
});

const LETTER_SYSTEM = `Tu es un rédacteur professionnel de lettres de motivation pour une agence de placement international.
Rédige le CORPS d'une lettre de motivation en français (ou dans la langue demandée explicitement).
Règles :
- Réponds UNIQUEMENT avec le corps de la lettre en HTML : des paragraphes <p>…</p> (4 à 6 paragraphes).
- PAS de balise d'en-tête, PAS d'objet, PAS de salutation, PAS de formule de politesse finale, PAS de signature — ils sont gérés séparément.
- Ton professionnel, concret, orienté international ; paragraphes courts et dynamiques.
- N'invente pas de diplômes ni d'employeurs précis ; utilise uniquement les informations fournies et reste générique sinon.`;

/**
 * POST /api/ai/generate-letter — génère le corps d'une lettre de motivation.
 * Body: { prompt?, jobTitle?, companyName?, candidateName?, userName? }. Réponse: { letter } (HTML <p>).
 */
router.post('/generate-letter', requireAuth, async (req, res) => {
  try {
    const prompt = String(req.body?.prompt || '').trim().slice(0, 2000);
    const jobTitle = String(req.body?.jobTitle || '').trim().slice(0, 160);
    const companyName = String(req.body?.companyName || '').trim().slice(0, 160);
    const candidateName = String(req.body?.candidateName || '').trim().slice(0, 160);
    const userName = String(req.body?.userName || '').trim().slice(0, 160);
    const ctx = [
      candidateName ? `Candidat : ${candidateName}.` : '',
      userName ? `Compte : ${userName}.` : '',
      jobTitle ? `Poste visé : ${jobTitle}.` : '',
      companyName ? `Entreprise destinataire : ${companyName}.` : '',
      prompt ? `Instructions : ${prompt}` : 'Rédige une lettre convaincante et professionnelle.',
    ]
      .filter(Boolean)
      .join('\n');
    const letter = await chatCompletion([
      { role: 'system', content: LETTER_SYSTEM },
      { role: 'user', content: ctx },
    ]);
    return res.json({ letter });
  } catch (err) {
    console.error('[ai/generate-letter]', err);
    const status = err.statusCode || 500;
    return res.status(status).json({ message: err.message || 'Génération impossible.' });
  }
});

export default router;
