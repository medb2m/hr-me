import cron from 'node-cron';
import { Meeting } from '../models/meeting.model.js';
import { ReminderDispatch } from '../models/reminder-dispatch.model.js';
import { emitNotification } from '../services/notification.service.js';

const WINDOWS_MIN = [
  { minutes: 24 * 60, type: 'MEETING_REMINDER_24H', priority: 'NORMAL' },
  { minutes: 60, type: 'MEETING_REMINDER_1H', priority: 'HIGH' },
  { minutes: 15, type: 'MEETING_REMINDER_15MIN', priority: 'URGENT' },
];

/**
 * Every minute: for upcoming meetings, emit reminder notifications once per window.
 */
export function startMeetingRemindersJob() {
  cron.schedule('* * * * *', async () => {
    const now = Date.now();
    try {
      for (const win of WINDOWS_MIN) {
        const target = new Date(now + win.minutes * 60 * 1000);
        const from = new Date(target.getTime() - 45 * 1000);
        const to = new Date(target.getTime() + 45 * 1000);

        const meetings = await Meeting.find({
          status: 'SCHEDULED',
          scheduledAt: { $gte: from, $lte: to },
        })
          .select('_id title scheduledAt durationMin createdByAgentId participants')
          .lean();

        for (const m of meetings) {
          const key = `${m._id.toString()}:${win.minutes}`;
          try {
            await ReminderDispatch.create({ key, meetingId: m._id });
          } catch (e) {
            if (e?.code === 11000) {
              continue;
            }
            console.error('[reminder job] dedup', e);
            continue;
          }

          const recipientIds = new Set();
          recipientIds.add(m.createdByAgentId.toString());
          for (const p of m.participants || []) {
            if (p.userId) {
              recipientIds.add(p.userId.toString());
            }
          }

          for (const uid of recipientIds) {
            try {
              await emitNotification({
                recipientId: uid,
                type: win.type,
                category: 'MEETING',
                priority: win.priority,
                title: `Rappel entretien : ${m.title}`,
                body: `L'entretien commence dans ${win.minutes >= 60 ? win.minutes / 60 + ' h' : win.minutes + ' min'}.`,
                actionUrl: `/meetings/${m._id}/lobby`,
                actionLabel: 'Lobby',
                sourceModule: 'meetings',
                sourceId: m._id,
                metadata: { meetingId: m._id.toString(), minutesBefore: win.minutes },
                sound: 'bell_meeting',
              });
            } catch (e) {
              console.error('[reminder job] emit', uid, e.message);
            }
          }
        }
      }
    } catch (e) {
      console.error('[meeting-reminders job]', e);
    }
  });
}
