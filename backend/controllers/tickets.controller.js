import mongoose from 'mongoose';
import { SupportTicket } from '../models/support-ticket.model.js';
import { User } from '../models/user.model.js';
import { emitNotification, notifyRole } from '../services/notification.service.js';
import { uploadsPublicPath } from '../helpers/upload-basics.js';

/** Rôles « staff » — agents internes qui gèrent le kanban. */
const STAFF_ROLES = new Set(['admin', 'agent', 'director', 'recruiter']);
const STATUSES = new Set(['open', 'in_progress', 'waiting', 'resolved', 'closed']);
const PRIORITIES = new Set(['low', 'medium', 'high', 'urgent']);

const isStaff = (role) => STAFF_ROLES.has(role);

const fileDto = (f) => ({
  filename: f.filename,
  path: uploadsPublicPath('tickets', f.filename),
  originalName: f.originalname || f.filename,
  mime: f.mimetype || '',
  size: f.size || 0,
});

const dto = (t) => ({
  id: t._id,
  subject: t.subject,
  description: t.description || '',
  kind: t.kind,
  status: t.status,
  priority: t.priority,
  category: t.category || 'general',
  createdBy: t.createdBy?.toString?.() || null,
  createdByName: t.createdByName || '',
  createdByRole: t.createdByRole || '',
  createdByEmail: t.createdByEmail || '',
  assignedTo: t.assignedTo?.toString?.() || null,
  assignedToName: t.assignedToName || '',
  attachments: (t.attachments || []).map((f) => ({
    name: f.originalName || f.filename,
    path: f.path,
    mime: f.mime,
    size: f.size,
  })),
  comments: (t.comments || []).map((c) => ({
    id: c._id,
    authorName: c.authorName || '',
    authorRole: c.authorRole || '',
    body: c.body,
    createdAt: c.createdAt,
    mine: false, // rempli par l'appelant si besoin
  })),
  history: (t.history || []).map((h) => ({
    status: h.status,
    changedByName: h.changedByName || '',
    changedAt: h.changedAt,
  })),
  resolvedAt: t.resolvedAt || null,
  closedAt: t.closedAt || null,
  createdAt: t.createdAt,
  updatedAt: t.updatedAt,
});

async function userLabel(userId) {
  const u = await User.findById(userId).select('name email role').lean();
  return u ? { name: u.name || u.email, email: u.email } : null;
}

/**
 * POST /api/tickets — tout utilisateur connecté.
 * client/candidate → ticket `support` ; staff → ticket `internal` (assignable).
 * Multipart : subject, description?, category?, priority?, assignedTo?, files[].
 */
