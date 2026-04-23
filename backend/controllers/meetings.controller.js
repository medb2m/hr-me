import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { Meeting } from '../models/meeting.model.js';
import { CalendarEvent } from '../models/calendar-event.model.js';
import { getJwtSecret } from '../utils/jwt.js';
import { emitNotification } from '../services/notification.service.js';
import { emitToCalendarAgents, getIo } from '../realtime/socket-hub.js';
import { buildIcsEvent } from '../utils/ics.js';
import { getFrontendBaseUrl } from '../config/public-url.js';
import { isSmtpConfigured, sendMail } from '../email/mailer.js';

function randomPin() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function meetingEndTime(m) {
  return new Date(m.scheduledAt.getTime() + m.durationMin * 60 * 1000);
}

function joinTokenExpiresAt(scheduledAt, durationMin) {
  const end = new Date(scheduledAt.getTime() + durationMin * 60 * 1000);
  return new Date(end.getTime() + 30 * 60 * 1000);
}

function joinTokenMaxSeconds(scheduledAt, durationMin) {
  const expAt = joinTokenExpiresAt(scheduledAt, durationMin);
  const sec = Math.floor((expAt.getTime() - Date.now()) / 1000);
  return Math.max(300, Math.min(sec, 7 * 24 * 3600));
}

function normalizeEmail(e) {
  return typeof e === 'string' ? e.trim().toLowerCase() : '';
}

/** Accès si créateur, ou participant par `userId`, ou par e-mail (même compte que le JWT). */
function canAccessMeeting(userId, userEmail, meeting) {
  if (meeting.createdByAgentId.toString() === userId) {
    return true;
  }
  const em = normalizeEmail(userEmail);
  return meeting.participants.some(
    (p) =>
      (p.userId && p.userId.toString() === userId) ||
      (em && normalizeEmail(p.email) === em)
  );
}

export async function createMeeting(req, res) {
  try {
    const body = req.body || {};
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) {
      return res.status(400).json({ message: 'Title is required.' });
    }
    const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
    if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) {
      return res.status(400).json({ message: 'scheduledAt must be a valid ISO date.' });
    }
    const durationMin = Math.min(480, Math.max(5, Number(body.durationMin) || 30));
    const timezone = typeof body.timezone === 'string' ? body.timezone : 'Africa/Tunis';
    const language = ['fr', 'en', 'ar', 'it'].includes(body.language) ? body.language : 'fr';
    const description = typeof body.description === 'string' ? body.description : '';
    const type = ['screening', 'technical', 'final', 'ai_automated'].includes(body.type)
      ? body.type
      : 'screening';

    const participants = [];
    const rawParts = Array.isArray(body.participants) ? body.participants : [];
    for (const p of rawParts) {
      const role = p.role;
      if (!['host', 'recruiter', 'candidate', 'observer'].includes(role)) {
        continue;
      }
      const entry = { role, name: String(p.name || '').trim(), email: String(p.email || '').trim().toLowerCase() };
      if (p.userId && mongoose.isValidObjectId(String(p.userId))) {
        entry.userId = new mongoose.Types.ObjectId(String(p.userId));
      }
      participants.push(entry);
    }
    const hostPresent = participants.some((p) => p.role === 'host');
    if (!hostPresent) {
      participants.unshift({
        userId: new mongoose.Types.ObjectId(req.user.id),
        email: req.user.email,
        name: req.user.name || '',
        role: 'host',
      });
    }

    const roomId = crypto.randomUUID();
    const pinCode = randomPin();

    const meeting = await Meeting.create({
      title,
      type,
      status: 'SCHEDULED',
      scheduledAt,
      durationMin,
      timezone,
      language,
      description,
      offerId: body.offerId && mongoose.isValidObjectId(String(body.offerId)) ? body.offerId : null,
      candidateId:
        body.candidateId && mongoose.isValidObjectId(String(body.candidateId)) ? body.candidateId : null,
      createdByAgentId: req.user.id,
      roomId,
      pinCode,
      participants,
    });

    const endsAt = meetingEndTime(meeting);
    const calType = type === 'ai_automated' ? 'AI_INTERVIEW' : 'MEETING';
    const color = type === 'ai_automated' ? '#A0522D' : '#7B1C2E';
    const videoLink = `${getFrontendBaseUrl()}/meetings/${meeting._id}/lobby`;

    const cal = await CalendarEvent.create({
      title: meeting.title,
      type: calType,
      sourceModule: 'meetings',
      sourceId: meeting._id,
      startsAt: meeting.scheduledAt,
      endsAt,
      allDay: false,
      timezoneRef: timezone,
      color,
      status: 'SCHEDULED',
      priority: 'NORMAL',
      agentId: req.user.id,
      candidateId: meeting.candidateId,
      offerId: meeting.offerId,
      location: 'Video',
      videoLink,
      description: meeting.description,
      participants: participants.map((p) => ({
        userId: p.userId || null,
        email: p.email,
        role: p.role === 'host' ? 'HOST' : 'REQUIRED',
        rsvpStatus: 'PENDING',
      })),
    });

    emitToCalendarAgents(
      [String(meeting.createdByAgentId)],
      'calendar:event_created',
      { event: { id: cal._id.toString(), title: cal.title, startsAt: cal.startsAt, type: cal.type, color: cal.color } }
    );

    for (const p of participants) {
      if (p.userId && p.userId.toString() !== req.user.id) {
        await emitNotification({
          recipientId: p.userId,
          type: 'MEETING_SCHEDULED',
          category: 'MEETING',
          priority: 'NORMAL',
          title: `Entretien planifié : ${title}`,
          body: `Le ${scheduledAt.toISOString()} — rejoindre depuis HR me.`,
          actionUrl: `/meetings/${meeting._id}/lobby`,
          actionLabel: 'Voir le lobby',
          sourceModule: 'meetings',
          sourceId: meeting._id,
          metadata: { meetingId: meeting._id.toString(), roomId },
          sound: 'bell_meeting',
        });
      }
    }

    if (isSmtpConfigured()) {
      const ics = buildIcsEvent({
        uid: meeting._id.toString(),
        title: meeting.title,
        description: `${description}\nPIN candidat : ${pinCode}\nLien : ${videoLink}`,
        start: meeting.scheduledAt,
        end: endsAt,
        location: 'HR me — visioconférence',
        url: videoLink,
      });
      for (const p of participants) {
        const to = p.email;
        if (!to || !to.includes('@')) {
          continue;
        }
        try {
          await sendMail({
            to,
            subject: `[HR me] Entretien : ${title}`,
            text: `Bonjour,\n\nUn entretien a été planifié le ${meeting.scheduledAt.toISOString()}.\nLien : ${videoLink}\n${p.role === 'candidate' ? `Code PIN : ${pinCode}\n` : ''}`,
            attachments: [{ filename: 'invite.ics', content: ics }],
          });
        } catch (e) {
          console.error('[meeting email]', to, e.message);
        }
      }
    }

    return res.status(201).json({
      meeting: serializeMeeting(meeting),
      calendarEventId: cal._id.toString(),
    });
  } catch (err) {
    console.error('[meetings create]', err);
    return res.status(500).json({ message: err.message || 'Create failed.' });
  }
}

