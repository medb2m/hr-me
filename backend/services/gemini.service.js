/**
 * Gemini (AI Studio free tier) — analyse multimodale de documents.
 * PDF et images sont lus nativement (y compris scans) ; les textes extraits
 * (DOCX/ODT/DOC) sont envoyés en `text`. AUCUN repli payant : pas de clé → 503.
 */

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-3.1-flash-lite';
/** Repli si le modèle principal est saturé (free tier, erreurs 429/503). */
const FALLBACK_MODELS = ['gemini-3.1-flash-lite', 'gemini-3.7-flash', 'gemini-3.5-flash'];

export function assertGeminiConfigured() {
  if (!process.env.GEMINI_API_KEY?.trim()) {
    const err = new Error('GEMINI_API_KEY is missing in backend/.env');
    err.statusCode = 503;
    throw err;
  }
}

const ANALYSIS_PROMPT = `Tu analyses un document fourni par un candidat sur une plateforme de recrutement international.
Lis le document et réponds UNIQUEMENT avec un objet JSON (pas de markdown, pas de texte autour) :
{
  "title": "titre court et clair du document en français (ex. « Diplôme de technicien en soudure »)",
  "docType": "un parmi : diploma | certificate | attestation | id | cv | contract | other",
  "issuer": "organisme/école/employeur émetteur ou null",
  "holder": "nom du titulaire du document ou null",
  "issueDate": "date d'émission/d'obtention au format YYYY-MM-DD ou null",
  "expiryDate": "date d'expiration au format YYYY-MM-DD ou null",
  "summary": "résumé factuel en français, 1 à 2 phrases (ce que le document atteste)",
  "keywords": ["3 à 6 mots-clés métier/compétences présents dans le document"]
}
Règles : n'invente rien — si une info est illisible mets null ; title jamais null (déduis-le du contenu).`;

function extractJson(raw) {
  const m = String(raw || '').match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const o = JSON.parse(m[0]);
    return {
      title: String(o.title || '').trim().slice(0, 200) || null,
      docType: String(o.docType || 'other').trim().slice(0, 30),
      issuer: String(o.issuer || '').trim().slice(0, 120) || null,
      holder: String(o.holder || '').trim().slice(0, 120) || null,
      issueDate: /^\d{4}-\d{2}-\d{2}$/.test(o.issueDate) ? o.issueDate : null,
      expiryDate: /^\d{4}-\d{2}-\d{2}$/.test(o.expiryDate) ? o.expiryDate : null,
      summary: String(o.summary || '').trim().slice(0, 600) || null,
      keywords: (Array.isArray(o.keywords) ? o.keywords : [])
        .map((k) => String(k).trim().slice(0, 40))
        .filter(Boolean)
        .slice(0, 8),
    };
  } catch {
    return null;
  }
}

async function callGeminiOnce(model, parts) {
  const res = await fetch(
    `${GEMINI_BASE}/${model}:generateContent?key=${process.env.GEMINI_API_KEY.trim()}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 800 },
      }),
    },
  );
  const raw = await res.text();
  if (!res.ok) {
    const err = new Error(`Gemini HTTP ${res.status}: ${raw.slice(0, 300)}`);
    err.statusCode = res.status === 401 || res.status === 403 ? 401 : res.status;
    err.retryable = res.status === 429 || res.status === 503;
    throw err;
  }
  return raw;
}

/** Modèle configuré puis replis — le free tier sature parfois (429/503). */
async function callGemini(parts) {
  assertGeminiConfigured();
  const primary = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  const models = [primary, ...FALLBACK_MODELS.filter((m) => m !== primary)];
  let lastErr = null;
  for (const model of models) {
    try {
      const raw = await callGeminiOnce(model, parts);
      return parseText(raw);
    } catch (err) {
      lastErr = err;
      if (!err.retryable) {
        break;
      }
      console.warn(`[gemini] ${model} saturé (${err.statusCode}) — repli…`);
    }
  }
  throw lastErr;
}

function parseText(raw) {
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    const err = new Error('Réponse Gemini invalide.');
    err.statusCode = 502;
    throw err;
  }
  const text = data?.candidates?.[0]?.content?.parts
    ?.map((p) => p.text || '')
    .join('')
    .trim();
  if (!text) {
    const err = new Error('Réponse Gemini vide (document illisible ou bloqué).');
    err.statusCode = 502;
    throw err;
  }
  return text;
}

/**
 * Analyse un fichier binaire (PDF ou image) — envoi en inline_data base64.
 * @param {Buffer} buffer
 * @param {string} mime
 */
export async function analyzeDocumentBuffer(buffer, mime) {
  const text = await callGemini([
    { text: ANALYSIS_PROMPT },
    { inlineData: { mimeType: mime, data: buffer.toString('base64') } },
  ]);
  return extractJson(text);
}

/**
 * Analyse un texte extrait (DOCX/ODT/DOC via mammoth ou brut).
 * @param {string} docText
 */
export async function analyzeDocumentText(docText) {
  const text = await callGemini([
    { text: ANALYSIS_PROMPT },
    { text: `CONTENU DU DOCUMENT :\n${docText.slice(0, 12000)}` },
  ]);
  return extractJson(text);
}
