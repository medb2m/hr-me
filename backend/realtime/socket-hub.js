import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { getJwtSecret } from '../utils/jwt.js';
import { Meeting } from '../models/meeting.model.js';
import { Notification } from '../models/notification.model.js';

function normalizeSocketEmail(e) {
  return typeof e === 'string' ? e.trim().toLowerCase() : '';
}

/** @type {import('socket.io').Server | null} */
let ioInstance = null;

export function getIo() {
  return ioInstance;
}

/**
 * @param {import('http').Server} httpServer
 * @param {string} [frontendOrigin]
 */
export function attachSocketIo(httpServer, frontendOrigin) {
  const corsOrigin =
    frontendOrigin ||
    process.env.FRONTEND_URL ||
    process.env.PUBLIC_APP_URL ||
    'http://localhost:4200';

  const io = new Server(httpServer, {
    path: '/socket.io',
    cors: {
      origin: corsOrigin.includes(',') ? corsOrigin.split(',').map((s) => s.trim()) : corsOrigin,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.query?.token ||
        (typeof socket.handshake.headers.authorization === 'string' &&
        socket.handshake.headers.authorization.startsWith('Bearer ')
          ? socket.handshake.headers.authorization.slice(7)
          : null);
      if (!token || typeof token !== 'string') {
        return next(new Error('Unauthorized'));
      }
      const payload = jwt.verify(token, getJwtSecret());
      if (payload.typ === 'meeting_join') {
        socket.data.meetingJoin = {
          meetingId: payload.meetingId,
          roomId: payload.roomId,
          role: payload.meetingRole,
          userId: payload.sub,
        };
        socket.data.userId = payload.sub;
        socket.data.role = payload.meetingRole;
        return next();
      }
      if (!payload.sub) {
        return next(new Error('Unauthorized'));
      }
      socket.data.userId = payload.sub;
      socket.data.email = payload.email;
      socket.data.role = payload.role;
      return next();
    } catch {
      return next(new Error('Unauthorized'));
    }
  });

  io.on('connection', async (socket) => {
    const uid = socket.data.userId;
    if (uid) {
      socket.join(`user:${uid}`);
      socket.emit('socket:ready', { userId: uid });
    }
    if (uid && !socket.data.meetingJoin) {
      try {
        const items = await Notification.find({
          recipientId: new mongoose.Types.ObjectId(uid),
          dismissed: false,
          $or: [{ snoozeUntil: null }, { snoozeUntil: { $lte: new Date() } }],
        })
          .sort({ createdAt: -1 })
          .limit(25)
          .lean();
        socket.emit('notification:batch', {
          notifications: items.map((n) => ({
            id: n._id.toString(),
            type: n.type,
            category: n.category,
            priority: n.priority,
            title: n.title,
            body: n.body,
            actionUrl: n.actionUrl,
            read: n.read,
            createdAt: n.createdAt,
          })),
        });
        const unread = await Notification.countDocuments({
          recipientId: new mongoose.Types.ObjectId(uid),
          read: false,
          dismissed: false,
          $or: [{ snoozeUntil: null }, { snoozeUntil: { $lte: new Date() } }],
        });
        socket.emit('notification:count', { total: unread, by_category: {} });
      } catch (e) {
        console.error('[socket] notification batch', e.message);
      }
    }

    socket.on('calendar:subscribe', (payload) => {
      const ids = Array.isArray(payload?.agentIds) ? payload.agentIds : [];
      for (const id of ids) {
        if (typeof id === 'string' && /^[a-f\d]{24}$/i.test(id)) {
          socket.join(`calendar:agent:${id}`);
        }
      }
    });

    socket.on('meeting:join-room', async (payload, cb) => {
      try {
        const roomId = typeof payload?.roomId === 'string' ? payload.roomId : '';
        if (!roomId) {
          cb?.({ ok: false, message: 'roomId required' });
          return;
        }
        const meeting = await Meeting.findOne({ roomId }).lean();
        if (!meeting) {
          cb?.({ ok: false, message: 'Meeting not found' });
          return;
        }
        const join = socket.data.meetingJoin;
        const userId = socket.data.userId;
        if (join?.roomId === roomId && join.meetingId === meeting._id.toString()) {
          socket.join(`meeting:${roomId}`);
          socket.to(`meeting:${roomId}`).emit('meeting:peer-present', { userId });
          cb?.({ ok: true, meetingId: meeting._id.toString() });
          return;
        }
        const userEmail = normalizeSocketEmail(socket.data.email);
        const allowed = meeting.participants.some(
          (p) =>
            (p.userId && p.userId.toString() === userId) ||
            (userEmail && normalizeSocketEmail(p.email) === userEmail)
        );
        const isCreator = meeting.createdByAgentId.toString() === userId;
        if (!allowed && !isCreator) {
          cb?.({ ok: false, message: 'Not a participant' });
          return;
        }
        socket.join(`meeting:${roomId}`);
        socket.to(`meeting:${roomId}`).emit('meeting:peer-present', { userId });
        cb?.({ ok: true, meetingId: meeting._id.toString() });
      } catch (e) {
        console.error('[meeting:join-room]', e);
        cb?.({ ok: false, message: 'Server error' });
      }
    });

    socket.on('meeting:signal', (payload) => {
      const roomId = payload?.roomId;
      if (typeof roomId !== 'string' || !socket.rooms.has(`meeting:${roomId}`)) {
        return;
      }
      socket.to(`meeting:${roomId}`).emit('meeting:signal', {
        from: socket.data.userId,
        type: payload.type,
        sdp: payload.sdp,
        candidate: payload.candidate,
      });
    });

    socket.on('meeting:moderation', async (payload, cb) => {
      try {
        const roomId = typeof payload?.roomId === 'string' ? payload.roomId : '';
        const action = payload?.action;
        const targetUserId = typeof payload?.targetUserId === 'string' ? payload.targetUserId : '';
        if (!roomId || !targetUserId || !['mute_audio', 'mute_video'].includes(action)) {
          cb?.({ ok: false, message: 'Invalid payload.' });
          return;
        }
        if (!socket.rooms.has(`meeting:${roomId}`)) {
          cb?.({ ok: false, message: 'Not in room.' });
          return;
        }
        const meeting = await Meeting.findOne({ roomId }).lean();
        if (!meeting || meeting.createdByAgentId.toString() !== socket.data.userId) {
          cb?.({ ok: false, message: 'Host only.' });
          return;
        }
        io.to(`meeting:${roomId}`).emit('meeting:moderation', {
          action,
          targetUserId,
          fromHostId: socket.data.userId,
        });
        cb?.({ ok: true });
      } catch (e) {
        console.error('[meeting:moderation]', e);
        cb?.({ ok: false, message: 'Server error.' });
      }
    });

    socket.on('chat:message', (payload) => {
      const roomId = payload?.roomId;
      if (typeof roomId !== 'string' || !socket.rooms.has(`meeting:${roomId}`)) {
        return;
      }
      io.to(`meeting:${roomId}`).emit('chat:message', {
        senderId: socket.data.userId,
        content: String(payload.content || '').slice(0, 4000),
        sentAt: new Date().toISOString(),
      });
    });
  });

  ioInstance = io;
  return io;
}

/**
 * @param {string} userId
 * @param {string} event
 * @param {unknown} data
 */
export function emitToUser(userId, event, data) {
  ioInstance?.to(`user:${userId}`).emit(event, data);
}

/**
 * @param {string[]} agentIds
 * @param {string} event
 * @param {unknown} data
 */
export function emitToCalendarAgents(agentIds, event, data) {
  if (!ioInstance) {
    return;
  }
  for (const id of agentIds) {
    ioInstance.to(`calendar:agent:${id}`).emit(event, data);
  }
}
