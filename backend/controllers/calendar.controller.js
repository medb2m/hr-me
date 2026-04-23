import mongoose from 'mongoose';
import { CalendarEvent } from '../models/calendar-event.model.js';
import { buildIcsEvent } from '../utils/ics.js';
import { emitToCalendarAgents } from '../realtime/socket-hub.js';

function agentFilter(req) {
  const role = req.user.role;
  if (role === 'admin') {
    const ids = req.query.agent_ids;
    if (typeof ids === 'string' && ids.trim()) {
      const list = ids.split(',').map((s) => s.trim()).filter(mongoose.isValidObjectId);
      return list.length ? { agentId: { $in: list.map((id) => new mongoose.Types.ObjectId(id)) } } : {};
    }
    return {};
  }
  return { agentId: new mongoose.Types.ObjectId(req.user.id) };
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

    const filter = {
      ...agentFilter(req),
      startsAt: { $lt: to },
      $or: [{ endsAt: null }, { endsAt: { $gt: from } }],
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
    if (req.user.role !== 'admin' && e.agentId.toString() !== req.user.id) {
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

    const doc = await CalendarEvent.create({
      title,
      type: b.type || 'MEETING',
      sourceModule: b.sourceModule || 'calendar',
      sourceId: b.sourceId && mongoose.isValidObjectId(String(b.sourceId)) ? b.sourceId : null,
      startsAt,
      endsAt,
      allDay: Boolean(b.allDay),
      timezoneRef: String(b.timezoneRef || 'Africa/Tunis'),
      color: String(b.color || '#7B1C2E'),
      status: 'SCHEDULED',
      priority: b.priority || 'NORMAL',
      agentId,
      candidateId: b.candidateId && mongoose.isValidObjectId(String(b.candidateId)) ? b.candidateId : null,
      offerId: b.offerId && mongoose.isValidObjectId(String(b.offerId)) ? b.offerId : null,
      location: String(b.location || ''),
      videoLink: String(b.videoLink || ''),
      description: String(b.description || ''),
      recurrence: b.recurrence || null,
      participants: Array.isArray(b.participants) ? b.participants : [],
    });

    emitToCalendarAgents(
      [String(agentId)],
      'calendar:event_created',
      { event: { id: doc._id.toString(), title: doc.title, startsAt: doc.startsAt, type: doc.type, color: doc.color } }
    );

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
    const b = req.body || {};
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
    await e.save();

    emitToCalendarAgents(
      [e.agentId.toString()],
      'calendar:event_updated',
      { event_id: e._id.toString(), patch: { startsAt: e.startsAt, endsAt: e.endsAt, status: e.status } }
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
    e.status = 'CANCELLED';
    e.cancelledAt = new Date();
    await e.save();
    emitToCalendarAgents(
      [e.agentId.toString()],
      'calendar:event_cancelled',
      { event_id: e._id.toString() }
    );
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
    if (req.user.role !== 'admin' && e.agentId.toString() !== req.user.id) {
      return res.status(403).send('Forbidden');
    }
    const end = e.endsAt || new Date(e.startsAt.getTime() + 3600000);
    const ics = buildIcsEvent({
      uid: e._id.toString(),
      title: e.title,
      description: e.description,
      start: e.startsAt,
      end,
      location: e.location || 'HR me',
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
