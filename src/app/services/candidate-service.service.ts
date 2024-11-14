import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class CandidateServiceService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  getCandidates() {
    return this.http.get(`${this.apiUrl}/candidates`);
  }

  addCandidate(candidate: any) {
    return this.http.post(`${this.apiUrl}/candidates`, candidate);
  }
}
