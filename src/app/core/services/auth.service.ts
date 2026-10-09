import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  role: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly userSignal = signal<AuthUser | null>(null);

  /** Profil session courant (null si déconnecté). */
  readonly user = this.userSignal.asReadonly();

  constructor(private readonly http: HttpClient) {}

  refreshFromStorage(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    const raw = localStorage.getItem('authUser');
    if (!raw) {
      this.userSignal.set(null);
      return;
    }
    try {
      this.userSignal.set(JSON.parse(raw) as AuthUser);
    } catch {
      this.userSignal.set(null);
    }
  }

  isLoggedIn(): boolean {
    if (typeof localStorage === 'undefined') {
      return false;
    }
    return Boolean(localStorage.getItem('authToken')) && this.userSignal() !== null;
  }

  /**
   * Cible après connexion réussie, ou si un utilisateur déjà connecté ouvre `/login` / `/register`.
   * Les comptes `client` sont envoyés vers l’espace candidat.
   */
  postLoginRedirectPath(): string {
    const role = this.user()?.role;
    if (role === 'admin') {
      return '/admin/dashboard';
    }
    if (role === 'client') {
      return '/client/overview';
    }
    return '/home';
  }

  clearSession(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('authToken');
      localStorage.removeItem('authUser');
    }
    this.userSignal.set(null);
  }

  /** Merge changes into the stored + in-memory user (e.g. after profile edit). */
  updateStoredUser(partial: Partial<AuthUser>): void {
    const current = this.userSignal();
    if (!current) {
      return;
    }
    const next = { ...current, ...partial };
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('authUser', JSON.stringify(next));
    }
    this.userSignal.set(next);
  }

  setSession(token: string, user: AuthUser, emailFallback?: string): void {
    const normalized: AuthUser = {
      ...user,
      email: (user.email || emailFallback || '').trim().toLowerCase(),
    };
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('authToken', token);
      localStorage.setItem('authUser', JSON.stringify(normalized));
    }
    this.userSignal.set(normalized);
  }

  login(body: { email: string; password: string }): Observable<{
    token: string;
    user: AuthUser;
    accessToken?: string;
  }> {
    return this.http.post<{ token: string; user: AuthUser }>(
      `${environment.apiUrl}/auth/login`,
      body,
    );
  }

  getAdminStatus(): Observable<{ needsBootstrap: boolean }> {
    return this.http.get<{ needsBootstrap: boolean }>(
      `${environment.apiUrl}/auth/admin/status`,
    );
  }

  bootstrapAdmin(
    body: { name?: string; email: string; password: string },
    bootstrapSecret?: string,
  ): Observable<{ token: string; user: AuthUser }> {
    let headers = new HttpHeaders();
    const s = bootstrapSecret?.trim();
    if (s) {
      headers = headers.set('X-Admin-Bootstrap-Secret', s);
    }
    return this.http.post<{ token: string; user: AuthUser }>(
      `${environment.apiUrl}/auth/admin/bootstrap`,
      body,
      { headers },
    );
  }

  adminLogin(body: { email: string; password: string }): Observable<{ token: string; user: AuthUser }> {
    return this.http.post<{ token: string; user: AuthUser }>(
      `${environment.apiUrl}/auth/admin/login`,
      body,
    );
  }

  register(body: { name?: string; email: string; password: string }): Observable<{
    message: string;
    userId?: string;
  }> {
    return this.http.post<{ message: string; userId?: string }>(
      `${environment.apiUrl}/auth/register`,
      body,
    );
  }

  forgotPassword(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${environment.apiUrl}/auth/forgot-password`, {
      email,
    });
  }

  resetPassword(body: { token: string; password: string }): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${environment.apiUrl}/auth/reset-password`, body);
  }

  verifyEmail(body: { token?: string; email?: string; code?: string }): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${environment.apiUrl}/auth/verify-email`, body);
  }

  resendVerification(body: { email: string; password: string }): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `${environment.apiUrl}/auth/resend-verification`,
      body,
    );
  }
}
