import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { AppNotificationDto } from '../models/hr-me-realtime.models';

export interface NotificationListResponse {
  items: AppNotificationDto[];
  page: number;
  limit: number;
  total: number;
}

export interface UnreadCountResponse {
  count: number;
  by_category: Record<string, number>;
}

@Injectable({ providedIn: 'root' })
export class NotificationsApiService {
  private readonly base = `${environment.apiUrl}/notifications`;

  constructor(private readonly http: HttpClient) {}

  list(
    page = 1,
    limit = 20,
    filters: { category?: string; read?: boolean } = {},
  ): Observable<NotificationListResponse> {
    let params = new HttpParams().set('page', String(page)).set('limit', String(limit));
    if (filters.category) params = params.set('category', filters.category);
    if (filters.read !== undefined) params = params.set('read', String(filters.read));
    return this.http.get<NotificationListResponse>(this.base, { params });
  }

  unreadCount(): Observable<UnreadCountResponse> {
    return this.http.get<UnreadCountResponse>(`${this.base}/unread-count`);
  }

  markRead(id: string): Observable<{ notification: AppNotificationDto }> {
    return this.http.patch<{ notification: AppNotificationDto }>(`${this.base}/${id}/read`, {});
  }

  markAllRead(): Observable<{ ok: boolean }> {
    return this.http.patch<{ ok: boolean }>(`${this.base}/read-all`, {});
  }

  dismiss(id: string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.base}/${id}`);
  }

  devTest(): Observable<{ notification: AppNotificationDto }> {
    return this.http.post<{ notification: AppNotificationDto }>(`${this.base}/dev/test`, {});
  }
}
