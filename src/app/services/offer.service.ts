import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';
import { Offer } from '../models/offer';

export interface PublicOffer {
  id: string;
  name: string;
  partner: string;
  companyLogo: string;
  country: { code: string; name: string };
  city: string;
  workMode: 'onsite' | 'hybrid' | 'remote';
  contract: string;
  salary: string;
  sector: string;
  urgent: boolean;
  openings: number;
  skills: string[];
  publishDate: string | null;
  deadline: string | null;
  daysLeft: number | null;
  applicationsCount: number;
  applied: boolean;
  description?: string;
  myStatus?: string;
}

@Injectable({
  providedIn: 'root'
})
export class OfferService {
  private apiUrl = environment.apiUrl+'/offer';

  constructor(private http: HttpClient) { }

  /** Catalogue public — offres publiées, non expirées, compteur de candidatures. */
  getPublicOffers(): Observable<{ offers: PublicOffer[] }> {
    return this.http.get<{ offers: PublicOffer[] }>(`${this.apiUrl}/public`);
  }

  getPublicOffer(id: string): Observable<{ offer: PublicOffer }> {
    return this.http.get<{ offer: PublicOffer }>(`${this.apiUrl}/public/${id}`);
  }

  getOffers(): Observable<Offer[]> {
    return this.http.get<Offer[]>(this.apiUrl);
  }

  getOfferById(id: string): Observable<Offer> {
    return this.http.get<Offer>(`${this.apiUrl}/${id}`);
  }

  createOffer(offer: Offer): Observable<Offer> {
    return this.http.post<Offer>(this.apiUrl, offer);
  }

  updateOffer(id: string, offer: Offer): Observable<Offer> {
    return this.http.put<Offer>(`${this.apiUrl}/${id}`, offer);
  }

  deleteOffer(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  addCandidateToOffer(offerId: string, candidateId: string, positionId: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/offers/${offerId}/add-candidate`, {
      candidateId,
      positionId,
    });
  }


}
