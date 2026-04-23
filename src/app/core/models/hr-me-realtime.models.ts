/** Aligné sur le backend Mongoose / API REST. */

export type MeetingStatus = 'SCHEDULED' | 'WAITING' | 'IN_PROGRESS' | 'ENDED' | 'ARCHIVED';
export type MeetingType = 'screening' | 'technical' | 'final' | 'ai_automated';

export interface MeetingParticipantDto {
  userId?: string;
  email: string;
  name: string;
  role: 'host' | 'recruiter' | 'candidate' | 'observer';
  joinAt?: string | null;
  leaveAt?: string | null;
  noShow?: boolean;
}

export interface MeetingDto {
  id: string;
  title: string;
  type: MeetingType;
  status: MeetingStatus;
  scheduledAt: string;
  durationMin: number;
  timezone: string;
  language: string;
  description: string;
  offerId?: string | null;
  candidateId?: string | null;
  createdByAgentId: string;
  roomId: string;
  pinCode: string;
  participants: MeetingParticipantDto[];
  createdAt?: string;
  updatedAt?: string;
}

export type CalendarEventType =
  | 'MEETING'
  | 'DEADLINE'
  | 'OFFER_EXPIRY'
  | 'DOCUMENT_DUE'
  | 'TICKET_DUE'
  | 'FOLLOWUP'
  | 'VISA_APPT'
  | 'EMBASSY_APPT'
  | 'TALENT_ID'
  | 'AI_INTERVIEW';

export interface CalendarEventDto {
  id: string;
  title: string;
  type: CalendarEventType;
  sourceModule: string;
  sourceId?: string | null;
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
  timezoneRef: string;
  color: string;
  status: string;
  priority: string;
  agentId: string;
  candidateId?: string | null;
  offerId?: string | null;
  location: string;
  videoLink: string;
  description: string;
  recurrence?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface AppNotificationDto {
  id: string;
  type: string;
  category: string;
  priority: string;
  title: string;
  body: string;
  actionUrl?: string | null;
  actionLabel?: string | null;
  icon?: string;
  color?: string;
  read: boolean;
  createdAt?: string;
}
