import { synthesizeInterviewSpeechMp3 } from '../services/neural-tts.service.js';

/**
 * POST JSON { text } → audio/mpeg (Microsoft neural voice, no API key).
 */
export const postTtsSpeak = async (req, res) => {
  try {
    if (process.env.TTS_EDGE_DISABLE === '1' || process.env.TTS_EDGE_DISABLE === 'true') {
      return res.status(503).json({
        success: false,
        message: 'Neural TTS is disabled (set TTS_EDGE_DISABLE off).',
      });
    }
    const buffer = await synthesizeInterviewSpeechMp3(req.body?.text);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(buffer);
  } catch (err) {
    const status = err.statusCode || 500;
    const message =
      status === 400 ? err.message : err.message || 'TTS synthesis failed';
    return res.status(status).json({ success: false, message });
  }
};
