import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { ClientProfileSections } from './client-profile-state.service';

/** Réponse API alignée sur `ClientProfile` Mongoose (champs utiles au front). */
export interface ClientProfileDto {
  user: string;
  prenom?: string;
  nom?: string;
  birthDate?: string | null;
  profilePhotoUrl?: string;
  sectionFlags?: Partial<ClientProfileSections>;
  headline?: string;
  phone?: string;
  phones?: string[];
  links?: Array<{ _id?: string; label?: string; url?: string }>;
  city?: string;
  country?: string;
  nationality?: string;
  workExperiences?: Array<{
    jobTitle?: string;
    employer?: string;
    startDate?: string | null;
    endDate?: string | null;
    description?: string;
  }>;
  educations?: Array<{
    title?: string;
    organization?: string;
    startDate?: string | null;
    endDate?: string | null;
  }>;
  skills?: string[];
  languagesSpoken?: Array<{ language?: string; cefrLevel?: string }>;
  digitalSkills?: string[];
  profilePhotoHistory?: Array<{ _id: string; url: string; uploadedAt?: string }>;
}

@Injectable({ providedIn: 'root' })
export class ClientProfileApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/client`;

  getProfile(): Observable<{ profile: ClientProfileDto }> {
    return this.http.get<{ profile: ClientProfileDto }>(`${this.base}/profile`);
  }

  /** Met à jour le profil : `birthDate` (`YYYY-MM-DD` ou `null`), `phones`, `links`, `headline`, parcours, compétences. */
  patchProfile(body: {
    birthDate?: string | null;
    phones?: string[];
    links?: Array<{ label: string; url: string }>;
    headline?: string;
    workExperiences?: Array<{
      jobTitle: string;
      employer: string;
      startDate?: string | null;
      endDate?: string | null;
      description?: string;
    }>;
    educations?: Array<{
      title: string;
      organization: string;
      startDate?: string | null;
      endDate?: string | null;
    }>;
    skills?: string[];
    digitalSkills?: string[];
    languagesSpoken?: Array<{ language: string; cefrLevel: string }>;
  }): Observable<{ profile: ClientProfileDto }> {
    return this.http.put<{ profile: ClientProfileDto }>(`${this.base}/profile`, body);
  }

  uploadProfilePhoto(file: File): Observable<{ profilePhotoUrl: string; profile: ClientProfileDto }> {
    const body = new FormData();
    body.append('photo', file);
    return this.http.post<{ profilePhotoUrl: string; profile: ClientProfileDto }>(
      `${this.base}/profile/photo`,
      body,
    );
  }

  deleteProfilePhoto(): Observable<{ profile: ClientProfileDto }> {
    return this.http.delete<{ profile: ClientProfileDto }>(`${this.base}/profile/photo`);
  }

  deleteProfilePhotoHistoryEntry(historyId: string): Observable<{ profile: ClientProfileDto }> {
    return this.http.delete<{ profile: ClientProfileDto }>(
      `${this.base}/profile/photo/history/${encodeURIComponent(historyId)}`,
    );
  }

  /** Promouvoir une entrée d’historique en photo de profil active (sans nouvel upload). */
  activateProfilePhotoFromHistory(historyId: string): Observable<{ profile: ClientProfileDto }> {
    return this.http.patch<{ profile: ClientProfileDto }>(`${this.base}/profile/photo/active`, { historyId });
  }

  /**
   * URL affichable pour une ressource sous `/uploads` ou `assets/`, même origine que l’app.
   */
  resolveMediaUrl(path: string | null | undefined): string | null {
    const p = path?.trim();
    if (!p) {
      return null;
    }
    if (p.startsWith('http://') || p.startsWith('https://')) {
      return p;
    }
    if (p.startsWith('assets/')) {
      return p;
    }
    if (p.startsWith('/') && typeof window !== 'undefined') {
      return `${window.location.origin}${p}`;
    }
    return p;
  }
}
