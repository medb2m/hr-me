import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export type OfferWorkMode = 'onsite' | 'hybrid' | 'remote';
export type OfferStatus = 'draft' | 'published' | 'closed';
/** '' = toutes ; 'expired' = deadline dépassée (calculé). */
export type OfferStatusFilter = '' | OfferStatus | 'expired';

export interface OfferApplicationStats {
  total: number;
  candidate: number;
  client: number;
  agent: number;
}

export interface AdminOffer {
  id: string;
  name: string;
  partner: string;
  companyLogo: string;
  description: string;
  price: number;
  country: { code: string; name: string };
  city: string;
  workMode: OfferWorkMode;
  openings: number;
  skills: string[];
  publishDate: string | null;
  deadline: string | null;
  status: OfferStatus;
  isExpired: boolean;
  daysLeft: number | null;
  postedBy: { role: string; label: string };
  lastModifiedAt: string | null;
  createdAt: string;
  applications: OfferApplicationStats;
}

export interface OfferCounters {
  total: number;
  published: number;
  draft: number;
  closed: number;
  expired: number;
  applications: number;
}

export interface OfferListResult {
  offers: AdminOffer[];
  total: number;
  page: number;
  pages: number;
  limit: number;
  counters: OfferCounters;
}

export interface OfferPayload {
  name: string;
  partner: string;
  companyLogo?: string;
  description?: string;
  price?: number;
  country?: { code: string; name: string };
  city?: string;
  workMode?: OfferWorkMode;
  openings?: number;
  skills?: string[];
  publishDate?: string | null;
  deadline?: string | null;
  status?: OfferStatus;
}

@Injectable({ providedIn: 'root' })
export class AdminOffersApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/admin/offers`;

  list(opts: {
    page?: number;
    limit?: number;
    status?: OfferStatusFilter;
    mode?: '' | OfferWorkMode;
    country?: string;
    sort?: 'recent' | 'deadline' | 'name';
    q?: string;
  }): Observable<OfferListResult> {
    let params = new HttpParams();
    if (opts.page) params = params.set('page', opts.page);
    if (opts.limit) params = params.set('limit', opts.limit);
    if (opts.status) params = params.set('status', opts.status);
    if (opts.mode) params = params.set('mode', opts.mode);
    if (opts.country) params = params.set('country', opts.country);
    if (opts.sort) params = params.set('sort', opts.sort);
    if (opts.q?.trim()) params = params.set('q', opts.q.trim());
    return this.http.get<OfferListResult>(this.base, { params });
  }

  get(id: string): Observable<{ offer: AdminOffer }> {
    return this.http.get<{ offer: AdminOffer }>(`${this.base}/${id}`);
  }

  create(payload: OfferPayload): Observable<{ offer: AdminOffer }> {
    return this.http.post<{ offer: AdminOffer }>(this.base, payload);
  }

  update(id: string, payload: OfferPayload): Observable<{ offer: AdminOffer }> {
    return this.http.put<{ offer: AdminOffer }>(`${this.base}/${id}`, payload);
  }

  delete(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.base}/${id}`);
  }

  /** Upload logo entreprise (multipart) → URL servie sous /uploads. */
  uploadLogo(file: File): Observable<{ url: string }> {
    const fd = new FormData();
    fd.append('logo', file);
    return this.http.post<{ url: string }>(`${this.base}/logo`, fd);
  }

  generateDescription(body: {
    title?: string;
    partner?: string;
    country?: string;
    city?: string;
    workMode?: OfferWorkMode;
    skills?: string[];
    prompt?: string;
  }): Observable<{ description: string }> {
    return this.http.post<{ description: string }>(
      `${this.base}/generate-description`,
      body,
    );
  }

  suggestSkills(body: {
    title?: string;
    description?: string;
  }): Observable<{ skills: string[] }> {
    return this.http.post<{ skills: string[] }>(`${this.base}/suggest-skills`, body);
  }
}
