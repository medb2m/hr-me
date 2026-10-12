import mongoose from 'mongoose';
import { CalendarEvent } from '../models/calendar-event.model.js';
import { User } from '../models/user.model.js';
import { buildIcsEvent } from '../utils/ics.js';
import { emitToCalendarAgents } from '../realtime/socket-hub.js';
import { emitNotification } from '../services/notification.service.js';

const STAFF_ROLES = new Set(['admin', 'agent', 'director', 'recruiter']);

/**
 * Périmètre de visibilité :
 * - admin : tout (ou filtre agent_ids)
 * - staff : ses événements + ceux où il est invité
 * - candidat/client : événements dont il est le candidat lié, invité, ou ses notes perso
 */
function agentFilter(req) {
  const role = req.user.role;
  const me = new mongoose.Types.ObjectId(req.user.id);
  if (role === 'admin') {
    const ids = req.query.agent_ids;
    if (typeof ids === 'string' && ids.trim()) {
      const list = ids.split(',').map((s) => s.trim()).filter(mongoose.isValidObjectId);
      return list.length ? { agentId: { $in: list.map((id) => new mongoose.Types.ObjectId(id)) } } : {};
    }
    return {};
  }
  return {
    $or: [{ agentId: me }, { 'participants.userId': me }, { candidateId: me }],
  };
}

/** Accès en lecture : owner, admin, candidat lié ou invité. */
function canRead(req, e) {
  if (req.user.role === 'admin' || String(e.agentId) === req.user.id) return true;
  if (String(e.candidateId) === req.user.id) return true;
  return (e.participants || []).some((p) => String(p.userId) === req.user.id);
}

/** Accès en écriture : owner ou admin. */
function canWrite(req, e) {
  return req.user.role === 'admin' || String(e.agentId) === req.user.id;
}

const TYPE_LABELS = {
  MEETING: 'Réunion',
  DEADLINE: 'Échéance',
  OFFER_EXPIRY: 'Expiration d’offre',
  DOCUMENT_DUE: 'Document attendu',
  TICKET_DUE: 'Ticket à traiter',
  FOLLOWUP: 'Relance',
  VISA_APPT: 'RDV visa',
  EMBASSY_APPT: 'RDV ambassade',
  TALENT_ID: 'Talent ID',
  AI_INTERVIEW: 'Entretien IA',
};

const TYPE_COLORS = {
  MEETING: '#0ea5e9',
  DEADLINE: '#dc2626',
  OFFER_EXPIRY: '#f97316',
  DOCUMENT_DUE: '#64748b',
  TICKET_DUE: '#a16207',
  FOLLOWUP: '#eab308',
  VISA_APPT: '#15803d',
  EMBASSY_APPT: '#15803d',
  TALENT_ID: '#0f172a',
  AI_INTERVIEW: '#7c3aed',
};

