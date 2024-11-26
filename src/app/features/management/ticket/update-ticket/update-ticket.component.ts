import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TicketService } from '../../../../services/ticket.service';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-update-ticket',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './update-ticket.component.html',
  styleUrl: './update-ticket.component.css'
})
export class UpdateTicketComponent {
  ticketForm!: FormGroup;
  ticketId!: string;

  statuses = ['Open', 'In Progress', 'Resolved', 'Closed'];
  priorities = ['Low', 'Medium', 'High', 'Urgent'];

  constructor(
    private fb: FormBuilder,
    private ticketService: TicketService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.ticketId = this.route.snapshot.paramMap.get('id')!;
    this.initializeForm();
    this.loadTicketData();
  }

  initializeForm(): void {
    this.ticketForm = this.fb.group({
      title: ['', Validators.required],
      description: ['', Validators.required],
      status: ['Open', Validators.required],
      priority: ['Low', Validators.required],
    });
  }

  loadTicketData(): void {
    this.ticketService.getTicketById(this.ticketId).subscribe({
      next: (ticket) => {
        this.ticketForm.patchValue(ticket);
      },
      error: (err) => {
        console.error(err);
        alert('Failed to load ticket data.');
      },
    });
  }

  onSubmit(): void {
    if (this.ticketForm.valid) {
      const updatedData = this.ticketForm.value;
      this.ticketService.updateTicket(this.ticketId, updatedData).subscribe({
        next: () => {
          alert('Ticket updated successfully!');
          this.router.navigate(['/list-ticket']);
        },
        error: (err) => {
          console.error(err);
          alert('Failed to update ticket.');
        },
      });
    }
  }
}
