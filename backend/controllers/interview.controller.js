import InterviewSession from '../models/interviewSession.js';
import {
  chatCompletion,
  chatCompletionStream,
  INTERVIEW_SYSTEM_PROMPT,
} from '../services/llm.service.js';

function mapLlmError(err) {
  const status = err.statusCode || 500;
  const message =
    status === 503
      ? err.message
      : err.message || 'Unexpected error calling the AI service';
  return { status, message };
}

export const createInterviewSession = async (req, res) => {
  try {
    const title = req.body?.title?.trim?.() || '';
    const candidateName = req.body?.candidateName?.trim?.() || '';
    if (!title) {
      return res
        .status(400)
        .json({ success: false, message: 'title is required' });
    }

    const session = await InterviewSession.create({
      title,
      candidateName,
      status: 'in_progress',
      messages: [{ role: 'system', content: INTERVIEW_SYSTEM_PROMPT }],
    });

    const bootstrapUser = `The interview begins now.
Session / role title (context only): "${title}"
Candidate name: ${candidateName || 'Not provided'}

Your task: Greet the candidate briefly (use their name if provided). Then ask exactly ONE opening interview question. Stay under 100 words.`;

    let assistantText;
    try {
      assistantText = await chatCompletion([
        { role: 'system', content: INTERVIEW_SYSTEM_PROMPT },
        { role: 'user', content: bootstrapUser },
      ]);
    } catch (err) {
      const { status, message } = mapLlmError(err);
      await InterviewSession.findByIdAndDelete(session._id);
      return res.status(status).json({ success: false, message });
    }

    session.messages.push({ role: 'assistant', content: assistantText });
    await session.save();

    return res.status(201).json({ success: true, data: session });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const getInterviewSessions = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status === 'in_progress' || status === 'completed') {
      filter.status = status;
    }
    const skip = (Math.max(1, parseInt(page, 10)) - 1) * Math.min(100, Math.max(1, parseInt(limit, 10)));
    const lim = Math.min(100, Math.max(1, parseInt(limit, 10)));

    const [items, total] = await Promise.all([
      InterviewSession.find(filter)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(lim)
        .select('-messages')
        .lean(),
      InterviewSession.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: items,
      pagination: { total, page: parseInt(page, 10), limit: lim },
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const getInterviewSessionById = async (req, res) => {
  try {
    const session = await InterviewSession.findById(req.params.id).lean();
    if (!session) {
      return res
        .status(404)
        .json({ success: false, message: 'Interview session not found' });
    }
    return res.status(200).json({ success: true, data: session });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const sendInterviewMessage = async (req, res) => {
  try {
    const text = req.body?.text?.trim?.() || '';
    if (!text) {
      return res
        .status(400)
        .json({ success: false, message: 'text is required' });
    }

    const streamReply =
      req.body?.stream === true ||
      req.query?.stream === '1' ||
      req.query?.stream === 'true';

    const session = await InterviewSession.findById(req.params.id);
    if (!session) {
      return res
        .status(404)
        .json({ success: false, message: 'Interview session not found' });
    }
    if (session.status !== 'in_progress') {
      return res.status(400).json({
        success: false,
        message: 'This interview is already completed',
      });
    }

    session.messages.push({ role: 'user', content: text });

    const apiMessages = session.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    if (streamReply) {
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      if (typeof res.flushHeaders === 'function') {
        res.flushHeaders();
      }

      let assistantText;
      try {
        assistantText = await chatCompletionStream(apiMessages, (delta) => {
          res.write(`data: ${JSON.stringify({ delta })}\n\n`);
        });
      } catch (err) {
        session.messages.pop();
        await session.save().catch(() => {});
        const { message } = mapLlmError(err);
        res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
        res.end();
        return;
      }

      session.messages.push({ role: 'assistant', content: assistantText });
      await session.save();
      res.write(
        `data: ${JSON.stringify({
          done: true,
          assistantMessage: assistantText,
        })}\n\n`
      );
      res.end();
      return;
    }

    let assistantText;
    try {
      assistantText = await chatCompletion(apiMessages);
    } catch (err) {
      session.messages.pop();
      const { status, message } = mapLlmError(err);
      return res.status(status).json({ success: false, message });
    }

    session.messages.push({ role: 'assistant', content: assistantText });
    await session.save();

    return res.status(200).json({
      success: true,
      data: {
        assistantMessage: assistantText,
        session,
      },
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const completeInterviewSession = async (req, res) => {
  try {
    const session = await InterviewSession.findById(req.params.id);
    if (!session) {
      return res
        .status(404)
        .json({ success: false, message: 'Interview session not found' });
    }
    if (session.status === 'completed') {
      return res.status(200).json({ success: true, data: session });
    }

    let recruiterSummary = '';
    try {
      const transcript = session.messages
        .filter((m) => m.role !== 'system')
        .map((m) => `${m.role}: ${m.content}`)
        .join('\n\n');
      recruiterSummary = await chatCompletion([
        {
          role: 'system',
          content:
            'You help hiring teams. Write concise evaluator notes (markdown bullet list, max 6 bullets): strengths, risks or gaps, overall fit signal, and suggested next step for recruiters. Be factual; do not invent details not in the transcript.',
        },
        {
          role: 'user',
          content: `Interview transcript:\n\n${transcript || '(no messages)'}`,
        },
      ]);
    } catch {
      recruiterSummary =
        'Automatic summary failed. Recruiters can still read the full transcript below.';
    }

    session.status = 'completed';
    session.completedAt = new Date();
    session.recruiterSummary = recruiterSummary;
    await session.save();

    return res.status(200).json({ success: true, data: session });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};