function fmtWhen(d) {
  return new Date(d).toLocaleString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Notifie les invités (participants.userId) et le candidat lié — non bloquant. */
function notifyEventPeople(e, verb, { excludeId = null } = {}) {
  const targets = new Set();
  for (const p of e.participants || []) {
    if (p.userId) targets.add(String(p.userId));
  }
  if (e.candidateId) targets.add(String(e.candidateId));
  targets.delete(String(e.agentId));
  if (excludeId) targets.delete(String(excludeId));

  for (const uid of targets) {
    if (!mongoose.isValidObjectId(uid)) continue;
    User.findById(uid)
      .select('role')
      .lean()
      .then((u) => {
        if (!u) return;
        const url = STAFF_ROLES.has(u.role)
          ? '/calendar'
          : u.role === 'client'
            ? '/espace/calendrier'
            : '/candidat/calendrier';
        emitNotification({
          recipientId: uid,
          type: 'CALENDAR_EVENT',
          category: 'CALENDAR',
          priority: e.priority === 'URGENT' ? 'URGENT' : 'HIGH',
          title: `${verb} — ${e.title}`,
          body: `${TYPE_LABELS[e.type] || 'Événement'} · ${fmtWhen(e.startsAt)}`,
          actionUrl: url,
          actionLabel: 'Ouvrir le calendrier',
          icon: 'calendar',
          color: '#7c3aed',
          sourceModule: 'calendar',
          sourceId: e._id,
        });
      })
      .catch(() => {});
  }
}

export async function listEvents(req, res) {
  try {
    const from = req.query.from ? new Date(String(req.query.from)) : new Date();
    const to = req.query.to ? new Date(String(req.query.to)) : new Date(from.getTime() + 31 * 86400000);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return res.status(400).json({ message: 'Invalid from/to.' });
    }
    const types = typeof req.query.types === 'string' ? req.query.types.split(',').filter(Boolean) : [];
    const status = typeof req.query.status === 'string' ? req.query.status : '';

    const scope = agentFilter(req);
    const filter = {
      startsAt: { $lt: to },
      $and: [
        scope.$or ? { $or: scope.$or } : scope,
        { $or: [{ endsAt: null }, { endsAt: { $gt: from } }] },
      ],
      cancelledAt: null,
    };
    if (types.length) {
      filter.type = { $in: types };
    }
    if (status) {
      filter.status = status;
    }

    const items = await CalendarEvent.find(filter).sort({ startsAt: 1 }).lean();
    return res.json({
      items: items.map(serializeEvent),
    });
  } catch (err) {
    console.error('[calendar list]', err);
    return res.status(500).json({ message: 'Failed to list events.' });
  }
}

export async function getEvent(req, res) {
  try {
    const e = await CalendarEvent.findById(req.params.id).lean();
    if (!e) {
      return res.status(404).json({ message: 'Not found.' });
    }
    if (!canRead(req, e)) {
      return res.status(403).json({ message: 'Forbidden.' });
    }
    return res.json({ event: serializeEvent(e) });
  } catch (err) {
    console.error('[calendar get]', err);
    return res.status(500).json({ message: 'Failed.' });
  }
}

export async function createEvent(req, res) {
  try {
    const b = req.body || {};
    const title = String(b.title || '').trim();
    if (!title) {
      return res.status(400).json({ message: 'Title required.' });
    }
    const startsAt = b.startsAt ? new Date(b.startsAt) : null;
    if (!startsAt || Number.isNaN(startsAt.getTime())) {
      return res.status(400).json({ message: 'startsAt invalid.' });
    }
    const endsAt = b.endsAt ? new Date(b.endsAt) : new Date(startsAt.getTime() + 60 * 60 * 1000);
    const agentId =
      req.user.role === 'admin' && b.agentId && mongoose.isValidObjectId(String(b.agentId))
        ? String(b.agentId)
        : req.user.id;

    // Le candidat lié rejoint aussi les invités pour recevoir la notif + l'accès.
    const participants = Array.isArray(b.participants)
      ? b.participants
          .filter((p) => p && (mongoose.isValidObjectId(String(p.userId || '')) || p.email))
          .slice(0, 20)
          .map((p) => ({
            userId: mongoose.isValidObjectId(String(p.userId || '')) ? p.userId : null,
            email: String(p.email || '').toLowerCase(),
            role: ['HOST', 'REQUIRED', 'OPTIONAL', 'OBSERVER'].includes(p.role) ? p.role : 'REQUIRED',
          }))
      : [];
    const candidateId =
      b.candidateId && mongoose.isValidObjectId(String(b.candidateId)) ? b.candidateId : null;

    const doc = await CalendarEvent.create({
      title,
      type: b.type || 'MEETING',
      sourceModule: b.sourceModule || 'calendar',
      sourceId: b.sourceId && mongoose.isValidObjectId(String(b.sourceId)) ? b.sourceId : null,
      startsAt,
      endsAt,
      allDay: Boolean(b.allDay),
      timezoneRef: String(b.timezoneRef || 'Africa/Tunis'),
      color: String(b.color || TYPE_COLORS[b.type] || '#eab308'),
      status: 'SCHEDULED',
      priority: b.priority || 'NORMAL',
      agentId,
      candidateId,
      offerId: b.offerId && mongoose.isValidObjectId(String(b.offerId)) ? b.offerId : null,
      location: String(b.location || ''),
      videoLink: String(b.videoLink || ''),
      description: String(b.description || ''),
      recurrence: b.recurrence || null,
      participants,
      reminders: Array.isArray(b.reminders) ? b.reminders.slice(0, 5) : [],
    });

    emitToCalendarAgents(
      [String(agentId)],
      'calendar:event_created',
      { event: { id: doc._id.toString(), title: doc.title, startsAt: doc.startsAt, type: doc.type, color: doc.color } }
    );
    notifyEventPeople(doc.toObject(), 'Événement planifié');

    return res.status(201).json({ event: serializeEvent(doc.toObject()) });
  } catch (err) {
    console.error('[calendar create]', err);
    return res.status(500).json({ message: 'Create failed.' });
  }
}

