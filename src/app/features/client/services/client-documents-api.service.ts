import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export type ClientDocKind = 'diploma' | 'certificate' | 'other';
export type DocAiStatus = 'none' | 'analyzing' | 'done' | 'failed';

export interface ClientDocumentAi {
  title: string;
  /** diploma | certificate | attestation | id | cv | contract | other */
  docType: string;
  issuer: string;
  holder: string;
  issueDate: string;
  expiryDate: string;
  summary: string;
  keywords: string[];
  error: string;
}

export interface ClientDocumentDto {
  id: string;
  kind: ClientDocKind;
  name: string;
  /** `/uploads/client-documents/…` — même origine, utilisable en <img>/<iframe>. */
  path: string;
  mime: string;
  size: number;
  description: string;
  aiStatus: DocAiStatus;
  ai: ClientDocumentAi;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class ClientDocumentsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/client`;

  list(): Observable<{ documents: ClientDocumentDto[] }> {
    return this.http.get<{ documents: ClientDocumentDto[] }>(`${this.base}/documents`);
  }

  upload(file: File, kind: ClientDocKind, name?: string): Observable<{ document: ClientDocumentDto }> {
    const fd = new FormData();
    fd.append('document', file);
    fd.append('kind', kind);
    if (name?.trim()) fd.append('name', name.trim());
    return this.http.post<{ document: ClientDocumentDto }>(`${this.base}/documents`, fd);
  }

  update(
    id: string,
    body: { name?: string; kind?: ClientDocKind; description?: string },
  ): Observable<{ document: ClientDocumentDto }> {
    return this.http.patch<{ document: ClientDocumentDto }>(`${this.base}/documents/${id}`, body);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/documents/${id}`);
  }
}
