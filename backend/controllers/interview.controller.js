import crypto from 'crypto';
import mongoose from 'mongoose';
import InterviewSession from '../models/interviewSession.js';
import InterviewTemplate from '../models/interview-template.model.js';
import { CalendarEvent } from '../models/calendar-event.model.js';
import { User } from '../models/user.model.js';
import {
  chatCompletion,
  chatCompletionStream,
  INTERVIEW_SYSTEM_PROMPT,
} from '../services/llm.service.js';
import { emitNotification } from '../services/notification.service.js';
import { isSmtpConfigured, sendInterviewInviteEmail } from '../email/mailer.js';
import { getFrontendBaseUrl } from '../config/public-url.js';

function mapLlmError(err) {
  const status = err.statusCode || 500;
  const message =
    status === 503
      ? err.message
      : err.message || 'Unexpected error calling the AI service';
  return { status, message };
}

const toStr = (v) => String(v ?? '').trim();

function normalizeTopics(raw) {
  const arr = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(/\r?\n/) : [];
  return arr.map((t) => String(t).trim()).filter(Boolean).slice(0, 20);
}

/** Session sans les messages système (vue candidat / pass invité). */
function publicSession(s) {
  const o = s.toObject ? s.toObject() : s;
  return {
    _id: o._id,
    title: o.title,
    candidateName: o.candidateName,
    topics: o.topics || [],
    scheduledAt: o.scheduledAt,
    deadlineHours: o.deadlineHours,
    expiresAt: o.expiresAt,
    status: o.status,
    messages: (o.messages || []).filter((m) => m.role !== 'system'),
    completedAt: o.completedAt,
    createdAt: o.createdAt,
  };
}

/** Marque 'expired' si la fenêtre de passage est dépassée. */
async function expireIfNeeded(session) {
  if (
    session &&
    session.expiresAt &&
    ['pending', 'in_progress'].includes(session.status) &&
    new Date() > new Date(session.expiresAt)
  ) {
    session.status = 'expired';
    await session.save();
  }
  return session;
}

function bootstrapUserPrompt(session) {
  const topics = (session.topics || []).length
    ? `\nTopics the interviewer MUST cover during this session:\n${session.topics.map((t) => `- ${t}`).join('\n')}`
    : '';
  const instr = session.instructions
    ? `\nAdditional instructions for the interviewer: ${session.instructions}`
    : '';
  return `The interview begins now.
Session / role title (context only): "${session.title}"
Candidate name: ${session.assignee?.name || session.candidateName || 'Not provided'}
${topics}${instr}

Your task: Greet the candidate briefly (use their name if provided). Then ask exactly ONE opening interview question. Stay under 100 words.`;
}

// ══════════════════════════════════════════════════════════════
//  TEMPLATES — réutilisables à chaque nouvelle session
// ══════════════════════════════════════════════════════════════

