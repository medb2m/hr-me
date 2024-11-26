import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Ticket } from '../models/ticket';
import { TicketResponse } from '../models/ticketResponse';

@Injectable({
  providedIn: 'root',
})
export class TicketService { // Replace with your API URL
  private apiUrl = environment.apiUrl+'/ticket';
  constructor(private http: HttpClient) {}

  getAllTickets(): Observable<TicketResponse> {
    return this.http.get<TicketResponse>(`${this.apiUrl}`);
  }

  getTicketById(id: string): Observable<Ticket> {
    return this.http.get<Ticket>(`${this.apiUrl}/${id}`);
  }

  createTicket(ticketData: FormData): Observable<any> {
    return this.http.post(`${this.apiUrl}`, ticketData);
  }

  updateTicket(id: string, ticket: Partial<Ticket>): Observable<Ticket> {
    return this.http.put<Ticket>(`${this.apiUrl}/${id}`, ticket);
  }

  deleteTicket(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
