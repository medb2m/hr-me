import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  emailVerified: boolean;
  pendingEmail: string | null;
  timeZone: string | null;
  avatarUrl: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface UsersPage {
  users: AdminUser[];
  total: number;
  page: number;
  pages: number;
  limit: number;
}

export interface UserStats {
  total: number;
  verified: number;
  unverified: number;
  recent30d: number;
  byRole: Record<string, number>;
}

export interface UserPayload {
  name?: string;
  email?: string;
  role?: string;
  password?: string;
  emailVerified?: boolean;
}

@Injectable({ providedIn: 'root' })
export class AdminUsersApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/admin/users`;

  list(opts: { page?: number; limit?: number; role?: string; q?: string } = {}): Observable<UsersPage> {
    let params = new HttpParams();
    if (opts.page) params = params.set('page', opts.page);
    if (opts.limit) params = params.set('limit', opts.limit);
    if (opts.role) params = params.set('role', opts.role);
    if (opts.q?.trim()) params = params.set('q', opts.q.trim());
    return this.http.get<UsersPage>(this.base, { params });
  }

  stats(): Observable<UserStats> {
    return this.http.get<UserStats>(`${this.base}/stats`);
  }

  create(body: UserPayload): Observable<{ user: AdminUser }> {
    return this.http.post<{ user: AdminUser }>(this.base, body);
  }

  update(id: string, body: UserPayload): Observable<{ user: AdminUser }> {
    return this.http.put<{ user: AdminUser }>(`${this.base}/${id}`, body);
  }

  remove(id: string): Observable<{ message: string; id: string }> {
    return this.http.delete<{ message: string; id: string }>(`${this.base}/${id}`);
  }
}