export const listTemplates = async (_req, res) => {
  try {
    const items = await InterviewTemplate.find().sort({ createdAt: -1 }).lean();
    // Nombre de sessions ayant utilisé chaque template
    const counts = await InterviewSession.aggregate([
      { $match: { templateId: { $ne: null } } },
      { $group: { _id: '$templateId', count: { $sum: 1 } } },
    ]);
    const byId = new Map(counts.map((c) => [String(c._id), c.count]));
    return res.json({
      success: true,
      data: items.map((t) => ({ ...t, usageCount: byId.get(String(t._id)) || 0 })),
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const createTemplate = async (req, res) => {
  try {
    const name = toStr(req.body?.name);
    const title = toStr(req.body?.title);
    if (!name || !title) {
      return res.status(400).json({ success: false, message: 'name and title are required' });
    }
    const tpl = await InterviewTemplate.create({
      name,
      title,
      topics: normalizeTopics(req.body?.topics),
      instructions: toStr(req.body?.instructions),
      deadlineHours: Number(req.body?.deadlineHours) || 48,
      createdBy: req.user?.id || null,
    });
    return res.status(201).json({ success: true, data: tpl });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const updateTemplate = async (req, res) => {
  try {
    const patch = {};
    for (const k of ['name', 'title', 'instructions']) {
      if (req.body?.[k] !== undefined) patch[k] = toStr(req.body[k]);
    }
    if (req.body?.topics !== undefined) patch.topics = normalizeTopics(req.body.topics);
    if (req.body?.deadlineHours !== undefined) {
      patch.deadlineHours = Number(req.body.deadlineHours) || 48;
    }
    const tpl = await InterviewTemplate.findByIdAndUpdate(req.params.id, patch, { new: true });
    if (!tpl) return res.status(404).json({ success: false, message: 'Template not found' });
    return res.json({ success: true, data: tpl });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const deleteTemplate = async (req, res) => {
  try {
    const tpl = await InterviewTemplate.findByIdAndDelete(req.params.id);
    if (!tpl) return res.status(404).json({ success: false, message: 'Template not found' });
    return res.json({ success: true });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// ══════════════════════════════════════════════════════════════
//  SESSIONS
// ══════════════════════════════════════════════════════════════

export const createInterviewSession = async (req, res) => {
  try {
    const title = toStr(req.body?.title);
    const candidateName = toStr(req.body?.candidateName);
    const isDemo = req.body?.isDemo === true;
    if (!title) {
      return res.status(400).json({ success: false, message: 'title is required' });
    }

    // Résolution éventuelle du template (titre/topics/délai hérités)
    let template = null;
    if (req.body?.templateId && mongoose.isValidObjectId(req.body.templateId)) {
      template = await InterviewTemplate.findById(req.body.templateId).lean();
    }

    const topics = normalizeTopics(req.body?.topics).length
      ? normalizeTopics(req.body?.topics)
      : template?.topics || [];
    const instructions = toStr(req.body?.instructions) || template?.instructions || '';
    const deadlineHours = Number(req.body?.deadlineHours) || template?.deadlineHours || null;
    const scheduledAt = req.body?.scheduledAt ? new Date(req.body.scheduledAt) : null;
    const assignee = {
      name: toStr(req.body?.assigneeName) || candidateName,
      email: toStr(req.body?.assigneeEmail).toLowerCase(),
      userId: null,
    };

    // Chercher un compte lié à l'e-mail (notification in-app + espace « À faire »)
    let assigneeUser = null;
    if (assignee.email) {
      assigneeUser = await User.findOne({ email: assignee.email }).select('_id name email role').lean();
      if (assigneeUser) {
        assignee.userId = assigneeUser._id;
        if (!assignee.name) assignee.name = assigneeUser.name || '';
      }
    }

    const session = await InterviewSession.create({
      title,
      candidateName: candidateName || assignee.name,
      assignee,
      topics,
      instructions,
      scheduledAt: scheduledAt && !isNaN(scheduledAt) ? scheduledAt : null,
      deadlineHours,
      expiresAt: deadlineHours ? new Date(Date.now() + deadlineHours * 3600000) : null,
      templateId: template?._id || null,
      isDemo,
      inviteToken: crypto.randomBytes(20).toString('hex'),
      createdBy: req.user?.id || null,
      status: isDemo ? 'in_progress' : 'pending',
      messages: [{ role: 'system', content: INTERVIEW_SYSTEM_PROMPT }],
    });

    // Démo : la session démarre tout de suite avec le message d'accueil de l'IA
    if (isDemo) {
      try {
        const assistantText = await chatCompletion(
          [
            { role: 'system', content: INTERVIEW_SYSTEM_PROMPT },
            { role: 'user', content: bootstrapUserPrompt(session) },
          ],
          { pool: 'interview' }
        );
        session.messages.push({ role: 'assistant', content: assistantText });
        await session.save();
      } catch (err) {
        const { status, message } = mapLlmError(err);
        await InterviewSession.findByIdAndDelete(session._id);
        return res.status(status).json({ success: false, message });
      }
      return res.status(201).json({ success: true, data: session });
    }

    // Session réelle : e-mail d'invitation + notification + événement calendrier
    const passUrl = `${getFrontendBaseUrl()}/interview/pass/${session.inviteToken}`;
    if (assignee.email && isSmtpConfigured()) {
      sendInterviewInviteEmail({
        to: assignee.email,
        name: assignee.name,
        title,
        topics,
        deadlineHours,
        scheduledAt: session.scheduledAt,
        passUrl,
        organizerName: req.user?.name || "l'équipe Al Wassit",
      }).catch((e) => console.error('[interview] invite email:', e?.message || e));
    }
    if (assigneeUser) {
      emitNotification({
        recipientId: assigneeUser._id,
        recipientRole: assigneeUser.role || '',
        type: 'INTERVIEW_ASSIGNED',
        category: 'CANDIDATE',
        title: `Entretien IA à passer : ${title}`,
        body: deadlineHours
          ? `Vous avez ${deadlineHours} h pour le réaliser.`
          : 'Un entretien automatisé vous a été assigné.',
        actionUrl: `/interview/pass/${session.inviteToken}`,
        actionLabel: "Passer l'entretien",
        icon: 'bot',
        color: '#7b1c2e',
        sourceModule: 'interview',
        sourceId: session._id,
      }).catch(() => {});
    }
    if (scheduledAt && !isNaN(scheduledAt)) {
      CalendarEvent.create({
        title: `Entretien IA — ${title}`,
        type: 'AI_INTERVIEW',
        sourceModule: 'interview',
        sourceId: session._id,
        startsAt: scheduledAt,
        endsAt: new Date(scheduledAt.getTime() + 45 * 60000),
        agentId: req.user?.id,
        description: `Session IA pour ${assignee.name || assignee.email || 'le participant'}${deadlineHours ? ` — fenêtre de ${deadlineHours} h` : ''}.`,
        videoLink: passUrl,
        participants: [{ email: assignee.email, role: 'REQUIRED', userId: assignee.userId }],
      }).catch(() => {});
    }

    return res.status(201).json({ success: true, data: session });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const getInterviewSessions = async (req, res) => {
  try {
    const { status, page = 1, limit = 50, templateId, sort } = req.query;
    const filter = { isDemo: { $ne: true } };
    if (['pending', 'in_progress', 'completed', 'expired'].includes(status)) {
      filter.status = status;
    }
    if (templateId && mongoose.isValidObjectId(templateId)) {
      filter.templateId = templateId;
    }
    const skip = (Math.max(1, parseInt(page, 10)) - 1) * Math.min(100, Math.max(1, parseInt(limit, 10)));
    const lim = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const sortMap = {
      recent: { updatedAt: -1 },
      oldest: { updatedAt: 1 },
      score_desc: { 'review.score': -1, updatedAt: -1 },
      score_asc: { 'review.score': 1, updatedAt: -1 },
      ai_desc: { 'evaluation.overall': -1, updatedAt: -1 },
    };
    const orderBy = sortMap[sort] || sortMap.recent;

    // Sessions dont la fenêtre est dépassée → statut expired
    await InterviewSession.updateMany(
      { status: { $in: ['pending', 'in_progress'] }, expiresAt: { $ne: null, $lt: new Date() } },
      { $set: { status: 'expired' } }
    );

    const [items, total] = await Promise.all([
      InterviewSession.find(filter)
        .sort(orderBy)
        .skip(skip)
        .limit(lim)
        .select('-messages')
        .populate('templateId', 'name title')
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
    const session = await InterviewSession.findById(req.params.id)
      .populate('templateId', 'name title')
      .lean();
    if (!session) {
      return res.status(404).json({ success: false, message: 'Interview session not found' });
    }
    return res.status(200).json({ success: true, data: session });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

/** Évaluation IA : avis rédigé + note par sujet (bouton « Résumé »). */
export const evaluateSession = async (req, res) => {
  try {
    const session = await InterviewSession.findById(req.params.id);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Interview session not found' });
    }
    const transcript = session.messages
      .filter((m) => m.role !== 'system')
      .map((m) => `${m.role === 'user' ? 'Candidat' : 'IA'}: ${m.content}`)
      .join('\n\n');
    if (!transcript.trim()) {
      return res.status(400).json({ success: false, message: 'No transcript to evaluate.' });
    }

    const topics = session.topics?.length ? session.topics : ['Échange général'];
    const raw = await chatCompletion(
      [
        {
          role: 'system',
          content: `Tu es un évaluateur RH senior. À partir du transcript d'un entretien, produis UNIQUEMENT un JSON valide (pas de markdown, pas de commentaire) au format :
{"summary": "<avis global en UN paragraphe court, factuel>", "overall": <note 0-10>, "topics": [{"topic": "<sujet>", "score": <0-10>, "comment": "<1 phrase>"}]}
Évalue chacun des sujets suivants : ${topics.join(' | ')}. Sois honnête, n'invente rien.`,
        },
        { role: 'user', content: `Transcript :\n\n${transcript}` },
      ],
      { pool: 'interview' }
    );

    let parsed = null;
    try {
      const clean = String(raw).replace(/```json|```/g, '').trim();
      parsed = JSON.parse(clean.slice(clean.indexOf('{'), clean.lastIndexOf('}') + 1));
    } catch {
      parsed = { summary: String(raw).slice(0, 800), overall: null, topics: [] };
    }

    session.evaluation = {
      summary: toStr(parsed.summary),
      overall: typeof parsed.overall === 'number' ? parsed.overall : null,
      topics: (Array.isArray(parsed.topics) ? parsed.topics : []).map((t) => ({
        topic: toStr(t.topic),
        score: typeof t.score === 'number' ? t.score : null,
        comment: toStr(t.comment),
      })),
      generatedAt: new Date(),
    };
    await session.save();
    return res.json({ success: true, data: session.evaluation });
  } catch (error) {
    const { status, message } = mapLlmError(error);
    return res.status(status).json({ success: false, message });
  }
};

/** Note manuelle du recruteur (affichée dans la liste, triable). */
export const reviewSession = async (req, res) => {
  try {
    const score = req.body?.score;
    const comment = toStr(req.body?.comment).slice(0, 500);
    const session = await InterviewSession.findByIdAndUpdate(
      req.params.id,
      {
        review: {
          score: score === null || score === undefined || score === '' ? null : Math.max(0, Math.min(10, Number(score))),
          comment,
          updatedAt: new Date(),
        },
      },
      { new: true }
    ).select('-messages');
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    return res.json({ success: true, data: session });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

/** « Mes entretiens à passer » — compte de la personne affectée. */
export const mySessions = async (req, res) => {
  try {
    const uid = req.user?.id;
    const email = (req.user?.email || '').toLowerCase();
    const items = await InterviewSession.find({
      isDemo: { $ne: true },
      status: { $in: ['pending', 'in_progress'] },
      $or: [{ 'assignee.userId': uid }, { 'assignee.email': email }],
    })
      .sort({ expiresAt: 1 })
      .select('title topics scheduledAt deadlineHours expiresAt status inviteToken createdAt')
      .lean();
    return res.json({ success: true, data: items });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// ══════════════════════════════════════════════════════════════
//  ACCÈS PUBLIC PAR JETON (lien reçu par e-mail / espace « À faire »)
// ══════════════════════════════════════════════════════════════

async function sessionByToken(req, res) {
  const session = await InterviewSession.findOne({ inviteToken: req.params.token });
  if (!session) {
    res.status(404).json({ success: false, message: 'Lien invalide ou expiré.' });
    return null;
  }
  return expireIfNeeded(session);
}

export const accessSession = async (req, res) => {
  try {
    const session = await sessionByToken(req, res);
    if (!session) return;
    return res.json({ success: true, data: publicSession(session) });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

/** Démarrage : pending → in_progress + message d'accueil de l'IA. */
export const accessStart = async (req, res) => {
  try {
    const session = await sessionByToken(req, res);
    if (!session) return;
    if (session.status === 'expired') {
      return res.status(410).json({ success: false, message: 'Le délai pour passer cet entretien est dépassé.' });
    }
    if (session.status === 'completed') {
      return res.json({ success: true, data: publicSession(session) });
    }
    if (session.status === 'pending') {
      session.status = 'in_progress';
      try {
        const assistantText = await chatCompletion(
          [
            { role: 'system', content: INTERVIEW_SYSTEM_PROMPT },
            { role: 'user', content: bootstrapUserPrompt(session) },
          ],
          { pool: 'interview' }
        );
        session.messages.push({ role: 'assistant', content: assistantText });
      } catch (err) {
        const { status, message } = mapLlmError(err);
        return res.status(status).json({ success: false, message });
      }
      await session.save();
    }
    return res.json({ success: true, data: publicSession(session) });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const accessMessage = async (req, res) => {
  try {
    const text = toStr(req.body?.text);
    if (!text) return res.status(400).json({ success: false, message: 'text is required' });
    const session = await sessionByToken(req, res);
    if (!session) return;
    if (session.status === 'expired') {
      return res.status(410).json({ success: false, message: 'Le délai pour passer cet entretien est dépassé.' });
    }
    if (session.status !== 'in_progress') {
      return res.status(400).json({ success: false, message: 'Interview not started.' });
    }

    session.messages.push({ role: 'user', content: text });
    const apiMessages = session.messages.map((m) => ({ role: m.role, content: m.content }));
    let assistantText;
    try {
      assistantText = await chatCompletion(apiMessages, { pool: 'interview' });
    } catch (err) {
      session.messages.pop();
      const { status, message } = mapLlmError(err);
      return res.status(status).json({ success: false, message });
    }
    session.messages.push({ role: 'assistant', content: assistantText });
    await session.save();
    return res.json({ success: true, data: { assistantMessage: assistantText } });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const accessComplete = async (req, res) => {
  try {
    const session = await sessionByToken(req, res);
    if (!session) return;
    if (session.status === 'completed') {
      return res.json({ success: true, data: publicSession(session) });
    }
    session.status = 'completed';
    session.completedAt = new Date();
    // Récap recruteur (meilleur effort)
    try {
      const transcript = session.messages
        .filter((m) => m.role !== 'system')
        .map((m) => `${m.role}: ${m.content}`)
        .join('\n\n');
      session.recruiterSummary = await chatCompletion(
        [
          {
            role: 'system',
            content:
              'You help hiring teams. Write concise evaluator notes (markdown bullet list, max 6 bullets): strengths, risks or gaps, overall fit signal, and suggested next step for recruiters. Be factual; do not invent details not in the transcript.',
          },
          { role: 'user', content: `Interview transcript:\n\n${transcript || '(no messages)'}` },
        ],
        { pool: 'interview' }
      );
    } catch {
      session.recruiterSummary = '';
    }
    await session.save();
    return res.json({ success: true, data: publicSession(session) });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// ══════════════════════════════════════════════════════════════
//  MESSAGES CÔTÉ STAFF (démo / sessions animées par un recruteur)
// ══════════════════════════════════════════════════════════════

export const sendInterviewMessage = async (req, res) => {
  try {
    const text = toStr(req.body?.text);
    if (!text) {
      return res.status(400).json({ success: false, message: 'text is required' });
    }

    const streamReply =
      req.body?.stream === true ||
      req.query?.stream === '1' ||
      req.query?.stream === 'true';

    const session = await InterviewSession.findById(req.params.id);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Interview session not found' });
    }
    if (session.status !== 'in_progress') {
      return res.status(400).json({
        success: false,
        message: 'This interview is already completed',
      });
    }

    session.messages.push({ role: 'user', content: text });
    const apiMessages = session.messages.map((m) => ({ role: m.role, content: m.content }));

    if (streamReply) {
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      if (typeof res.flushHeaders === 'function') res.flushHeaders();

      let assistantText;
      try {
        assistantText = await chatCompletionStream(
          apiMessages,
          (delta) => res.write(`data: ${JSON.stringify({ delta })}\n\n`),
          { pool: 'interview' }
        );
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
      res.write(`data: ${JSON.stringify({ done: true, assistantMessage: assistantText })}\n\n`);
      res.end();
      return;
    }

    let assistantText;
    try {
      assistantText = await chatCompletion(apiMessages, { pool: 'interview' });
    } catch (err) {
      session.messages.pop();
      const { status, message } = mapLlmError(err);
      return res.status(status).json({ success: false, message });
    }

    session.messages.push({ role: 'assistant', content: assistantText });
    await session.save();
    return res.status(200).json({
      success: true,
      data: { assistantMessage: assistantText, session },
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const completeInterviewSession = async (req, res) => {
  try {
    const session = await InterviewSession.findById(req.params.id);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Interview session not found' });
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
      recruiterSummary = await chatCompletion(
        [
          {
            role: 'system',
            content:
              'You help hiring teams. Write concise evaluator notes (markdown bullet list, max 6 bullets): strengths, risks or gaps, overall fit signal, and suggested next step for recruiters. Be factual; do not invent details not in the transcript.',
          },
          { role: 'user', content: `Interview transcript:\n\n${transcript || '(no messages)'}` },
        ],
        { pool: 'interview' }
      );
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
