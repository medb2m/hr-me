import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Ticket } from '../../../../models/ticket';
import { TicketService } from '../../../../services/ticket.service';
import { Router } from 'express';
import { RouterLink } from '@angular/router';
import { TicketResponse } from '../../../../models/ticketResponse';

@Component({
  selector: 'app-list-ticket',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './list-ticket.component.html',
  styleUrl: './list-ticket.component.css'
})
export class ListTicketComponent {
  tickets: Ticket[] = [];
  searchQuery: string = '';
  sortField: keyof Ticket = 'title';
  sortDirection: 'asc' | 'desc' = 'asc';

  constructor(private ticketService: TicketService) {}

  ngOnInit(): void {
    console.log('hello')
    this.loadTickets();
  }

  loadTickets(): void {
    this.ticketService.getAllTickets().subscribe({
      next: (response : TicketResponse) => {
        if (Array.isArray(response.data)) {
          this.tickets = response.data; // Assign the data only if it's an array
        } else {
          console.error('Expected an array but received:', response);
          this.tickets = []; // Fallback to an empty array
        }
      },
      error: (err) => {
        console.error('Failed to fetch tickets:', err);
        this.tickets = []; // Handle error by resetting to an empty array
      },
    });
  }

  filteredTickets(): Ticket[] {
    return this.tickets
      .filter((ticket) =>
        this.searchQuery
          ? ticket.title.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
            ticket.description.toLowerCase().includes(this.searchQuery.toLowerCase())
          : true
      )
      .sort((a, b) => {
        const valueA = a[this.sortField] ?? ''; // Use a fallback for undefined values
        const valueB = b[this.sortField] ?? '';
        const compare =
        valueA > valueB ? 1 : valueA < valueB ? -1 : 0;
        return this.sortDirection === 'asc' ? compare : -compare;
      });
  }

  sort(field: keyof Ticket): void {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'asc';
    }
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'Open':
        return 'text-primary';
      case 'In Progress':
        return 'text-warning';
      case 'Resolved':
        return 'text-success';
      case 'Closed':
        return 'text-muted';
      default:
        return '';
    }
  }

  /* viewTicket(ticketId: string): void {
    this.router(['/tickets', ticketId]); // Navigate to ticket details
  } */

  deleteTicket(ticketId: string): void {
    if (confirm('Are you sure you want to delete this ticket?')) {
      this.ticketService.deleteTicket(ticketId).subscribe({
        next: () => {
          alert('Ticket deleted successfully!');
          this.loadTickets(); // Refresh the ticket list
        },
        error: (err) => {
          console.error('Failed to delete ticket:', err);
          alert('Failed to delete ticket.');
        },
      });
    }
  }
}
