import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ApiOk,
  CreateInterviewSessionResponse,
  InterviewSession,
  InterviewSessionListItem,
  InterviewSessionsListResponse,
  InterviewTemplate,
  SendMessageResponse,
} from '../models/interview-session';

@Injectable({ providedIn: 'root' })
export class InterviewService {
  private readonly base = `${environment.apiUrl}/interview`;

  constructor(private readonly http: HttpClient) {}

  createSession(body: {
    title: string;
    candidateName?: string;
    isDemo?: boolean;
    assigneeName?: string;
    assigneeEmail?: string;
    topics?: string[];
    instructions?: string;
    scheduledAt?: string | null;
    deadlineHours?: number | null;
    templateId?: string | null;
  }): Observable<CreateInterviewSessionResponse> {
    return this.http.post<CreateInterviewSessionResponse>(
      `${this.base}/sessions`,
      body
    );
  }

  getSession(id: string): Observable<{ success: boolean; data: InterviewSession }> {
    return this.http.get<{ success: boolean; data: InterviewSession }>(
      `${this.base}/sessions/${id}`
    );
  }

  listSessions(params?: {
    status?: string;
    page?: number;
    limit?: number;
    templateId?: string;
    sort?: string;
  }): Observable<InterviewSessionsListResponse> {
    let httpParams = new HttpParams();
    if (params?.status) {
      httpParams = httpParams.set('status', params.status);
    }
    if (params?.page != null) {
      httpParams = httpParams.set('page', String(params.page));
    }
    if (params?.limit != null) {
      httpParams = httpParams.set('limit', String(params.limit));
    }
    if (params?.templateId) {
      httpParams = httpParams.set('templateId', params.templateId);
    }
    if (params?.sort) {
      httpParams = httpParams.set('sort', params.sort);
    }
    return this.http.get<InterviewSessionsListResponse>(`${this.base}/sessions`, {
      params: httpParams,
    });
  }

  /** Évaluation IA : avis rédigé + note par sujet. */
  evaluateSession(sessionId: string): Observable<ApiOk<NonNullable<InterviewSession['evaluation']>>> {
    return this.http.post<ApiOk<NonNullable<InterviewSession['evaluation']>>>(
      `${this.base}/sessions/${sessionId}/evaluate`,
      {}
    );
  }

  /** Note manuelle recruteur (0-10 + commentaire). */
  reviewSession(
    sessionId: string,
    review: { score: number | null; comment: string }
  ): Observable<ApiOk<InterviewSessionListItem>> {
    return this.http.patch<ApiOk<InterviewSessionListItem>>(
      `${this.base}/sessions/${sessionId}/review`,
      review
    );
  }

  /** « Mes entretiens à passer » — espace de la personne affectée. */
  mySessions(): Observable<ApiOk<InterviewSessionListItem[]>> {
    return this.http.get<ApiOk<InterviewSessionListItem[]>>(`${this.base}/mine`);
  }

  // ── Templates ──

  listTemplates(): Observable<ApiOk<InterviewTemplate[]>> {
    return this.http.get<ApiOk<InterviewTemplate[]>>(`${this.base}/templates`);
  }

  createTemplate(body: {
    name: string;
    title: string;
    topics?: string[];
    instructions?: string;
    deadlineHours?: number;
  }): Observable<ApiOk<InterviewTemplate>> {
    return this.http.post<ApiOk<InterviewTemplate>>(`${this.base}/templates`, body);
  }

  updateTemplate(
    id: string,
    body: Partial<{
      name: string;
      title: string;
      topics: string[];
      instructions: string;
      deadlineHours: number;
    }>
  ): Observable<ApiOk<InterviewTemplate>> {
    return this.http.patch<ApiOk<InterviewTemplate>>(`${this.base}/templates/${id}`, body);
  }

  deleteTemplate(id: string): Observable<ApiOk<unknown>> {
    return this.http.delete<ApiOk<unknown>>(`${this.base}/templates/${id}`);
  }

  // ── Accès public par jeton (personne affectée, sans compte) ──

  accessSession(token: string): Observable<ApiOk<InterviewSession>> {
    return this.http.get<ApiOk<InterviewSession>>(`${this.base}/access/${token}`);
  }

  accessStart(token: string): Observable<ApiOk<InterviewSession>> {
    return this.http.post<ApiOk<InterviewSession>>(`${this.base}/access/${token}/start`, {});
  }

  accessMessage(token: string, text: string): Observable<ApiOk<{ assistantMessage: string }>> {
    return this.http.post<ApiOk<{ assistantMessage: string }>>(
      `${this.base}/access/${token}/messages`,
      { text }
    );
  }

  accessComplete(token: string): Observable<ApiOk<InterviewSession>> {
    return this.http.post<ApiOk<InterviewSession>>(`${this.base}/access/${token}/complete`, {});
  }

  sendCandidateMessage(
    sessionId: string,
    text: string
  ): Observable<SendMessageResponse> {
    return this.http.post<SendMessageResponse>(
      `${this.base}/sessions/${sessionId}/messages`,
      { text }
    );
  }

  /**
   * SSE stream: optional delta chunks, final `done` with full assistant text.
   * Persisted session is re-fetched by the caller after `onDone`.
   */
  async sendCandidateMessageStream(
    sessionId: string,
    text: string,
    handlers: {
      onDelta: (chunk: string) => void;
      onDone: (assistantMessage: string) => void;
      onError: (message: string) => void;
    }
  ): Promise<void> {
    const url = `${this.base}/sessions/${encodeURIComponent(sessionId)}/messages`;
    const token =
      typeof localStorage !== 'undefined' ? localStorage.getItem('authToken') : null;
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ text, stream: true }),
      });
    } catch {
      handlers.onError('Network error');
      return;
    }

    if (!res.ok) {
      try {
        const j = (await res.json()) as { message?: string };
        handlers.onError(j.message || `HTTP ${res.status}`);
      } catch {
        handlers.onError(`HTTP ${res.status}`);
      }
      return;
    }

    const reader = res.body?.getReader();
    if (!reader) {
      handlers.onError('No response body');
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let sawDone = false;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        while (true) {
          const sep = buffer.indexOf('\n\n');
          if (sep === -1) {
            break;
          }
          const rawEvent = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          for (const line of rawEvent.split('\n')) {
            const t = line.trim();
            if (!t.startsWith('data:')) {
              continue;
            }
            const payload = t.slice(5).trim();
            let data: { delta?: string; done?: boolean; assistantMessage?: string; error?: string };
            try {
              data = JSON.parse(payload) as typeof data;
            } catch {
              continue;
            }
            if (typeof data.error === 'string' && data.error.length) {
              handlers.onError(data.error);
              return;
            }
            if (typeof data.delta === 'string' && data.delta.length) {
              handlers.onDelta(data.delta);
            }
            if (data.done === true) {
              sawDone = true;
              handlers.onDone(
                typeof data.assistantMessage === 'string'
                  ? data.assistantMessage
                  : ''
              );
              return;
            }
          }
        }
      }
    } catch {
      handlers.onError('Stream interrupted');
      return;
    }

    if (!sawDone) {
      handlers.onError('Stream ended unexpectedly');
    }
  }

  completeSession(
    sessionId: string
  ): Observable<{ success: boolean; data: InterviewSession }> {
    return this.http.patch<{ success: boolean; data: InterviewSession }>(
      `${this.base}/sessions/${sessionId}/complete`,
      {}
    );
  }
}
