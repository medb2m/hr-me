import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface AccountUser {
  id: string;
  email: string;
  name: string;
  role: string;
  emailVerified: boolean;
  pendingEmail: string | null;
  timeZone: string | null;
  avatarUrl: string;
  createdAt?: string;
}

@Injectable({ providedIn: 'root' })
export class AccountApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/users`;

  getMe(): Observable<{ user: AccountUser }> {
    return this.http.get<{ user: AccountUser }>(`${this.base}/me`);
  }

  updateMe(body: { name?: string; timeZone?: string | null }): Observable<{ user: AccountUser }> {
    return this.http.put<{ user: AccountUser }>(`${this.base}/me`, body);
  }

  requestEmailChange(newEmail: string): Observable<{ user: AccountUser; message: string }> {
    return this.http.post<{ user: AccountUser; message: string }>(
      `${this.base}/me/email-change`,
      { newEmail },
    );
  }

  cancelEmailChange(): Observable<{ user: AccountUser }> {
    return this.http.post<{ user: AccountUser }>(`${this.base}/me/email-change/cancel`, {});
  }

  changePassword(body: { currentPassword: string; newPassword: string }): Observable<{
    message: string;
    notificationSent: boolean;
  }> {
    return this.http.put<{ message: string; notificationSent: boolean }>(
      `${this.base}/me/password`,
      body,
    );
  }

  /** Photo de compte — upload d'un nouveau fichier (multipart `photo`). */
  uploadAvatar(file: File): Observable<{ user: AccountUser }> {
    const body = new FormData();
    body.append('photo', file);
    return this.http.post<{ user: AccountUser }>(`${this.base}/me/avatar`, body);
  }

  /** Photo de compte — réutilise une image déjà servie (`/uploads/…`, ex. historique CV). */
  setAvatar(url: string): Observable<{ user: AccountUser }> {
    return this.http.put<{ user: AccountUser }>(`${this.base}/me/avatar`, { url });
  }

  removeAvatar(): Observable<{ user: AccountUser }> {
    return this.http.delete<{ user: AccountUser }>(`${this.base}/me/avatar`);
  }

  confirmEmailChange(token: string): Observable<{ user: AccountUser; message: string }> {
    return this.http.post<{ user: AccountUser; message: string }>(
      `${this.base}/confirm-email-change`,
      { token },
    );
  }
}