export async function addParticipant(req, res) {
  try {
    const m = await Meeting.findById(req.params.id);
    if (!m) {
      return res.status(404).json({ message: 'Not found.' });
    }
    if (m.createdByAgentId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only the host can add participants.' });
    }
    const body = req.body || {};
    const em = normalizeEmail(body.email);
    if (!em) {
      return res.status(400).json({ message: 'A valid email is required.' });
    }
    const role = ['recruiter', 'candidate'].includes(body.role) ? body.role : 'recruiter';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const dup = m.participants.some(
      (p) =>
        normalizeEmail(p.email) === em ||
        (body.userId && p.userId && p.userId.toString() === String(body.userId).trim())
    );
    if (dup) {
      return res.status(409).json({ message: 'This participant is already invited.' });
    }
    const entry = { email: em, name, role };
    if (body.userId && mongoose.isValidObjectId(String(body.userId).trim())) {
      entry.userId = new mongoose.Types.ObjectId(String(body.userId).trim());
    }
    m.participants.push(entry);
    await m.save();

    const io = getIo();
    io?.to(`meeting:${m.roomId}`).emit('meeting:participants_updated', {
      participants: serializeMeeting(m).participants,
    });

    if (entry.userId && entry.userId.toString() !== req.user.id) {
      try {
        await emitNotification({
          recipientId: entry.userId,
          type: 'MEETING_SCHEDULED',
          category: 'MEETING',
          priority: 'NORMAL',
          title: `Ajout à un entretien : ${m.title}`,
          body: 'Vous avez été ajouté·e à un entretien.',
          actionUrl: `/meetings/${m._id}/lobby`,
          actionLabel: 'Voir le lobby',
          sourceModule: 'meetings',
          sourceId: m._id,
          metadata: { meetingId: m._id.toString(), roomId: m.roomId },
          sound: 'bell_meeting',
        });
      } catch (e) {
        console.error('[addParticipant] notify', e.message);
      }
    }

    return res.status(201).json({ meeting: serializeMeeting(m) });
  } catch (err) {
    console.error('[meetings addParticipant]', err);
    return res.status(500).json({ message: err.message || 'Failed to add participant.' });
  }
}

