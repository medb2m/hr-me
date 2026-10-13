export interface InterviewMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  createdAt?: string;
}

export type InterviewStatus = 'pending' | 'in_progress' | 'completed' | 'expired';

export interface InterviewTopicScore {
  topic: string;
  score: number | null;
  comment: string;
}

export interface InterviewEvaluation {
  summary: string;
  overall: number | null;
  topics: InterviewTopicScore[];
  generatedAt?: string | null;
}

export interface InterviewSession {
  _id: string;
  title: string;
  candidateName: string;
  assignee?: { name: string; email: string; userId?: string | null };
  topics: string[];
  instructions?: string;
  scheduledAt?: string | null;
  deadlineHours?: number | null;
  expiresAt?: string | null;
  templateId?: { _id: string; name: string; title: string } | string | null;
  isDemo?: boolean;
  inviteToken?: string;
  status: InterviewStatus;
  messages: InterviewMessage[];
  completedAt?: string;
  recruiterSummary?: string;
  evaluation?: InterviewEvaluation;
  review?: { score: number | null; comment: string; updatedAt?: string | null };
  createdAt?: string;
  updatedAt?: string;
}

export interface InterviewSessionListItem
  extends Omit<InterviewSession, 'messages'> {
  messages?: InterviewMessage[];
}

export interface InterviewTemplate {
  _id: string;
  name: string;
  title: string;
  topics: string[];
  instructions: string;
  deadlineHours: number;
  usageCount?: number;
  createdAt?: string;
}

export interface CreateInterviewSessionResponse {
  success: boolean;
  data: InterviewSession;
  message?: string;
}

export interface InterviewSessionsListResponse {
  success: boolean;
  data: InterviewSessionListItem[];
  pagination?: { total: number; page: number; limit: number };
}

export interface SendMessageResponse {
  success: boolean;
  data?: {
    assistantMessage: string;
    session: InterviewSession;
  };
  message?: string;
}

export interface ApiOk<T> {
  success: boolean;
  data: T;
  message?: string;
}