export async function patchEvent(req, res) {
  try {
    const e = await CalendarEvent.findById(req.params.id);
    if (!e) {
      return res.status(404).json({ message: 'Not found.' });
    }
    if (req.user.role !== 'admin' && e.agentId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden.' });
    }
    if (!canWrite(req, e)) {
      return res.status(403).json({ message: 'Forbidden.' });
    }
    const b = req.body || {};
    const prevStart = e.startsAt?.getTime();
    const rescheduled = Boolean(b.startsAt) && new Date(b.startsAt).getTime() !== prevStart;
    if (typeof b.title === 'string') {
      e.title = b.title.trim();
    }
    if (b.startsAt) {
      const d = new Date(b.startsAt);
      if (!Number.isNaN(d.getTime())) {
        e.startsAt = d;
      }
    }
    if (b.endsAt) {
      const d = new Date(b.endsAt);
      if (!Number.isNaN(d.getTime())) {
        e.endsAt = d;
      }
    }
    if (typeof b.status === 'string') {
      e.status = b.status;
    }
    if (typeof b.description === 'string') {
      e.description = b.description;
    }
    if (typeof b.location === 'string') e.location = b.location;
    if (typeof b.videoLink === 'string') e.videoLink = b.videoLink;
    if (typeof b.type === 'string') e.type = b.type;
    if (typeof b.priority === 'string') e.priority = b.priority;
    if (typeof b.color === 'string') e.color = b.color;
    if (typeof b.allDay === 'boolean') e.allDay = b.allDay;
    if (Array.isArray(b.participants)) {
      e.participants = b.participants
        .filter((p) => p && (mongoose.isValidObjectId(String(p.userId || '')) || p.email))
        .slice(0, 20)
        .map((p) => ({
          userId: mongoose.isValidObjectId(String(p.userId || '')) ? p.userId : null,
          email: String(p.email || '').toLowerCase(),
          role: ['HOST', 'REQUIRED', 'OPTIONAL', 'OBSERVER'].includes(p.role) ? p.role : 'REQUIRED',
        }));
    }
    if (b.candidateId !== undefined) {
      e.candidateId = mongoose.isValidObjectId(String(b.candidateId)) ? b.candidateId : null;
    }
    await e.save();

    emitToCalendarAgents(
      [e.agentId.toString()],
      'calendar:event_updated',
      { event_id: e._id.toString(), patch: { startsAt: e.startsAt, endsAt: e.endsAt, status: e.status } }
    );
    notifyEventPeople(
      e.toObject(),
      rescheduled ? 'Événement reprogrammé' : 'Événement mis à jour',
      { excludeId: req.user.id },
    );

    return res.json({ event: serializeEvent(e.toObject()) });
  } catch (err) {
    console.error('[calendar patch]', err);
    return res.status(500).json({ message: 'Update failed.' });
  }
}

export async function cancelEvent(req, res) {
  try {
    const e = await CalendarEvent.findById(req.params.id);
    if (!e) {
      return res.status(404).json({ message: 'Not found.' });
    }
    if (req.user.role !== 'admin' && e.agentId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden.' });
    }
    if (!canWrite(req, e)) {
      return res.status(403).json({ message: 'Forbidden.' });
    }
    e.status = 'CANCELLED';
    e.cancelledAt = new Date();
    await e.save();
    emitToCalendarAgents(
      [e.agentId.toString()],
      'calendar:event_cancelled',
      { event_id: e._id.toString() }
    );
    notifyEventPeople(e.toObject(), 'Événement annulé', { excludeId: req.user.id });
    return res.json({ ok: true });
  } catch (err) {
    console.error('[calendar cancel]', err);
    return res.status(500).json({ message: 'Cancel failed.' });
  }
}

