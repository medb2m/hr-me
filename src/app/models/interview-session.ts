export interface InterviewMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  createdAt?: string;
}

export interface InterviewSession {
  _id: string;
  title: string;
  candidateName: string;
  status: 'in_progress' | 'completed';
  messages: InterviewMessage[];
  completedAt?: string;
  recruiterSummary?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface InterviewSessionListItem
  extends Omit<InterviewSession, 'messages'> {
  messages?: InterviewMessage[];
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
