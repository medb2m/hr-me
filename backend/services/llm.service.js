/**
 * OpenAI-compatible chat (works with Groq, OpenAI, many providers).
 * Default: Groq — free tier at https://console.groq.com
 */

const DEFAULT_BASE = 'https://api.groq.com/openai/v1';
const DEFAULT_MODEL = 'llama-3.3-70b-versatile';

export function assertLlmConfigured() {
  const key = process.env.LLM_API_KEY;
  if (!key?.trim()) {
    const err = new Error(
      'LLM_API_KEY is missing. Set it in backend/.env (see LLM setup in Groq or OpenAI dashboard).'
    );
    err.statusCode = 503;
    throw err;
  }
}

/**
 * @param {{ role: string; content: string }[]} messages
 * @returns {Promise<string>} assistant plain text
 */
export async function chatCompletion(messages) {
  assertLlmConfigured();
  const apiKey = process.env.LLM_API_KEY.trim();
  const baseUrl = (process.env.LLM_BASE_URL || DEFAULT_BASE).replace(/\/$/, '');
  const model = process.env.LLM_MODEL || DEFAULT_MODEL;

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.65,
      max_tokens: 1024,
    }),
  });

  const raw = await res.text();
  if (!res.ok) {
    const err = new Error(raw || `LLM HTTP ${res.status}`);
    err.statusCode = res.status === 401 ? 401 : 502;
    throw err;
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    const err = new Error('Invalid LLM response');
    err.statusCode = 502;
    throw err;
  }

  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) {
    const err = new Error('Empty LLM response');
    err.statusCode = 502;
    throw err;
  }
  return text;
}

/**
 * Streaming chat (OpenAI-compatible SSE). Invokes onDelta for each content chunk.
 * @param {{ role: string; content: string }[]} messages
 * @param {(chunk: string) => void} onDelta
 * @returns {Promise<string>} full assistant text
 */
export async function chatCompletionStream(messages, onDelta) {
  assertLlmConfigured();
  const apiKey = process.env.LLM_API_KEY.trim();
  const baseUrl = (process.env.LLM_BASE_URL || DEFAULT_BASE).replace(/\/$/, '');
  const model = process.env.LLM_MODEL || DEFAULT_MODEL;

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.65,
      max_tokens: 1024,
      stream: true,
    }),
  });

  if (!res.ok) {
    const raw = await res.text();
    const err = new Error(raw || `LLM HTTP ${res.status}`);
    err.statusCode = res.status === 401 ? 401 : 502;
    throw err;
  }

  if (!res.body?.getReader) {
    const err = new Error('Streaming not supported by LLM response');
    err.statusCode = 502;
    throw err;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let lineBuf = '';
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    lineBuf += decoder.decode(value, { stream: true });
    const parts = lineBuf.split('\n');
    lineBuf = parts.pop() ?? '';

    for (const line of parts) {
      const trimmed = line.replace(/\r$/, '').trim();
      if (!trimmed.startsWith('data:')) {
        continue;
      }
      const payload = trimmed.slice(5).trim();
      if (payload === '[DONE]') {
        continue;
      }
      try {
        const json = JSON.parse(payload);
        const delta = json.choices?.[0]?.delta?.content;
        if (typeof delta === 'string' && delta.length) {
          fullText += delta;
          onDelta(delta);
        }
      } catch {
        /* ignore malformed chunks */
      }
    }
  }

  const tail = lineBuf.replace(/\r$/, '').trim();
  if (tail.startsWith('data:')) {
    const payload = tail.slice(5).trim();
    if (payload !== '[DONE]') {
      try {
        const json = JSON.parse(payload);
        const delta = json.choices?.[0]?.delta?.content;
        if (typeof delta === 'string' && delta.length) {
          fullText += delta;
          onDelta(delta);
        }
      } catch {
        /* noop */
      }
    }
  }

  const out = fullText.trim();
  if (!out) {
    const err = new Error('Empty streamed LLM response');
    err.statusCode = 502;
    throw err;
  }
  return out;
}

export const INTERVIEW_SYSTEM_PROMPT = `You are a professional recruiter conducting a structured job interview by voice.
Rules:
- Respond with spoken, natural language (this will be read aloud to the candidate).
- Ask ONE clear question at a time unless you are giving a brief acknowledgment (one short sentence) before the next question.
- Keep each reply under about 120 words.
- Listen to the candidate's answers and adapt follow-up questions to what they said.
- After roughly 4–6 meaningful Q&A turns from the candidate (not counting your greetings), wrap up: thank them, invite any brief final question from them, then close politely.
- Never invent credentials or job offers; stay neutral and professional.
- If the candidate goes off-topic, steer back gently.`;
