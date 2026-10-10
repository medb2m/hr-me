import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type ApplicationStatus = 'pending' | 'review' | 'accepted' | 'rejected';

export interface MyApplication {
  id: string;
  status: ApplicationStatus;
  message: string;
  hasCv: boolean;
  attachmentsCount: number;
  createdAt: string;
  offer: {
    id: string;
    name: string;
    partner: string;
    companyLogo: string;
    country: { code: string; name: string };
    city: string;
    workMode: string;
    contract: string;
    salary: string;
    sector: string;
    deadline: string | null;
    offerStatus: string;
    expired: boolean;
  } | null;
}

@Injectable({ providedIn: 'root' })
export class ApplicationsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/application`;

  /** POST /api/application — multipart (cv + attachments + champs). */
  apply(body: {
    offerId: string;
    name: string;
    email?: string;
    message?: string;
    cv?: File | null;
    attachments?: File[];
  }): Observable<{ application: { id: string; status: string; createdAt: string } }> {
    const fd = new FormData();
    fd.append('offerId', body.offerId);
    fd.append('name', body.name);
    if (body.email) fd.append('email', body.email);
    if (body.message) fd.append('message', body.message);
    if (body.cv) fd.append('cv', body.cv);
    for (const f of body.attachments || []) fd.append('attachments', f);
    return this.http.post<{ application: { id: string; status: string; createdAt: string } }>(
      this.base,
      fd,
    );
  }

  /** GET /api/application/mine — mes candidatures. */
  mine(): Observable<{ applications: MyApplication[] }> {
    return this.http.get<{ applications: MyApplication[] }>(`${this.base}/mine`);
  }
}