export const createTicket = async (req, res) => {
  try {
    const subject = String(req.body?.subject || '').trim().slice(0, 180);
    if (subject.length < 3) {
      return res.status(400).json({ message: 'Indiquez un sujet (au moins 3 caractères).' });
    }
    const staff = isStaff(req.user.role);
    const kind = staff ? (req.body?.kind === 'support' ? 'support' : 'internal') : 'support';
    const description = String(req.body?.description || '').trim().slice(0, 8000);
    const category = String(req.body?.category || 'general').trim().slice(0, 60) || 'general';
    const priority = PRIORITIES.has(req.body?.priority) ? req.body.priority : 'medium';

    let assignedTo = null;
    let assignedToName = '';
    if (staff && mongoose.isValidObjectId(req.body?.assignedTo)) {
      const target = await User.findOne({
        _id: req.body.assignedTo,
        role: { $in: [...STAFF_ROLES] },
      })
        .select('name email')
        .lean();
      if (target) {
        assignedTo = target._id;
        assignedToName = target.name || target.email;
      }
    }

    const me = await userLabel(req.user.id);
    const ticket = await SupportTicket.create({
      subject,
      description,
      kind,
      status: 'open',
      priority,
      category,
      createdBy: req.user.id,
      createdByName: me?.name || req.user.email,
      createdByRole: req.user.role,
      createdByEmail: req.user.email,
      assignedTo,
      assignedToName,
      attachments: (req.files || []).map(fileDto),
      history: [{ status: 'open', changedBy: req.user.id, changedByName: me?.name || '' }],
    });

    // Notifications — création support → admins ; interne assigné → assigné, sinon admins.
    const link = `/admin/tickets/${ticket._id}`;
    if (kind === 'support') {
      notifyRole('admin', {
        type: 'TICKET_SUPPORT',
        category: 'TICKET',
        priority: priority === 'urgent' ? 'URGENT' : 'NORMAL',
        title: `Demande de support — ${subject}`,
        body: `${me?.name || req.user.email} · ${category}`,
        actionUrl: link,
        icon: 'ticket',
        color: '#0ea5e9',
        sourceModule: 'tickets',
        sourceId: ticket._id,
      }).catch(() => {});
      emitNotification({
        recipientId: req.user.id,
        type: 'TICKET_CREATED',
        category: 'TICKET',
        title: 'Demande envoyée',
        body: `« ${subject} » — l’équipe Al Wassit vous répondra ici.`,
        actionUrl: req.user.role === 'client' ? '/espace/support' : '/candidat/support',
        icon: 'ticket',
        sourceModule: 'tickets',
        sourceId: ticket._id,
      }).catch(() => {});
    } else {
      emitNotification({
        recipientId: req.user.id,
        type: 'TICKET_CREATED',
        category: 'TICKET',
        title: `Ticket créé — ${subject}`,
        body: assignedToName ? `Assigné à ${assignedToName}.` : 'Non assigné pour l’instant.',
        actionUrl: link,
        icon: 'ticket',
        sourceModule: 'tickets',
        sourceId: ticket._id,
      }).catch(() => {});
      if (assignedTo && String(assignedTo) !== req.user.id) {
        emitNotification({
          recipientId: assignedTo,
          type: 'TICKET_ASSIGNED',
          category: 'TICKET',
          priority: priority === 'urgent' ? 'URGENT' : 'HIGH',
          title: `Ticket assigné — ${subject}`,
          body: `${me?.name || 'Un collègue'} vous a assigné ce ticket (${priority}).`,
          actionUrl: link,
          icon: 'ticket',
          color: '#eab308',
          sourceModule: 'tickets',
          sourceId: ticket._id,
        }).catch(() => {});
      } else if (!assignedTo) {
        notifyRole('admin', {
          type: 'TICKET_INTERNAL',
          category: 'TICKET',
          priority: priority === 'urgent' ? 'URGENT' : 'NORMAL',
          title: `Ticket interne — ${subject}`,
          body: `${me?.name || req.user.email} · ${category} · non assigné`,
          actionUrl: link,
          icon: 'ticket',
          sourceModule: 'tickets',
          sourceId: ticket._id,
        }).catch(() => {});
      }
    }

    return res.status(201).json({ ticket: dto(ticket.toObject()) });
  } catch (err) {
    console.error('[tickets/create]', err);
    return res.status(500).json({ message: 'Création du ticket impossible.' });
  }
};

/**
 * GET /api/tickets — staff : tous + filtres (kind,status,priority,assignee,category,q).
 * Autres rôles : leurs propres demandes.
 */
export const listTickets = async (req, res) => {
  try {
    const staff = isStaff(req.user.role);
    const filter = staff ? {} : { createdBy: req.user.id };
    if (staff) {
      const { kind, status, priority, assignee, category, q } = req.query;
      if (kind === 'support' || kind === 'internal') filter.kind = kind;
      if (STATUSES.has(status)) filter.status = status;
      if (PRIORITIES.has(priority)) filter.priority = priority;
      if (assignee === 'me') filter.assignedTo = req.user.id;
      else if (assignee === 'none') filter.assignedTo = null;
      else if (mongoose.isValidObjectId(assignee)) filter.assignedTo = assignee;
      if (category) filter.category = String(category).slice(0, 60);
      if (q) filter.subject = { $regex: String(q).slice(0, 80), $options: 'i' };
    }
    const items = await SupportTicket.find(filter)
      .sort({ createdAt: -1 })
      .limit(300)
      .lean();
    return res.json({
      tickets: items.map((t) => ({
        ...dto(t),
        comments: undefined,
        commentsCount: (t.comments || []).length,
      })),
    });
  } catch (err) {
    console.error('[tickets/list]', err);
    return res.status(500).json({ message: 'Chargement impossible.' });
  }
};

