import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { getJwtSecret } from '../utils/jwt.js';
import { Meeting } from '../models/meeting.model.js';
import { MeetingChat } from '../models/meeting-chat.model.js';
import { Notification } from '../models/notification.model.js';
import { User } from '../models/user.model.js';

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
    // Images collées dans le chat (data URL compressée côté client)
    maxHttpBufferSize: 8e6,
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
        socket.data.guestName = typeof payload.name === 'string' ? payload.name.slice(0, 60) : '';
        return next();
      }
      // Invité en salle d'attente : connecté mais pas encore admis dans la salle
      if (payload.typ === 'meeting_wait') {
        socket.data.meetingWait = {
          meetingId: payload.meetingId,
          roomId: payload.roomId,
          name: typeof payload.name === 'string' ? payload.name.slice(0, 60) : 'Invité',
        };
        socket.data.userId = payload.sub;
        socket.data.role = 'guest';
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

  // Invités en salle d'attente : roomId → Map<guestId, { name, socketId }>
  const pendingGuests = new Map();

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
        const roomMembers = async () => {
          const socks = await io.in(`meeting:${roomId}`).fetchSockets();
          const seen = new Map();
          for (const x of socks) {
            const id = x.data.userId;
            if (id && !seen.has(id)) {
              seen.set(id, { userId: id, email: x.data.email || '' });
            }
          }
          return [...seen.values()];
        };
        // Historique du chat : persiste après départ/retour dans la salle
        const chatHistory = async () => {
          const list = await MeetingChat.find({ roomId })
            .sort({ createdAt: -1 })
            .limit(100)
            .lean();
          return list.reverse().map((m) => ({
            senderId: m.senderId ? m.senderId.toString() : '',
            senderName: m.senderName,
            senderAvatar: m.senderAvatar,
            content: m.content,
            imageUrl: m.imageUrl,
            sentAt: m.sentAt.toISOString(),
          }));
        };
        if (join?.roomId === roomId && join.meetingId === meeting._id.toString()) {
          socket.join(`meeting:${roomId}`);
          socket.to(`meeting:${roomId}`).emit('meeting:peer-present', {
            userId,
            email: socket.data.email || '',
            name: socket.data.guestName || '',
          });
          cb?.({ ok: true, meetingId: meeting._id.toString(), members: await roomMembers(), messages: await chatHistory() });
          // Animateur qui arrive : renvoyer les invités en attente déjà déposés
          if (meeting.createdByAgentId.toString() === userId) {
            for (const [gid, g] of pendingGuests.get(roomId) || []) {
              socket.emit('meeting:guest-request', { guestId: gid, name: g.name });
            }
          }
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
        socket.to(`meeting:${roomId}`).emit('meeting:peer-present', {
          userId,
          email: socket.data.email || '',
          name: socket.data.guestName || '',
        });
        cb?.({ ok: true, meetingId: meeting._id.toString(), members: await roomMembers(), messages: await chatHistory() });
        if (isCreator) {
          for (const [gid, g] of pendingGuests.get(roomId) || []) {
            socket.emit('meeting:guest-request', { guestId: gid, name: g.name });
          }
        }
      } catch (e) {
        console.error('[meeting:join-room]', e);
        cb?.({ ok: false, message: 'Server error' });
      }
    });

    socket.on('meeting:leave-room', (payload) => {
      const roomId = typeof payload?.roomId === 'string' ? payload.roomId : '';
      if (!roomId || !socket.rooms.has(`meeting:${roomId}`)) {
        return;
      }
      socket.leave(`meeting:${roomId}`);
      socket.to(`meeting:${roomId}`).emit('meeting:peer-left', {
        userId: socket.data.userId,
        email: socket.data.email || '',
      });
    });

    // ── Salle d'attente invité : demande d'admission à l'animateur ──
    socket.on('meeting:request-join', (payload, cb) => {
      const w = socket.data.meetingWait;
      const roomId = typeof payload?.roomId === 'string' ? payload.roomId : w?.roomId;
      if (!w || w.roomId !== roomId) {
        cb?.({ ok: false, message: 'Not waiting.' });
        return;
      }
      let room = pendingGuests.get(roomId);
      if (!room) {
        pendingGuests.set(roomId, (room = new Map()));
      }
      room.set(socket.data.userId, { name: w.name, socketId: socket.id });
      io.to(`meeting:${roomId}`).emit('meeting:guest-request', {
        guestId: socket.data.userId,
        name: w.name,
      });
      cb?.({ ok: true });
    });

    // L'animateur admet ou refuse un invité en attente
    socket.on('meeting:guest-decision', async (payload) => {
      try {
        const roomId = typeof payload?.roomId === 'string' ? payload.roomId : '';
        const guestId = typeof payload?.guestId === 'string' ? payload.guestId : '';
        const approved = payload?.approved === true;
        if (!roomId || !guestId || !socket.rooms.has(`meeting:${roomId}`)) {
          return;
        }
        const meeting = await Meeting.findOne({ roomId }).lean();
        if (!meeting || meeting.createdByAgentId.toString() !== socket.data.userId) {
          return;
        }
        const pend = pendingGuests.get(roomId)?.get(guestId);
        if (!pend) {
          return;
        }
        pendingGuests.get(roomId).delete(guestId);
        const guestSock = io.sockets.sockets.get(pend.socketId);
        if (!guestSock) {
          return;
        }
        if (approved) {
          const token = jwt.sign(
            {
              sub: guestId,
              typ: 'meeting_join',
              meetingId: meeting._id.toString(),
              roomId,
              meetingRole: 'guest',
              name: pend.name,
              guest: true,
            },
            getJwtSecret(),
            { expiresIn: '12h' }
          );
          // Passe le socket invité en mode « admis » pour que join-room fonctionne
          guestSock.data.meetingJoin = {
            meetingId: meeting._id.toString(),
            roomId,
            role: 'guest',
            userId: guestId,
          };
          guestSock.data.guestName = pend.name;
          guestSock.emit('meeting:guest-approved', { token });
        } else {
          guestSock.emit('meeting:guest-denied', {});
        }
      } catch (e) {
        console.error('[meeting:guest-decision]', e);
      }
    });

    // L'invité retire sa demande
    socket.on('meeting:withdraw', (payload) => {
      const w = socket.data.meetingWait;
      const roomId = typeof payload?.roomId === 'string' ? payload.roomId : w?.roomId;
      if (!w || w.roomId !== roomId) {
        return;
      }
      pendingGuests.get(roomId)?.delete(socket.data.userId);
      socket.to(`meeting:${roomId}`).emit('meeting:guest-cancel', { guestId: socket.data.userId });
    });

    // Déconnexion brutale (onglet fermé, perte réseau) : prévenir les salles occupées
    socket.on('disconnecting', () => {
      // Invité en attente qui part : retirer sa demande chez l'animateur
      const w = socket.data.meetingWait;
      if (w?.roomId && pendingGuests.get(w.roomId)?.has(socket.data.userId)) {
        pendingGuests.get(w.roomId).delete(socket.data.userId);
        socket.to(`meeting:${w.roomId}`).emit('meeting:guest-cancel', {
          guestId: socket.data.userId,
        });
      }
      for (const r of socket.rooms) {
        if (r.startsWith('meeting:')) {
          socket.to(r).emit('meeting:peer-left', {
            userId: socket.data.userId,
            email: socket.data.email || '',
          });
        }
      }
    });

    // État micro/caméra relayé à la salle (avatar + indicateurs)
    socket.on('meeting:media-state', (payload) => {
      const roomId = typeof payload?.roomId === 'string' ? payload.roomId : '';
      if (!roomId || !socket.rooms.has(`meeting:${roomId}`)) {
        return;
      }
      socket.to(`meeting:${roomId}`).emit('meeting:media-state', {
        userId: socket.data.userId,
        email: socket.data.email || '',
        micOn: payload.micOn !== false,
        camOn: payload.camOn !== false,
        micLocked: payload.micLocked === true,
        camLocked: payload.camLocked === true,
        sharing: payload.sharing === true,
        name: typeof payload.name === 'string' ? payload.name.slice(0, 80) : '',
      });
    });

    socket.on('meeting:signal', (payload) => {
      const roomId = payload?.roomId;
      if (typeof roomId !== 'string' || !socket.rooms.has(`meeting:${roomId}`)) {
        return;
      }
      socket.to(`meeting:${roomId}`).emit('meeting:signal', {
        from: socket.data.userId,
        to: typeof payload.to === 'string' ? payload.to : '',
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
        const allowedActions = [
          'mute_audio',
          'mute_video',
          'disable_audio',
          'disable_video',
          'unmute_audio',
          'unmute_video',
          'stop_share',
        ];
        if (!roomId || !targetUserId || !allowedActions.includes(action)) {
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

    socket.on('chat:message', async (payload) => {
      const roomId = payload?.roomId;
      if (typeof roomId !== 'string' || !socket.rooms.has(`meeting:${roomId}`)) {
        return;
      }
      try {
        // Image collée : data URL image/* uniquement (compressée côté client)
        let image = '';
        const raw = payload?.image;
        if (
          typeof raw === 'string' &&
          /^data:image\/(png|jpe?g|webp|gif);base64,/i.test(raw) &&
          raw.length <= 7_000_000
        ) {
          image = raw;
        }
        const content = String(payload?.content || '').slice(0, 4000);
        if (!content && !image) {
          return;
        }
        // Nom résolu depuis les participants déclarés de la réunion
        let senderName = '';
        let senderAvatar = '';
        let meeting = null;
        try {
          meeting = await Meeting.findOne({ roomId }).lean();
          const myEmail = normalizeSocketEmail(socket.data.email);
          const me = meeting?.participants?.find(
            (p) =>
              (p.userId && p.userId.toString() === socket.data.userId) ||
              (myEmail && normalizeSocketEmail(p.email) === myEmail)
          );
          if (me) {
            senderName = me.name || me.email || '';
          }
        } catch {
          /* */
        }
        // Photo de profil : toujours depuis la fiche User (par id, sinon e-mail)
        try {
          const u = await User.findOne(
            socket.data.userId
              ? { _id: socket.data.userId }
              : { email: normalizeSocketEmail(socket.data.email) }
          )
            .select('name avatarUrl')
            .lean();
          if (u) {
            senderAvatar = u.avatarUrl || '';
            if (!senderName) {
              senderName = u.name || '';
            }
          }
        } catch {
          /* */
        }
        if (!senderName) {
          senderName = socket.data.guestName || socket.data.email || '';
        }
        // Copie persistante pour l'historique (salle, animateur, admins)
        try {
          if (meeting) {
            await MeetingChat.create({
              meetingId: meeting._id,
              roomId,
              senderId:
                socket.data.userId && mongoose.isValidObjectId(socket.data.userId)
                  ? socket.data.userId
                  : null,
              senderName,
              senderAvatar,
              content,
              imageUrl: image,
            });
          }
        } catch (e) {
          console.error('[chat:message persist]', e);
        }
        io.to(`meeting:${roomId}`).emit('chat:message', {
          senderId: socket.data.userId,
          senderName,
          senderAvatar,
          content,
          imageUrl: image,
          sentAt: new Date().toISOString(),
        });
      } catch (e) {
        console.error('[chat:message]', e);
      }
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
