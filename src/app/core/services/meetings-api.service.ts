import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { MeetingDto, MeetingParticipantDto } from '../models/hr-me-realtime.models';

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

  list(from: Date, to: Date): Observable<{ items: MeetingDto[] }> {
    const params = new HttpParams().set('from', from.toISOString()).set('to', to.toISOString());
    return this.http.get<{ items: MeetingDto[] }>(this.base, { params });
  }

  patchStatus(id: string, status: string): Observable<{ meeting: MeetingDto }> {
    return this.http.patch<{ meeting: MeetingDto }>(`${this.base}/${id}/status`, { status });
  }

  getJoinToken(id: string): Observable<{ token: string; roomId: string; meetingRole: string; expiresAt: string }> {
    return this.http.get<{ token: string; roomId: string; meetingRole: string; expiresAt: string }>(
      `${this.base}/${id}/join-token`
    );
  }

  addParticipant(
    meetingId: string,
    body: { email: string; name?: string; role?: string; userId?: string }
  ): Observable<{ meeting: MeetingDto }> {
    return this.http.post<{ meeting: MeetingDto }>(`${this.base}/${meetingId}/participants`, body);
  }
}
