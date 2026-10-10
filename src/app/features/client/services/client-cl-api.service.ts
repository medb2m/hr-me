import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { ClEditorState } from '../models/cl-editor-state';

export interface ClientClDto {
  _id: string;
  user: string;
  name: string;
  editorState?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

@Injectable({ providedIn: 'root' })
export class ClientClApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/client`;

  listCls(): Observable<{ cls: ClientClDto[] }> {
    return this.http.get<{ cls: ClientClDto[] }>(`${this.base}/cls`);
  }

  createCl(body: { name: string; editorState?: ClEditorState }): Observable<{ cl: ClientClDto }> {
    return this.http.post<{ cl: ClientClDto }>(`${this.base}/cls`, body);
  }

  getCl(clId: string): Observable<{ cl: ClientClDto }> {
    return this.http.get<{ cl: ClientClDto }>(`${this.base}/cls/${clId}`);
  }

  saveCl(
    clId: string,
    body: Partial<{ name: string; editorState: ClEditorState }>,
  ): Observable<{ cl: ClientClDto }> {
    return this.http.put<{ cl: ClientClDto }>(`${this.base}/cls/${clId}`, body);
  }

  deleteCl(clId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/cls/${clId}`);
  }
}
