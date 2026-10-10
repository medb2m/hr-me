import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ContactSubmitBody {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  subject?: string;
  message: string;
  /** Honeypot anti-bot — doit rester vide pour un humain. */
  website?: string;
}

export interface AdminContact {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  subject: string;
  message: string;
  status: 'new' | 'archived';
  createdAt: string;
}

export interface ContactListResult {
  contacts: AdminContact[];
  total: number;
  newCount: number;
  page: number;
  pages: number;
  limit: number;
}

@Injectable({ providedIn: 'root' })
export class ContactApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}`;

  /** POST /api/contact — formulaire public. */
  submitContact(body: ContactSubmitBody): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.base}/contact`, body);
  }

  /** GET /api/admin/contacts */
  listContacts(opts: {
    page?: number;
    limit?: number;
    status?: '' | 'new' | 'archived';
    q?: string;
  }): Observable<ContactListResult> {
    let params = new HttpParams();
    if (opts.page) params = params.set('page', opts.page);
    if (opts.limit) params = params.set('limit', opts.limit);
    if (opts.status) params = params.set('status', opts.status);
    if (opts.q?.trim()) params = params.set('q', opts.q.trim());
    return this.http.get<ContactListResult>(`${this.base}/admin/contacts`, { params });
  }

  setContactStatus(id: string, status: 'new' | 'archived'): Observable<{ contact: AdminContact }> {
    return this.http.put<{ contact: AdminContact }>(`${this.base}/admin/contacts/${id}`, { status });
  }

  deleteContact(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.base}/admin/contacts/${id}`);
  }
}
