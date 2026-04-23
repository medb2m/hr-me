import { Notification } from '../models/notification.model.js';
import { emitToUser } from '../realtime/socket-hub.js';

/**
 * @param {{
 *   recipientId: import('mongoose').Types.ObjectId | string;
 *   recipientRole?: string;
 *   type: string;
 *   category?: string;
 *   priority?: string;
 *   title: string;
 *   body?: string;
 *   actionUrl?: string | null;
 *   actionLabel?: string | null;
 *   icon?: string;
 *   color?: string;
 *   sourceModule?: string;
 *   sourceId?: import('mongoose').Types.ObjectId | string | null;
 *   metadata?: Record<string, unknown>;
 *   sound?: string;
 *   groupedKey?: string | null;
 * }} payload
 */
export async function emitNotification(payload) {
  const doc = await Notification.create({
    recipientId: payload.recipientId,
    recipientRole: payload.recipientRole || '',
    type: payload.type,
    category: payload.category || 'SYSTEM',
    priority: payload.priority || 'NORMAL',
    title: payload.title,
    body: payload.body || '',
    actionUrl: payload.actionUrl ?? null,
    actionLabel: payload.actionLabel ?? null,
    icon: payload.icon || 'bell',
    color: payload.color || '#7B1C2E',
    sourceModule: payload.sourceModule || '',
    sourceId: payload.sourceId || null,
    metadata: payload.metadata || {},
    sound: payload.sound || 'chime_medium',
    groupedKey: payload.groupedKey ?? null,
    deliveredVia: ['IN_APP'],
  });

  const lean = doc.toObject();
  emitToUser(String(payload.recipientId), 'notification:new', {
    notification: {
      id: lean._id.toString(),
      ...serializeNotification(lean),
    },
  });
  return doc;
}

function serializeNotification(n) {
  return {
    recipientId: n.recipientId?.toString?.() ?? n.recipientId,
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
    sourceId: n.sourceId?.toString?.() ?? n.sourceId,
    metadata: n.metadata,
    sound: n.sound,
    read: n.read,
    dismissed: n.dismissed,
    snoozeUntil: n.snoozeUntil,
    createdAt: n.createdAt,
  };
}

export function serializeNotificationDoc(doc) {
  const n = doc.toObject ? doc.toObject() : doc;
  return {
    id: n._id.toString(),
    ...serializeNotification(n),
  };
}
