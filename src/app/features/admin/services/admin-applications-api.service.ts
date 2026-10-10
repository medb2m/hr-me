import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export type AdminAppStatus = 'pending' | 'review' | 'accepted' | 'rejected';
export type AppSource = 'candidate' | 'client' | 'agent';

export interface AppFile {
  name: string;
  path: string;
  mime: string;
  size: number;
}

export interface SharedDoc extends AppFile {
  kind?: 'diploma' | 'certificate' | 'other' | '';
}

export interface ApplicantProfile {
  name: string;
  prenom?: string;
  nom?: string;
  phone?: string;
  phones?: string[];
  links?: { label: string; url: string }[];
  city?: string;
  country?: string;
  nationality?: string;
  birthDate?: string | null;
  photoUrl?: string;
  headline?: string;
  skills?: string[];
  digitalSkills?: string[];
  languagesSpoken?: { language: string; cefrLevel: string }[];
  workExperiences?: {
    jobTitle: string;
    employer: string;
    startDate: string | null;
    endDate: string | null;
    current: boolean;
    description: string;
  }[];
  educations?: {
    title: string;
    organization: string;
    startDate: string | null;
    endDate: string | null;
    current: boolean;
  }[];
}

export interface ApplicationOffer {
  id: string;
  name: string;
  partner: string;
  companyLogo: string;
  country: { code: string; name: string };
  city: string;
  contract: string;
  salary?: string;
  sector?: string;
  deadline: string | null;
  status: string;
  expired: boolean;
}

export interface AdminApplication {
  id: string;
  status: AdminAppStatus;
  source: AppSource;
  applicantName: string;
  applicantEmail: string;
  message: string;
  cv: AppFile | null;
  attachments: AppFile[];
  sharedProfile: boolean;
  sharedCv: { id: string; name: string } | null;
  /** Motivation : message libre ou lettre complète partagée. */
  letterMode: 'message' | 'letter';
  sharedCl: { id: string; name: string } | null;
  sharedDocs: SharedDoc[];
  adminNotes: string;
  createdAt: string;
  user: { id: string; email: string; role: string; name: string; avatarUrl: string } | null;
  profile: ApplicantProfile | null;
  offer?: ApplicationOffer | null;
  /** Document CV partagé complet — présent sur le détail (`GET /admin/applications/:id`). */
  sharedCvDoc?: {
    _id: string;
    name: string;
    editorState: Record<string, unknown>;
    photoSource: string;
    customPhotoUrl: string;
  } | null;
  /** Lettre partagée complète — présente sur le détail (`GET /admin/applications/:id`). */
  sharedClDoc?: {
    _id: string;
    name: string;
    editorState: Record<string, unknown>;
  } | null;
}

export interface OfferApplicationsResult {
  offer: ApplicationOffer;
  applications: AdminApplication[];
  counters: { total: number; pending: number; review: number; accepted: number; rejected: number };
}

@Injectable({ providedIn: 'root' })
export class AdminApplicationsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/admin`;

  listForOffer(
    offerId: string,
    opts: { status?: '' | AdminAppStatus; source?: '' | AppSource },
  ): Observable<OfferApplicationsResult> {
    let params = new HttpParams();
    if (opts.status) params = params.set('status', opts.status);
    if (opts.source) params = params.set('source', opts.source);
    return this.http.get<OfferApplicationsResult>(`${this.base}/offers/${offerId}/applications`, {
      params,
    });
  }

  get(id: string): Observable<{ application: AdminApplication }> {
    return this.http.get<{ application: AdminApplication }>(`${this.base}/applications/${id}`);
  }

  update(
    id: string,
    body: { status?: AdminAppStatus; adminNotes?: string },
  ): Observable<{ application: AdminApplication }> {
    return this.http.put<{ application: AdminApplication }>(`${this.base}/applications/${id}`, body);
  }
}
