import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export type ClientDocKind = 'diploma' | 'certificate' | 'other';

export interface ClientDocumentDto {
  id: string;
  kind: ClientDocKind;
  name: string;
  path: string;
  mime: string;
  size: number;
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

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/documents/${id}`);
  }
}
