import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';
import { Candidate } from '../models/candidate';

@Injectable({
  providedIn: 'root'
})
export class CandidateService {
  private apiUrl = environment.apiUrl+'/candidates';

  constructor(private http: HttpClient) { }

  getCandidates() : Observable<Candidate[]> {
    return this.http.get<Candidate[]>(`${this.apiUrl}`);
  }

  addCandidate(candidateData : FormData): Observable<Candidate> {
    return this.http.post<Candidate>(`${this.apiUrl}`, candidateData);
  }

  getCandidateById(id : string) : Observable<Candidate>{
    return this.http.get<Candidate>(`${this.apiUrl}/${id}`)
  }

  getCandidatesByIds(ids: string[]): Observable<Candidate[]> {
    return this.http.post<Candidate[]>(`${this.apiUrl}/candidates/by-ids`, { ids });
  }
}
