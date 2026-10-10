import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AiTextService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/ai`;

  /** Correction orthographique/grammaticale (LLM) — texte brut ou HTML conservé. */
  correctText(text: string): Observable<{ corrected: string }> {
    return this.http.post<{ corrected: string }>(`${this.base}/correct-text`, { text });
  }
}
