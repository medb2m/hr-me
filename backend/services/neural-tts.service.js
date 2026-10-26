import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { EdgeTTS } from 'node-edge-tts';

const MAX_CHARS = 6000;
const GT_CHUNK = 180;
const DEFAULT_LANG = 'en-US';
const GT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

/** BCP-47 → code Google translate_tts (tl). */
function googleTl(lang) {
  const l = String(lang || DEFAULT_LANG).split('-')[0].toLowerCase();
  return ['fr', 'en', 'ar', 'es', 'it', 'de', 'pt', 'pl'].includes(l) ? l : 'en';
}

/** Découpe le texte en morceaux ≤ GT_CHUNK, en cassant aux fins de phrase. */
function chunkText(text) {
  const chunks = [];
  let rest = text;
  while (rest.length > GT_CHUNK) {
    const slice = rest.slice(0, GT_CHUNK + 1);
    const cut = Math.max(
      slice.lastIndexOf('. '),
      slice.lastIndexOf('! '),
      slice.lastIndexOf('? '),
      slice.lastIndexOf(', '),
      slice.lastIndexOf('; '),
      slice.lastIndexOf(' '),
      Math.floor(GT_CHUNK * 0.6)
    );
    chunks.push(rest.slice(0, cut + 1).trim());
    rest = rest.slice(cut + 1).trim();
  }
  if (rest) chunks.push(rest);
  return chunks.filter(Boolean);
}

/** Voix naturelle française via Google Translate TTS (MP3 concaténé). */
async function synthesizeGoogle(text, lang) {
  const tl = googleTl(lang);
  const parts = [];
  for (const c of chunkText(text)) {
    const url =
      'https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&total=1&idx=0&textlen=' +
      c.length +
      '&tl=' +
      tl +
      '&q=' +
      encodeURIComponent(c);
    const res = await fetch(url, { headers: { 'User-Agent': GT_UA } });
    if (!res.ok) {
      const err = new Error(`Google TTS HTTP ${res.status}`);
      err.statusCode = 502;
      throw err;
    }
    parts.push(Buffer.from(await res.arrayBuffer()));
  }
  if (!parts.length) {
    const err = new Error('Empty TTS audio');
    err.statusCode = 502;
    throw err;
  }
  return Buffer.concat(parts);
}

/** Repli Microsoft Edge neural (peut être bloqué selon l'hébergeur). */
async function synthesizeEdge(text, lang) {
  const voice =
    process.env.TTS_EDGE_VOICE?.trim() ||
    (googleTl(lang) === 'fr' ? 'fr-FR-DeniseNeural' : 'en-US-AriaNeural');
  const tts = new EdgeTTS({
    voice,
    lang: String(lang || DEFAULT_LANG),
    outputFormat: 'audio-24khz-96kbitrate-mono-mp3',
    saveSubtitles: false,
    timeout: 20000,
  });
  const tmp = path.join(
    os.tmpdir(),
    `hr-me-tts-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.mp3`
  );
  try {
    await tts.ttsPromise(text, tmp);
    return await fs.readFile(tmp);
  } finally {
    await fs.unlink(tmp).catch(() => {});
  }
}

export async function synthesizeInterviewSpeechMp3(text, lang) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) {
    const err = new Error('text is required');
    err.statusCode = 400;
    throw err;
  }
  if (trimmed.length > MAX_CHARS) {
    const err = new Error(`text exceeds ${MAX_CHARS} characters`);
    err.statusCode = 400;
    throw err;
  }
  const spokenLang =
    String(lang || process.env.TTS_VOICE_LANG?.trim() || DEFAULT_LANG).trim() ||
    DEFAULT_LANG;

  if (process.env.TTS_EDGE_DISABLE !== '1' && process.env.TTS_EDGE_DISABLE !== 'true') {
    try {
      return await synthesizeGoogle(trimmed, spokenLang);
    } catch { /* fallback below */ }
    try {
      return await synthesizeEdge(trimmed, spokenLang);
    } catch { /* handled below */ }
  }
  const err = new Error('TTS synthesis failed');
  err.statusCode = 502;
  throw err;
}
