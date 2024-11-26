import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TicketService } from '../../../../services/ticket.service';
import { Router } from 'express';
import { Ticket } from '../../../../models/ticket';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-add-ticket',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule
  ],
  templateUrl: './add-ticket.component.html',
  styleUrl: './add-ticket.component.css'
})
export class AddTicketComponent {
  ticketForm!: FormGroup;
  files: File[] = []; // To hold the selected files

  // Dropdown options
  statuses = ['Open', 'In Progress', 'Resolved', 'Closed'];
  priorities = ['Low', 'Medium', 'High', 'Urgent'];
  types = [
    'Document Request',
    'Missing Documents',
    'Missing Information',
    'Candidate Follow-Up',
    'Offer Revision',
    'Application Review',
    'Interview Scheduling',
    'Interview Feedback',
    'Onboarding Process',
    'Follow-Up',
    'Bug',
    'Feature Request',
    'Task',
  ];
  assignedTeams = ['IT', 'Com'];

  constructor(
    private fb: FormBuilder,
    private ticketService: TicketService
  ) {}

  ngOnInit(): void {
    // Initialize the form
    this.ticketForm = this.fb.group({
      title: ['', Validators.required],
      description: ['', Validators.required],
      status: ['Open', Validators.required],
      priority: ['Low', Validators.required],
      type: ['Task', Validators.required],
      assignedTeam: ['IT', Validators.required],
      deadline: [null],
      files: [null]
    });
  }

  // File selection handler
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input?.files) {
      // Limit to 5 files for this example
      if (input.files.length <= 5) {
        this.files = Array.from(input.files); // Store selected files
      } else {
        alert('You can upload a maximum of 5 files');
      }
    }
  }

   // Submit form
   onSubmit(): void {
    if (this.ticketForm.valid) {
      const formData = new FormData();
      // Append form fields to FormData
      for (const key in this.ticketForm.value) {
        if (key !== 'files') {
          formData.append(key, this.ticketForm.value[key]);
        }
      }

      // Append files to FormData
      this.files.forEach(file => formData.append('files', file, file.name));

      // Create the ticket using the ticket service
      this.ticketService.createTicket(formData).subscribe({
        next: () => {
          alert('Ticket added successfully!');
          // Redirect or reset form here
        },
        error: (err) => {
          console.error(err);
          alert('Failed to create the ticket.');
        },
      });
    }
  }


  /* onSubmit(): void {
    if (this.ticketForm.valid) {
      const newTicket: Ticket = this.ticketForm.value;
      this.ticketService.createTicket(newTicket).subscribe({
        next: () => {
          alert('Ticket added successfully!');
          //this.router.navigate(['/tickets']); // Redirect to the ticket list
        },
        error: (err) => {
          console.error(err);
          alert('Failed to create the ticket.');
        },
      });
    }
  } */
}
