import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { CalendarEventDto } from '../models/hr-me-realtime.models';

@Injectable({ providedIn: 'root' })
export class CalendarApiService {
  private readonly base = `${environment.apiUrl}/calendar`;

  constructor(private readonly http: HttpClient) {}

  events(from: Date, to: Date, agentIds?: string[]): Observable<{ items: CalendarEventDto[] }> {
    let params = new HttpParams().set('from', from.toISOString()).set('to', to.toISOString());
    if (agentIds?.length) {
      params = params.set('agent_ids', agentIds.join(','));
    }
    return this.http.get<{ items: CalendarEventDto[] }>(`${this.base}/events`, { params });
  }

  conflicts(agentId: string, startsAt: Date, endsAt: Date): Observable<{ conflicts: { id: string; title: string }[] }> {
    const params = new HttpParams()
      .set('agent_id', agentId)
      .set('starts_at', startsAt.toISOString())
      .set('ends_at', endsAt.toISOString());
    return this.http.get<{ conflicts: { id: string; title: string }[] }>(`${this.base}/conflicts`, { params });
  }

  downloadIcsUrl(eventId: string): string {
    return `${this.base}/events/${eventId}/ics`;
  }
}