/** GET /api/tickets/board — kanban staff : colonnes par statut. */
export const getBoard = async (req, res) => {
  try {
    if (!isStaff(req.user.role)) {
      return res.status(403).json({ message: 'Accès réservé à l’équipe.' });
    }
    const filter = {};
    const { kind, priority, assignee, category, q } = req.query;
    if (kind === 'support' || kind === 'internal') filter.kind = kind;
    if (PRIORITIES.has(priority)) filter.priority = priority;
    if (assignee === 'me') filter.assignedTo = req.user.id;
    else if (assignee === 'none') filter.assignedTo = null;
    else if (mongoose.isValidObjectId(assignee)) filter.assignedTo = assignee;
    if (category) filter.category = String(category).slice(0, 60);
    if (q) filter.subject = { $regex: String(q).slice(0, 80), $options: 'i' };

    const items = await SupportTicket.find(filter)
      .sort({ priority: -1, createdAt: -1 })
      .limit(400)
      .lean();

    const columns = { open: [], in_progress: [], waiting: [], resolved: [], closed: [] };
    for (const t of items) {
      (columns[t.status] || columns.open).push({
        ...dto(t),
        comments: undefined,
        commentsCount: (t.comments || []).length,
      });
    }
    return res.json({ columns });
  } catch (err) {
    console.error('[tickets/board]', err);
    return res.status(500).json({ message: 'Chargement impossible.' });
  }
};

async function loadTicket(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(404).json({ message: 'Ticket introuvable.' });
    return null;
  }
  const t = await SupportTicket.findById(req.params.id).lean();
  if (!t) {
    res.status(404).json({ message: 'Ticket introuvable.' });
    return null;
  }
  if (!isStaff(req.user.role) && String(t.createdBy) !== req.user.id) {
    res.status(403).json({ message: 'Accès refusé.' });
    return null;
  }
  return t;
}

/** GET /api/tickets/:id — staff ou créateur. */
export const getTicket = async (req, res) => {
  try {
    const t = await loadTicket(req, res);
    if (!t) return;
    return res.json({ ticket: dto(t) });
  } catch (err) {
    console.error('[tickets/get]', err);
    return res.status(500).json({ message: 'Lecture impossible.' });
  }
};

