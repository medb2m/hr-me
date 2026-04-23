import mongoose from 'mongoose';
import { Notification } from '../models/notification.model.js';
import { serializeNotificationDoc } from '../services/notification.service.js';
import { emitToUser } from '../realtime/socket-hub.js';

export async function listNotifications(req, res) {
  try {
    const userId = req.user.id;
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '20'), 10) || 20));
    const category = typeof req.query.category === 'string' ? req.query.category : '';
    const readParam = req.query.read;
    const filter = {
      recipientId: new mongoose.Types.ObjectId(userId),
      dismissed: false,
      $or: [{ snoozeUntil: null }, { snoozeUntil: { $lte: new Date() } }],
    };
    if (category) {
      filter.category = category;
    }
    if (readParam === 'true') {
      filter.read = true;
    } else if (readParam === 'false') {
      filter.read = false;
    }

    const [items, total] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Notification.countDocuments(filter),
    ]);

    return res.json({
      items: items.map((n) => ({
        id: n._id.toString(),
        type: n.type,
        category: n.category,
        priority: n.priority,
        title: n.title,
        body: n.body,
        actionUrl: n.actionUrl,
        actionLabel: n.actionLabel,
        icon: n.icon,
        color: n.color,
        sourceModule: n.sourceModule,
        sourceId: n.sourceId?.toString?.() ?? null,
        metadata: n.metadata,
        sound: n.sound,
        read: n.read,
        createdAt: n.createdAt,
      })),
      page,
      limit,
      total,
    });
  } catch (err) {
    console.error('[notifications list]', err);
    return res.status(500).json({ message: 'Failed to list notifications.' });
  }
}

export async function unreadCount(req, res) {
  try {
    const userId = req.user.id;
    const base = {
      recipientId: new mongoose.Types.ObjectId(userId),
      read: false,
      dismissed: false,
      $or: [{ snoozeUntil: null }, { snoozeUntil: { $lte: new Date() } }],
    };
    const total = await Notification.countDocuments(base);
    const byCategory = await Notification.aggregate([
      { $match: base },
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]);
    const map = {};
    for (const row of byCategory) {
      map[row._id || 'UNKNOWN'] = row.count;
    }
    return res.json({ count: total, by_category: map });
  } catch (err) {
    console.error('[notifications unreadCount]', err);
    return res.status(500).json({ message: 'Failed to read count.' });
  }
}

export async function markRead(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const n = await Notification.findOneAndUpdate(
      { _id: id, recipientId: userId },
      { read: true, readAt: new Date() },
      { new: true }
    );
    if (!n) {
      return res.status(404).json({ message: 'Not found.' });
    }
    emitToUser(userId, 'notification:updated', { id, read: true });
    return res.json({ notification: serializeNotificationDoc(n) });
  } catch (err) {
    console.error('[notifications markRead]', err);
    return res.status(500).json({ message: 'Failed to update.' });
  }
}

export async function markAllRead(req, res) {
  try {
    const userId = req.user.id;
    const category = typeof req.body?.category === 'string' ? req.body.category : '';
    const filter = { recipientId: userId, read: false, dismissed: false };
    if (category) {
      filter.category = category;
    }
    await Notification.updateMany(filter, { read: true, readAt: new Date() });
    emitToUser(userId, 'notification:count', await getCountPayload(userId));
    return res.json({ ok: true });
  } catch (err) {
    console.error('[notifications markAllRead]', err);
    return res.status(500).json({ message: 'Failed to update.' });
  }
}

async function getCountPayload(userId) {
  const base = {
    recipientId: new mongoose.Types.ObjectId(userId),
    read: false,
    dismissed: false,
    $or: [{ snoozeUntil: null }, { snoozeUntil: { $lte: new Date() } }],
  };
  const total = await Notification.countDocuments(base);
  const byCategory = await Notification.aggregate([
    { $match: base },
    { $group: { _id: '$category', count: { $sum: 1 } } },
  ]);
  const map = {};
  for (const row of byCategory) {
    map[row._id || 'UNKNOWN'] = row.count;
  }
  return { total, by_category: map };
}

export async function dismiss(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const n = await Notification.findOneAndUpdate(
      { _id: id, recipientId: userId },
      { dismissed: true, dismissedAt: new Date() },
      { new: true }
    );
    if (!n) {
      return res.status(404).json({ message: 'Not found.' });
    }
    emitToUser(userId, 'notification:updated', { id, dismissed: true });
    emitToUser(userId, 'notification:count', await getCountPayload(userId));
    return res.json({ ok: true });
  } catch (err) {
    console.error('[notifications dismiss]', err);
    return res.status(500).json({ message: 'Failed to dismiss.' });
  }
}

export async function snooze(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const until = req.body?.until ? new Date(req.body.until) : null;
    if (!until || Number.isNaN(until.getTime())) {
      return res.status(400).json({ message: 'Invalid until date.' });
    }
    const n = await Notification.findOneAndUpdate(
      { _id: id, recipientId: userId },
      { snoozeUntil: until },
      { new: true }
    );
    if (!n) {
      return res.status(404).json({ message: 'Not found.' });
    }
    emitToUser(userId, 'notification:count', await getCountPayload(userId));
    return res.json({ ok: true });
  } catch (err) {
    console.error('[notifications snooze]', err);
    return res.status(500).json({ message: 'Failed to snooze.' });
  }
}

/** Dev / admin helper: create a test notification for current user */
export async function createTest(req, res) {
  try {
    const { emitNotification } = await import('../services/notification.service.js');
    const doc = await emitNotification({
      recipientId: req.user.id,
      recipientRole: req.user.role,
      type: 'SYSTEM_WELCOME',
      category: 'SYSTEM',
      priority: 'NORMAL',
      title: 'Notifications are live',
      body: 'Real-time delivery via WebSocket is connected.',
      actionUrl: '/calendar',
      actionLabel: 'Open calendar',
      sourceModule: 'system',
    });
    return res.status(201).json({ notification: serializeNotificationDoc(doc) });
  } catch (err) {
    console.error('[notifications createTest]', err);
    return res.status(500).json({ message: 'Failed to create.' });
  }
}
