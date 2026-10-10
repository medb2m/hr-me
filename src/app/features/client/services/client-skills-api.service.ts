import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface SkillSuggestion {
  label: string;
  category: string;
  kind: 'skill' | 'digital';
}

@Injectable({ providedIn: 'root' })
export class ClientSkillsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/client/skill-library`;

  /** Suggestions de la bibliothèque : `q` vide → les plus utilisées. */
  suggest(q: string, kind: 'skill' | 'digital', limit = 20): Observable<{ skills: SkillSuggestion[] }> {
    const params = new HttpParams()
      .set('kind', kind)
      .set('limit', String(limit))
      .set('q', q.trim());
    return this.http.get<{ skills: SkillSuggestion[] }>(this.base, { params });
  }

  /** Enregistre une compétence saisie — la bibliothèque « apprend ». */
  register(label: string, kind: 'skill' | 'digital'): Observable<{ skill: SkillSuggestion }> {
    return this.http.post<{ skill: SkillSuggestion }>(`${this.base}/register`, { label, kind });
  }
}