/** PATCH /api/tickets/:id — staff : status/priority/category/assignedTo. */
export const patchTicket = async (req, res) => {
  try {
    if (!isStaff(req.user.role)) {
      return res.status(403).json({ message: 'Accès réservé à l’équipe.' });
    }
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: 'Ticket introuvable.' });
    }
    const t = await SupportTicket.findById(req.params.id);
    if (!t) return res.status(404).json({ message: 'Ticket introuvable.' });

    const me = await userLabel(req.user.id);
    const b = req.body || {};
    let changedStatus = false;

    if (STATUSES.has(b.status) && b.status !== t.status) {
      t.status = b.status;
      t.history.push({ status: b.status, changedBy: req.user.id, changedByName: me?.name || '' });
      if (b.status === 'resolved') t.resolvedAt = new Date();
      if (b.status === 'closed') t.closedAt = new Date();
      changedStatus = true;
    }
    if (PRIORITIES.has(b.priority)) t.priority = b.priority;
    if (typeof b.category === 'string' && b.category.trim()) {
      t.category = b.category.trim().slice(0, 60);
    }
    if (b.assignedTo !== undefined) {
      if (mongoose.isValidObjectId(b.assignedTo)) {
        const target = await User.findOne({
          _id: b.assignedTo,
          role: { $in: [...STAFF_ROLES] },
        }).lean();
        if (target) {
          const isNew = String(t.assignedTo) !== String(target._id);
          t.assignedTo = target._id;
          t.assignedToName = target.name || target.email;
          if (isNew && String(target._id) !== req.user.id) {
            emitNotification({
              recipientId: target._id,
              type: 'TICKET_ASSIGNED',
              category: 'TICKET',
              priority: 'HIGH',
              title: `Ticket assigné — ${t.subject}`,
              body: `${me?.name || 'Un collègue'} vous a assigné ce ticket.`,
              actionUrl: `/admin/tickets/${t._id}`,
              icon: 'ticket',
              color: '#eab308',
              sourceModule: 'tickets',
              sourceId: t._id,
            }).catch(() => {});
          }
        }
      } else if (b.assignedTo === null || b.assignedTo === '') {
        t.assignedTo = null;
        t.assignedToName = '';
      }
    }

    await t.save();

    if (changedStatus && String(t.createdBy) !== req.user.id) {
      const labels = {
        in_progress: 'en cours de traitement',
        waiting: 'en attente',
        resolved: 'résolu',
        closed: 'clôturé',
        open: 'rouvert',
      };
      emitNotification({
        recipientId: t.createdBy,
        type: 'TICKET_STATUS',
        category: 'TICKET',
        priority: t.status === 'resolved' ? 'HIGH' : 'NORMAL',
        title: `Ticket ${labels[t.status] || t.status}`,
        body: `« ${t.subject} »`,
        actionUrl:
          t.kind === 'support'
            ? t.createdByRole === 'client'
              ? '/espace/support'
              : '/candidat/support'
            : `/admin/tickets/${t._id}`,
        icon: t.status === 'resolved' ? 'check-circle' : 'ticket',
        color: t.status === 'resolved' ? '#15803d' : '#eab308',
        sourceModule: 'tickets',
        sourceId: t._id,
      }).catch(() => {});
    }

    return res.json({ ticket: dto(t.toObject()) });
  } catch (err) {
    console.error('[tickets/patch]', err);
    return res.status(500).json({ message: 'Mise à jour impossible.' });
  }
};

/** POST /api/tickets/:id/comments — staff ou créateur. */
export const addComment = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: 'Ticket introuvable.' });
    }
    const t = await SupportTicket.findById(req.params.id);
    if (!t) return res.status(404).json({ message: 'Ticket introuvable.' });
    const staff = isStaff(req.user.role);
    if (!staff && String(t.createdBy) !== req.user.id) {
      return res.status(403).json({ message: 'Accès refusé.' });
    }
    const body = String(req.body?.body || '').trim().slice(0, 4000);
    if (body.length < 2) {
      return res.status(400).json({ message: 'Commentaire vide.' });
    }
    const me = await userLabel(req.user.id);
    t.comments.push({
      author: req.user.id,
      authorName: me?.name || req.user.email,
      authorRole: req.user.role,
      body,
    });
    await t.save();

    // Notifier l'autre partie : staff → créateur ; utilisateur → admins (support) ou assigné.
    const link =
      t.kind === 'support'
        ? t.createdByRole === 'client'
          ? '/espace/support'
          : '/candidat/support'
        : `/admin/tickets/${t._id}`;
    if (staff && String(t.createdBy) !== req.user.id) {
      emitNotification({
        recipientId: t.createdBy,
        type: 'TICKET_REPLY',
        category: 'TICKET',
        title: `Réponse de l’équipe — ${t.subject}`,
        body: body.slice(0, 140),
        actionUrl: link,
        icon: 'mail',
        color: '#0ea5e9',
        sourceModule: 'tickets',
        sourceId: t._id,
      }).catch(() => {});
    }
    if (!staff) {
      notifyRole('admin', {
        type: 'TICKET_REPLY',
        category: 'TICKET',
        title: `Réponse utilisateur — ${t.subject}`,
        body: body.slice(0, 140),
        actionUrl: `/admin/tickets/${t._id}`,
        icon: 'mail',
        sourceModule: 'tickets',
        sourceId: t._id,
      }).catch(() => {});
    }

    return res.status(201).json({ ticket: dto(t.toObject()) });
  } catch (err) {
    console.error('[tickets/comment]', err);
    return res.status(500).json({ message: 'Envoi impossible.' });
  }
};

