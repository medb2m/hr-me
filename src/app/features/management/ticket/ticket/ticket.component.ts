import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Ticket } from '../../../../models/ticket';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TicketService } from '../../../../services/ticket.service';
import { tick } from '@angular/core/testing';

@Component({
  selector: 'app-ticket',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './ticket.component.html',
  styleUrl: './ticket.component.css'
})
export class TicketComponent {
  ticket: Ticket | null = null;

  constructor(
    private route: ActivatedRoute,
    private ticketService: TicketService
  ) {}

  ngOnInit(): void {
    const ticketId = this.route.snapshot.paramMap.get('id');
    console.log(ticketId)
    if (ticketId) {
      this.ticketService.getTicketById(ticketId).subscribe({
        next: (data) => (this.ticket = data),
        error: (err) => console.error(err),
      });
      console.log(this.ticket)
    }
  }

  // Determine CSS classes for priority
  getPriorityClass(priority: string): string {
    switch (priority) {
      case 'Low':
        return 'bg-success text-white';
      case 'Medium':
        return 'bg-primary text-white';
      case 'High':
        return 'bg-warning text-white';
      case 'Urgent':
        return 'bg-danger text-white';
      default:
        return 'bg-secondary text-white';
    }
  }

  // Determine CSS classes for status
  getStatusClass(status: string): string {
    switch (status) {
      case 'Open':
        return 'bg-info text-white';
      case 'In Progress':
        return 'bg-warning text-dark';
      case 'Resolved':
        return 'bg-success text-white';
      case 'Closed':
        return 'bg-secondary text-white';
      default:
        return 'bg-light text-dark';
    }
  }

  
}
