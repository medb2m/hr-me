import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { CvEditorState } from '../models/cv-editor-state';

export interface ClientCvDto {
  _id: string;
  user: string;
  name: string;
  photoSource: 'profile' | 'custom';
  customPhotoUrl?: string;
  editorState?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

@Injectable({ providedIn: 'root' })
export class ClientCvApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/client`;

  listCvs(): Observable<{ cvs: ClientCvDto[] }> {
    return this.http.get<{ cvs: ClientCvDto[] }>(`${this.base}/cvs`);
  }

  createCv(body: { name: string; editorState?: CvEditorState }): Observable<{ cv: ClientCvDto }> {
    return this.http.post<{ cv: ClientCvDto }>(`${this.base}/cvs`, body);
  }

  getCv(cvId: string): Observable<{ cv: ClientCvDto }> {
    return this.http.get<{ cv: ClientCvDto }>(`${this.base}/cvs/${cvId}`);
  }

  saveCv(cvId: string, body: Partial<{ name: string; editorState: CvEditorState; photoSource: string; customPhotoUrl: string }>): Observable<{ cv: ClientCvDto }> {
    return this.http.put<{ cv: ClientCvDto }>(`${this.base}/cvs/${cvId}`, body);
  }

  deleteCv(cvId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/cvs/${cvId}`);
  }

  uploadCvPhoto(cvId: string, file: File): Observable<{ customPhotoUrl: string; cv: ClientCvDto }> {
    const fd = new FormData();
    fd.append('photo', file);
    return this.http.post<{ customPhotoUrl: string; cv: ClientCvDto }>(`${this.base}/cvs/${cvId}/photo`, fd);
  }
}
