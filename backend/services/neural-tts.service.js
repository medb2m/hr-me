import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { EdgeTTS } from 'node-edge-tts';

const MAX_CHARS = 6000;

/**
 * Free neural TTS via the same Microsoft Edge online service (no API key).
 * Voice list: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts
 */
export async function synthesizeInterviewSpeechMp3(text) {
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

  const voice =
    process.env.TTS_EDGE_VOICE?.trim() || 'en-US-AriaNeural';
  const lang = process.env.TTS_EDGE_LANG?.trim() || 'en-US';

  const tts = new EdgeTTS({
    voice,
    lang,
    outputFormat: 'audio-24khz-96kbitrate-mono-mp3',
    saveSubtitles: false,
    timeout: 60000,
  });

  const tmp = path.join(
    os.tmpdir(),
    `hr-me-tts-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.mp3`
  );

  try {
    await tts.ttsPromise(trimmed, tmp);
    const buffer = await fs.readFile(tmp);
    return buffer;
  } finally {
    await fs.unlink(tmp).catch(() => {});
  }
}
