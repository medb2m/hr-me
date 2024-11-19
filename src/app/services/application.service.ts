import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';
import { Offer } from '../models/offer';
import { Application } from 'express';
import { Candidate } from '../models/candidate';

@Injectable({
  providedIn: 'root'
})
export class ApplicationService {
  private apiUrl = environment.apiUrl+'/application';

  constructor(private http: HttpClient) { }

  createApplication(applicationData: any): Observable<any> {
    return this.http.post<any>('/', applicationData);
  }

  // Method to add an application
  addApplication(
    candidateId: string,
    offerId: string,
    positionId: string,
    status: 'applied' | 'interviewing' | 'rejected' | 'hired',
    notes?: string
  ): Observable<Application> {
    const applicationData = {
      candidateId,
      offerId,
      positionId,
      status,
      notes,
    };

    return this.http.post<Application>(this.apiUrl, applicationData);
  }
  
  getApplicationsByCandidate(candidateId: string) {
    return this.http.get<Application[]>(`/candidate/${candidateId}`);
  }
  
  getApplicationsByOffer(offerId: string): Observable<Application[]> {
    return this.http.get<Application[]>(`offer/${offerId}`);
  }

  getAssignedCandidates(offerId: string): Observable<Candidate[]> {
    return this.http.get<Candidate[]>(`${this.apiUrl}/assigned/${offerId}`);
  }


}