export async function getMeeting(req, res) {
  try {
    const m = await Meeting.findById(req.params.id);
    if (!m) {
      return res.status(404).json({ message: 'Not found.' });
    }
    if (!canAccessMeeting(req.user.id, req.user.email, m)) {
      return res.status(403).json({ message: 'Forbidden.' });
    }
    return res.json({ meeting: serializeMeeting(m) });
  } catch (err) {
    console.error('[meetings get]', err);
    return res.status(500).json({ message: 'Failed.' });
  }
}

export async function listMeetings(req, res) {
  try {
    const from = req.query.from ? new Date(String(req.query.from)) : new Date();
    const to = req.query.to ? new Date(String(req.query.to)) : new Date(from.getTime() + 30 * 86400000);
    const uid = new mongoose.Types.ObjectId(req.user.id);
    const em = normalizeEmail(req.user.email);
    const or = [{ createdByAgentId: uid }, { 'participants.userId': uid }];
    if (em) {
      or.push({ 'participants.email': em });
    }
    const items = await Meeting.find({
      $or: or,
      scheduledAt: { $gte: from, $lte: to },
    })
      .sort({ scheduledAt: 1 })
      .lean();
    return res.json({ items: items.map(serializeMeetingLean) });
  } catch (err) {
    console.error('[meetings list]', err);
    return res.status(500).json({ message: 'Failed.' });
  }
}

export async function patchMeetingStatus(req, res) {
  try {
    const m = await Meeting.findById(req.params.id);
    if (!m) {
      return res.status(404).json({ message: 'Not found.' });
    }
    if (m.createdByAgentId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only host can change status.' });
    }
    const status = req.body?.status;
    const allowed = ['SCHEDULED', 'WAITING', 'IN_PROGRESS', 'ENDED', 'ARCHIVED'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: 'Invalid status.' });
    }
    m.status = status;
    await m.save();
    if (m.candidateId || m.offerId) {
      await CalendarEvent.updateMany(
        { sourceModule: 'meetings', sourceId: m._id },
        {
          status:
            status === 'ENDED' || status === 'ARCHIVED'
              ? 'COMPLETED'
              : status === 'IN_PROGRESS'
                ? 'IN_PROGRESS'
                : 'SCHEDULED',
        }
      );
    }
    return res.json({ meeting: serializeMeeting(m) });
  } catch (err) {
    console.error('[meetings patchStatus]', err);
    return res.status(500).json({ message: 'Failed.' });
  }
}

export async function getJoinToken(req, res) {
  try {
    const m = await Meeting.findById(req.params.id);
    if (!m) {
      return res.status(404).json({ message: 'Not found.' });
    }
    if (!canAccessMeeting(req.user.id, req.user.email, m)) {
      return res.status(403).json({ message: 'Forbidden.' });
    }
    const em = normalizeEmail(req.user.email);
    const part = m.participants.find(
      (p) =>
        (p.userId && p.userId.toString() === req.user.id) ||
        (em && normalizeEmail(p.email) === em)
    );
    const meetingRole = part?.role || (m.createdByAgentId.toString() === req.user.id ? 'host' : 'observer');
    const maxSec = joinTokenMaxSeconds(m.scheduledAt, m.durationMin);
    const token = jwt.sign(
      {
        sub: req.user.id,
        typ: 'meeting_join',
        meetingId: m._id.toString(),
        roomId: m.roomId,
        meetingRole,
      },
      getJwtSecret(),
      { expiresIn: maxSec }
    );
    return res.json({
      token,
      roomId: m.roomId,
      meetingRole,
      expiresAt: joinTokenExpiresAt(m.scheduledAt, m.durationMin).toISOString(),
    });
  } catch (err) {
    console.error('[meetings joinToken]', err);
    return res.status(500).json({ message: 'Failed.' });
  }
}

function serializeMeeting(m) {
  const o = m.toObject ? m.toObject() : m;
  return serializeMeetingLean(o);
}

function serializeMeetingLean(o) {
  return {
    id: o._id.toString(),
    title: o.title,
    type: o.type,
    status: o.status,
    scheduledAt: o.scheduledAt,
    durationMin: o.durationMin,
    timezone: o.timezone,
    language: o.language,
    description: o.description,
    offerId: o.offerId?.toString?.() ?? o.offerId,
    candidateId: o.candidateId?.toString?.() ?? o.candidateId,
    createdByAgentId: o.createdByAgentId?.toString?.() ?? o.createdByAgentId,
    roomId: o.roomId,
    pinCode: o.pinCode,
    participants: (o.participants || []).map((p) => ({
      userId: p.userId?.toString?.() ?? p.userId,
      email: p.email,
      name: p.name,
      role: p.role,
      joinAt: p.joinAt,
      leaveAt: p.leaveAt,
      noShow: p.noShow,
    })),
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}