export async function downloadIcs(req, res) {
  try {
    const e = await CalendarEvent.findById(req.params.id).lean();
    if (!e) {
      return res.status(404).send('Not found');
    }
    if (!canRead(req, e)) {
      return res.status(403).send('Forbidden');
    }
    const end = e.endsAt || new Date(e.startsAt.getTime() + 3600000);
    const ics = buildIcsEvent({
      uid: e._id.toString(),
      title: e.title,
      description: e.description,
      start: e.startsAt,
      end,
      location: e.location || 'Al Wassit',
      url: e.videoLink || undefined,
    });
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="event-${e._id}.ics"`);
    return res.send(ics);
  } catch (err) {
    console.error('[calendar ics]', err);
    return res.status(500).send('Error');
  }
}

export async function conflicts(req, res) {
  try {
    const agentId = String(req.query.agent_id || req.user.id);
    if (!mongoose.isValidObjectId(agentId)) {
      return res.status(400).json({ message: 'Invalid agent_id.' });
    }
    const startsAt = req.query.starts_at ? new Date(String(req.query.starts_at)) : null;
    const endsAt = req.query.ends_at ? new Date(String(req.query.ends_at)) : null;
    if (!startsAt || !endsAt || Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      return res.status(400).json({ message: 'starts_at and ends_at required.' });
    }
    if (req.user.role !== 'admin' && agentId !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden.' });
    }

    const overlap = await CalendarEvent.find({
      agentId,
      cancelledAt: null,
      status: { $nin: ['CANCELLED', 'COMPLETED'] },
      startsAt: { $lt: endsAt },
      $or: [{ endsAt: null }, { endsAt: { $gt: startsAt } }],
    })
      .select('title startsAt endsAt type')
      .lean();

    return res.json({ conflicts: overlap.map((x) => ({ id: x._id.toString(), title: x.title, startsAt: x.startsAt, endsAt: x.endsAt, type: x.type })) });
  } catch (err) {
    console.error('[calendar conflicts]', err);
    return res.status(500).json({ message: 'Failed.' });
  }
}

/** GET /attendees?q= — recherche d'invités (staff : tout ; autres : refusé). */
export async function listAttendees(req, res) {
  try {
    if (!STAFF_ROLES.has(req.user.role)) {
      return res.status(403).json({ message: 'Reserved to staff.' });
    }
    const q = String(req.query.q || '').trim().slice(0, 80);
    const filter = q
      ? {
          $or: [
            { name: { $regex: q, $options: 'i' } },
            { email: { $regex: q, $options: 'i' } },
          ],
        }
      : {};
    const users = await User.find(filter)
      .select('name email role avatarUrl')
      .sort({ name: 1, email: 1 })
      .limit(15)
      .lean();
    return res.json({
      attendees: users.map((u) => ({
        id: u._id,
        name: u.name || u.email,
        email: u.email,
        role: u.role,
        avatarUrl: u.avatarUrl || '',
      })),
    });
  } catch (err) {
    console.error('[calendar attendees]', err);
    return res.status(500).json({ message: 'Failed.' });
  }
}

function serializeEvent(e) {
  return {
    id: e._id.toString(),
    title: e.title,
    type: e.type,
    sourceModule: e.sourceModule,
    sourceId: e.sourceId?.toString?.() ?? e.sourceId,
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    allDay: e.allDay,
    timezoneRef: e.timezoneRef,
    color: e.color,
    status: e.status,
    priority: e.priority,
    participants: e.participants || [],
    candidateId: e.candidateId?.toString?.() ?? e.candidateId,
    offerId: e.offerId?.toString?.() ?? e.offerId,
    agentId: e.agentId?.toString?.() ?? e.agentId,
    location: e.location,
    videoLink: e.videoLink,
    description: e.description,
    recurrence: e.recurrence,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  };
}
