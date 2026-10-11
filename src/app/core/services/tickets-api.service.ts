import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type TicketStatus = 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketKind = 'support' | 'internal';

export interface TicketAttachment {
  name: string;
  path: string;
  mime: string;
  size: number;
}

export interface TicketComment {
  id: string;
  authorName: string;
  authorRole: string;
  body: string;
  createdAt: string;
}

export interface TicketDto {
  id: string;
  subject: string;
  description: string;
  kind: TicketKind;
  status: TicketStatus;
  priority: TicketPriority;
  category: string;
  createdBy: string | null;
  createdByName: string;
  createdByRole: string;
  createdByEmail: string;
  assignedTo: string | null;
  assignedToName: string;
  attachments: TicketAttachment[];
  comments?: TicketComment[];
  commentsCount?: number;
  history?: { status: string; changedByName: string; changedAt: string }[];
  resolvedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TicketStats {
  total: number;
  byStatus: Record<TicketStatus, number>;
  byKind: { support: number; internal: number };
  openByPriority: Record<TicketPriority, number>;
  resolvedLast7d: number;
  urgentOpen: number;
  avgResolutionHours: number;
  perAssignee: { id: string; name: string; open: number; resolved: number }[];
}

export interface TicketFilters {
  kind?: '' | TicketKind;
  status?: '' | TicketStatus;
  priority?: '' | TicketPriority;
  assignee?: '' | 'me' | 'none' | string;
  category?: string;
  q?: string;
}

@Injectable({ providedIn: 'root' })
export class TicketsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/tickets`;

  /** Création multipart (sujet + description + pièces jointes éventuelles). */
  create(data: {
    subject: string;
    description?: string;
    category?: string;
    priority?: TicketPriority;
    kind?: TicketKind;
    assignedTo?: string;
    files?: File[];
  }): Observable<{ ticket: TicketDto }> {
    const fd = new FormData();
    fd.append('subject', data.subject);
    if (data.description) fd.append('description', data.description);
    if (data.category) fd.append('category', data.category);
    if (data.priority) fd.append('priority', data.priority);
    if (data.kind) fd.append('kind', data.kind);
    if (data.assignedTo) fd.append('assignedTo', data.assignedTo);
    for (const f of data.files ?? []) fd.append('files', f);
    return this.http.post<{ ticket: TicketDto }>(this.base, fd);
  }

  list(filters: TicketFilters = {}): Observable<{ tickets: TicketDto[] }> {
    let params = new HttpParams();
    for (const [k, v] of Object.entries(filters)) {
      if (v) params = params.set(k, String(v));
    }
    return this.http.get<{ tickets: TicketDto[] }>(this.base, { params });
  }

  board(filters: TicketFilters = {}): Observable<{ columns: Record<TicketStatus, TicketDto[]> }> {
    let params = new HttpParams();
    for (const [k, v] of Object.entries(filters)) {
      if (v) params = params.set(k, String(v));
    }
    return this.http.get<{ columns: Record<TicketStatus, TicketDto[]> }>(`${this.base}/board`, {
      params,
    });
  }

  stats(): Observable<TicketStats> {
    return this.http.get<TicketStats>(`${this.base}/stats`);
  }

  assignees(): Observable<{ assignees: { id: string; name: string; email: string; role: string }[] }> {
    return this.http.get<{ assignees: { id: string; name: string; email: string; role: string }[] }>(
      `${this.base}/assignees`,
    );
  }

  get(id: string): Observable<{ ticket: TicketDto }> {
    return this.http.get<{ ticket: TicketDto }>(`${this.base}/${id}`);
  }

  patch(
    id: string,
    body: Partial<{
      status: TicketStatus;
      priority: TicketPriority;
      category: string;
      assignedTo: string | null;
    }>,
  ): Observable<{ ticket: TicketDto }> {
    return this.http.patch<{ ticket: TicketDto }>(`${this.base}/${id}`, body);
  }

  comment(id: string, body: string): Observable<{ ticket: TicketDto }> {
    return this.http.post<{ ticket: TicketDto }>(`${this.base}/${id}/comments`, { body });
  }
}