/** GET /api/tickets/stats — tableau de bord staff. */
export const getStats = async (req, res) => {
  try {
    if (!isStaff(req.user.role)) {
      return res.status(403).json({ message: 'Accès réservé à l’équipe.' });
    }
    const now = Date.now();
    const weekAgo = new Date(now - 7 * 86400000);
    const [byStatus, byKind, byPriority, resolved7d, openUrgent, perAssignee, avgResolution] =
      await Promise.all([
        SupportTicket.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
        SupportTicket.aggregate([{ $group: { _id: '$kind', n: { $sum: 1 } } }]),
        SupportTicket.aggregate([
          { $match: { status: { $nin: ['resolved', 'closed'] } } },
          { $group: { _id: '$priority', n: { $sum: 1 } } },
        ]),
        SupportTicket.countDocuments({ resolvedAt: { $gte: weekAgo } }),
        SupportTicket.countDocuments({ priority: 'urgent', status: { $nin: ['resolved', 'closed'] } }),
        SupportTicket.aggregate([
          { $match: { assignedTo: { $ne: null } } },
          {
            $group: {
              _id: '$assignedTo',
              name: { $last: '$assignedToName' },
              open: {
                $sum: { $cond: [{ $in: ['$status', ['resolved', 'closed']] }, 0, 1] },
              },
              resolved: {
                $sum: { $cond: [{ $in: ['$status', ['resolved', 'closed']] }, 1, 0] },
              },
            },
          },
          { $sort: { open: -1 } },
        ]),
        SupportTicket.aggregate([
          { $match: { resolvedAt: { $ne: null } } },
          { $project: { ms: { $subtract: ['$resolvedAt', '$createdAt'] } } },
          { $group: { _id: null, avg: { $avg: '$ms' } } },
        ]),
      ]);

    const statusMap = Object.fromEntries(byStatus.map((r) => [r._id, r.n]));
    const kindMap = Object.fromEntries(byKind.map((r) => [r._id, r.n]));
    const prioMap = Object.fromEntries(byPriority.map((r) => [r._id, r.n]));
    const avgMs = avgResolution[0]?.avg || 0;

    return res.json({
      total: Object.values(statusMap).reduce((a, b) => a + b, 0),
      byStatus: { open: 0, in_progress: 0, waiting: 0, resolved: 0, closed: 0, ...statusMap },
      byKind: { support: 0, internal: 0, ...kindMap },
      openByPriority: { low: 0, medium: 0, high: 0, urgent: 0, ...prioMap },
      resolvedLast7d: resolved7d,
      urgentOpen: openUrgent,
      avgResolutionHours: avgMs ? Math.round((avgMs / 3600000) * 10) / 10 : 0,
      perAssignee: perAssignee.map((r) => ({
        id: r._id,
        name: r.name || '—',
        open: r.open,
        resolved: r.resolved,
      })),
    });
  } catch (err) {
    console.error('[tickets/stats]', err);
    return res.status(500).json({ message: 'Statistiques indisponibles.' });
  }
};

/** GET /api/tickets/assignees — liste des membres staff (pour l’assignation). */
export const listAssignees = async (req, res) => {
  try {
    if (!isStaff(req.user.role)) {
      return res.status(403).json({ message: 'Accès réservé à l’équipe.' });
    }
    const users = await User.find({ role: { $in: [...STAFF_ROLES] } })
      .select('name email role')
      .sort({ name: 1, email: 1 })
      .limit(200)
      .lean();
    return res.json({
      assignees: users.map((u) => ({
        id: u._id,
        name: u.name || u.email,
        email: u.email,
        role: u.role,
      })),
    });
  } catch (err) {
    console.error('[tickets/assignees]', err);
    return res.status(500).json({ message: 'Chargement impossible.' });
  }
};
