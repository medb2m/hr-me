import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { MeetingDto, MeetingParticipantDto } from '../models/hr-me-realtime.models';

export interface MeetingChatMsg {
  id: string;
  senderId?: string;
  senderName?: string;
  senderAvatar?: string;
  content: string;
  imageUrl?: string;
  sentAt: string;
}

export interface CreateMeetingBody {
  title: string;
  type?: string;
  scheduledAt: string;
  durationMin?: number;
  timezone?: string;
  language?: string;
  description?: string;
  offerId?: string;
  candidateId?: string;
  participants?: MeetingParticipantDto[];
}

@Injectable({ providedIn: 'root' })
export class MeetingsApiService {
  private readonly base = `${environment.apiUrl}/meetings`;

  constructor(private readonly http: HttpClient) {}

  create(body: CreateMeetingBody): Observable<{ meeting: MeetingDto; calendarEventId: string }> {
    return this.http.post<{ meeting: MeetingDto; calendarEventId: string }>(this.base, body);
  }

  get(id: string): Observable<{ meeting: MeetingDto }> {
    return this.http.get<{ meeting: MeetingDto }>(`${this.base}/${id}`);
  }

  list(
    from: Date,
    to: Date,
    opts: { scope?: 'mine' | 'all'; status?: string } = {}
  ): Observable<{ items: MeetingDto[] }> {
    let params = new HttpParams().set('from', from.toISOString()).set('to', to.toISOString());
    if (opts.scope === 'all') params = params.set('scope', 'all');
    if (opts.status) params = params.set('status', opts.status);
    return this.http.get<{ items: MeetingDto[] }>(this.base, { params });
  }

  update(id: string, body: Partial<CreateMeetingBody>): Observable<{ meeting: MeetingDto }> {
    return this.http.patch<{ meeting: MeetingDto }>(`${this.base}/${id}`, body);
  }

  patchStatus(id: string, status: string): Observable<{ meeting: MeetingDto }> {
    return this.http.patch<{ meeting: MeetingDto }>(`${this.base}/${id}/status`, { status });
  }

  recentParticipants(): Observable<{ items: { id: string | null; name: string; email: string; role: string; avatarUrl?: string; lastUsed: string }[] }> {
    return this.http.get<{ items: { id: string | null; name: string; email: string; role: string; avatarUrl?: string; lastUsed: string }[] }>(
      `${this.base}/recent-participants`
    );
  }

  removeParticipant(meetingId: string, email: string): Observable<{ meeting: MeetingDto }> {
    return this.http.delete<{ meeting: MeetingDto }>(`${this.base}/${meetingId}/participants`, {
      body: { email },
    });
  }

  getJoinToken(id: string): Observable<{ token: string; roomId: string; meetingRole: string; expiresAt: string }> {
    return this.http.get<{ token: string; roomId: string; meetingRole: string; expiresAt: string }>(
      `${this.base}/${id}/join-token`
    );
  }

  /** Transcription persistante de la discussion (staff + animateur). */
  getChat(id: string): Observable<{ messages: MeetingChatMsg[] }> {
    return this.http.get<{ messages: MeetingChatMsg[] }>(`${this.base}/${id}/chat`);
  }

  addParticipant(
    meetingId: string,
    body: { email: string; name?: string; role?: string; userId?: string }
  ): Observable<{ meeting: MeetingDto }> {
    return this.http.post<{ meeting: MeetingDto }>(`${this.base}/${meetingId}/participants`, body);
  }
}
