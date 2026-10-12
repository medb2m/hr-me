import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { Meeting } from '../models/meeting.model.js';
import { CalendarEvent } from '../models/calendar-event.model.js';
import { User } from '../models/user.model.js';
import { getJwtSecret } from '../utils/jwt.js';
import { emitNotification } from '../services/notification.service.js';
import { emitToCalendarAgents, getIo } from '../realtime/socket-hub.js';
import { buildIcsEvent } from '../utils/ics.js';
import { getFrontendBaseUrl } from '../config/public-url.js';
import { isSmtpConfigured, sendMail } from '../email/mailer.js';

const MEETING_TYPES = ['general', 'team', 'partner', 'client', 'screening', 'technical', 'final', 'ai_automated'];

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
    const type = MEETING_TYPES.includes(body.type)
      ? body.type
      : 'general';

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
          body: `Le ${scheduledAt.toISOString()} — rejoindre depuis Al Wassit.`,
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
        location: 'Al Wassit — visioconférence',
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
            subject: `[Al Wassit] Entretien : ${title}`,
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
    if (!canManageMeeting(req.user, m)) {
      return res.status(403).json({ message: 'Only host or admin can add participants.' });
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

    // Sync calendrier : l'invité apparaît aussi dans l'événement lié
    await CalendarEvent.updateMany(
      { sourceModule: 'meetings', sourceId: m._id },
      {
        $push: {
          participants: {
            userId: entry.userId || null,
            email: entry.email,
            role: entry.role === 'host' ? 'HOST' : 'REQUIRED',
            rsvpStatus: 'PENDING',
          },
        },
      }
    );

    const io = getIo();
    io?.to(`meeting:${m.roomId}`).emit('meeting:participants_updated', {
      participants: serializeMeeting(m).participants,
    });

    // E-mail d'invitation avec pièce ICS si SMTP configuré
    if (isSmtpConfigured()) {
      try {
        const videoLink = `${getFrontendBaseUrl()}/meetings/${m._id}/lobby`;
        const ics = buildIcsEvent({
          uid: `${m._id.toString()}-${em}`,
          title: m.title,
          description: `${m.description}\n${entry.role === 'candidate' ? `PIN candidat : ${m.pinCode}\n` : ''}Lien : ${videoLink}`,
          start: m.scheduledAt,
          end: meetingEndTime(m),
          location: 'Al Wassit — visioconférence',
          url: videoLink,
        });
        await sendMail({
          to: em,
          subject: `[Al Wassit] Invitation : ${m.title}`,
          text: `Bonjour,\n\nVous êtes invité·e à la réunion « ${m.title} » le ${m.scheduledAt.toISOString()}.\nLien : ${videoLink}\n${entry.role === 'candidate' ? `Code PIN : ${m.pinCode}\n` : ''}`,
          attachments: [{ filename: 'invite.ics', content: ics }],
        });
      } catch (e) {
        console.error('[addParticipant] email', em, e.message);
      }
    }

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

/** GET /recent-participants — utilisateurs déjà invités à des réunions passées (staff). */
export async function recentParticipants(req, res) {
  try {
    if (!isStaff(req.user)) {
      return res.status(403).json({ message: 'Reserved to staff.' });
    }
    const meetings = await Meeting.find({ 'participants.0': { $exists: true } })
      .select('participants scheduledAt')
      .sort({ scheduledAt: -1 })
      .limit(80)
      .lean();
    const seen = new Map();
    for (const m of meetings) {
      for (const p of m.participants || []) {
        const key = normalizeEmail(p.email) || (p.userId ? `u:${p.userId}` : '');
        if (!key || seen.has(key)) continue;
        seen.set(key, {
          id: p.userId?.toString?.() ?? null,
          name: p.name || '',
          email: p.email || '',
          role: p.role === 'host' ? 'recruiter' : p.role,
          lastUsed: m.scheduledAt,
        });
      }
      if (seen.size >= 24) break;
    }
    // Compléter noms + photos depuis User (par id ou e-mail)
    const items = [...seen.values()];
    const ids = items.map((i) => i.id).filter((id) => id && mongoose.isValidObjectId(id));
    const emails = items.map((i) => i.email).filter(Boolean);
    if (ids.length || emails.length) {
      const or = [];
      if (ids.length) or.push({ _id: { $in: ids } });
      if (emails.length) or.push({ email: { $in: emails } });
      const users = await User.find({ $or: or }).select('name email avatarUrl').lean();
      const byId = new Map(users.map((u) => [u._id.toString(), u]));
      const byEmail = new Map(users.map((u) => [u.email, u]));
      for (const it of items) {
        const u = (it.id ? byId.get(it.id) : null) || (it.email ? byEmail.get(it.email) : null);
        if (u) {
          if (!it.name) it.name = u.name || it.name;
          if (!it.email) it.email = u.email;
          it.avatarUrl = u.avatarUrl || '';
          if (!it.id) it.id = u._id.toString();
        } else {
          it.avatarUrl = '';
        }
      }
    }
    return res.json({ items });
  } catch (err) {
    console.error('[meetings recentParticipants]', err);
    return res.status(500).json({ message: 'Failed.' });
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

const STAFF_ROLES = ['admin', 'agent', 'director', 'recruiter'];

function isStaff(user) {
  return STAFF_ROLES.includes(user?.role);
}

/** Créateur ou admin peut gérer (modifier/annuler/participants). */
function canManageMeeting(user, meeting) {
  return meeting.createdByAgentId.toString() === user.id || user.role === 'admin';
}

export async function listMeetings(req, res) {
  try {
    const from = req.query.from ? new Date(String(req.query.from)) : new Date(0);
    const to = req.query.to ? new Date(String(req.query.to)) : new Date('2999-12-31');
    const filter = { scheduledAt: { $gte: from, $lte: to } };
    // Staff peut superviser toutes les réunions via ?scope=all
    if (!(isStaff(req.user) && req.query.scope === 'all')) {
      const uid = new mongoose.Types.ObjectId(req.user.id);
      const em = normalizeEmail(req.user.email);
      const or = [{ createdByAgentId: uid }, { 'participants.userId': uid }];
      if (em) {
        or.push({ 'participants.email': em });
      }
      filter.$or = or;
    }
    if (req.query.status) {
      const statuses = String(req.query.status).split(',').filter(Boolean);
      if (statuses.length) filter.status = { $in: statuses };
    }
    const items = await Meeting.find(filter)
      .populate('createdByAgentId', 'name email')
      .sort({ scheduledAt: 1 })
      .lean();
    return res.json({ items: items.map(serializeMeetingLean) });
  } catch (err) {
    console.error('[meetings list]', err);
    return res.status(500).json({ message: 'Failed.' });
  }
}

export async function updateMeeting(req, res) {
  try {
    const m = await Meeting.findById(req.params.id);
    if (!m) {
      return res.status(404).json({ message: 'Not found.' });
    }
    if (!canManageMeeting(req.user, m)) {
      return res.status(403).json({ message: 'Only host or admin can edit.' });
    }
    if (['ENDED', 'ARCHIVED'].includes(m.status)) {
      return res.status(400).json({ message: 'A finished meeting cannot be edited.' });
    }
    const body = req.body || {};
    const rescheduled = body.scheduledAt && new Date(body.scheduledAt).getTime() !== m.scheduledAt.getTime();

    if (typeof body.title === 'string' && body.title.trim()) m.title = body.title.trim();
    if (MEETING_TYPES.includes(body.type)) m.type = body.type;
    if (body.scheduledAt) {
      const d = new Date(body.scheduledAt);
      if (Number.isNaN(d.getTime())) return res.status(400).json({ message: 'Invalid scheduledAt.' });
      m.scheduledAt = d;
    }
    if (body.durationMin) m.durationMin = Math.min(480, Math.max(5, Number(body.durationMin) || m.durationMin));
    if (typeof body.timezone === 'string' && body.timezone) m.timezone = body.timezone;
    if (['fr', 'en', 'ar', 'it'].includes(body.language)) m.language = body.language;
    if (typeof body.description === 'string') m.description = body.description;
    if (m.status === 'CANCELLED') m.status = 'SCHEDULED'; // édition = réactivation
    await m.save();

    await CalendarEvent.updateMany(
      { sourceModule: 'meetings', sourceId: m._id },
      {
        title: m.title,
        type: m.type === 'ai_automated' ? 'AI_INTERVIEW' : 'MEETING',
        startsAt: m.scheduledAt,
        endsAt: meetingEndTime(m),
        timezoneRef: m.timezone,
        description: m.description,
        status: m.status === 'CANCELLED' ? 'CANCELLED' : 'SCHEDULED',
      }
    );

    for (const p of m.participants) {
      if (p.userId && p.userId.toString() !== req.user.id) {
        try {
          await emitNotification({
            recipientId: p.userId,
            type: 'MEETING_SCHEDULED',
            category: 'MEETING',
            priority: 'NORMAL',
            title: rescheduled ? `Entretien reprogrammé : ${m.title}` : `Entretien modifié : ${m.title}`,
            body: `Nouvelle date : ${m.scheduledAt.toISOString()}`,
            actionUrl: `/meetings/${m._id}/lobby`,
            actionLabel: 'Voir le lobby',
            sourceModule: 'meetings',
            sourceId: m._id,
            metadata: { meetingId: m._id.toString(), roomId: m.roomId },
            sound: 'bell_meeting',
          });
        } catch (e) {
          console.error('[updateMeeting] notify', e.message);
        }
      }
    }
    return res.json({ meeting: serializeMeeting(m) });
  } catch (err) {
    console.error('[meetings update]', err);
    return res.status(500).json({ message: 'Failed.' });
  }
}

export async function removeParticipant(req, res) {
  try {
    const m = await Meeting.findById(req.params.id);
    if (!m) {
      return res.status(404).json({ message: 'Not found.' });
    }
    if (!canManageMeeting(req.user, m)) {
      return res.status(403).json({ message: 'Only host or admin can remove participants.' });
    }
    const em = normalizeEmail(req.body?.email ?? req.query.email);
    if (!em) return res.status(400).json({ message: 'email required.' });
    const before = m.participants.length;
    m.participants = m.participants.filter(
      (p) => p.role === 'host' || normalizeEmail(p.email) !== em
    );
    if (m.participants.length === before) {
      return res.status(404).json({ message: 'Participant not found.' });
    }
    await m.save();
    await CalendarEvent.updateMany(
      { sourceModule: 'meetings', sourceId: m._id },
      { $pull: { participants: { email: em } } }
    );
    const io = getIo();
    io?.to(`meeting:${m.roomId}`).emit('meeting:participants_updated', {
      participants: serializeMeeting(m).participants,
    });
    return res.json({ meeting: serializeMeeting(m) });
  } catch (err) {
    console.error('[meetings removeParticipant]', err);
    return res.status(500).json({ message: 'Failed.' });
  }
}

export async function patchMeetingStatus(req, res) {
  try {
    const m = await Meeting.findById(req.params.id);
    if (!m) {
      return res.status(404).json({ message: 'Not found.' });
    }
    if (!canManageMeeting(req.user, m)) {
      return res.status(403).json({ message: 'Only host or admin can change status.' });
    }
    const status = req.body?.status;
    const allowed = ['SCHEDULED', 'WAITING', 'IN_PROGRESS', 'ENDED', 'ARCHIVED', 'CANCELLED'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: 'Invalid status.' });
    }
    m.status = status;
    await m.save();
    await CalendarEvent.updateMany(
      { sourceModule: 'meetings', sourceId: m._id },
      {
        status:
          status === 'ENDED' || status === 'ARCHIVED'
            ? 'COMPLETED'
            : status === 'CANCELLED'
              ? 'CANCELLED'
              : status === 'IN_PROGRESS'
                ? 'IN_PROGRESS'
                : 'SCHEDULED',
      }
    );

    if (status === 'CANCELLED') {
      for (const p of m.participants) {
        if (p.userId && p.userId.toString() !== req.user.id) {
          try {
            await emitNotification({
              recipientId: p.userId,
              type: 'MEETING_SCHEDULED',
              category: 'MEETING',
              priority: 'HIGH',
              title: `Entretien annulé : ${m.title}`,
              body: `L'entretien du ${m.scheduledAt.toISOString()} a été annulé.`,
              sourceModule: 'meetings',
              sourceId: m._id,
              metadata: { meetingId: m._id.toString() },
            });
          } catch (e) {
            console.error('[patchStatus] notify cancel', e.message);
          }
        }
      }
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
    createdByAgentId: o.createdByAgentId?._id?.toString?.() ?? o.createdByAgentId?.toString?.() ?? o.createdByAgentId,
    createdByName: o.createdByAgentId?.name || '',
    createdByEmail: o.createdByAgentId?.email || '',
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
