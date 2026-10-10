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

export default router;
