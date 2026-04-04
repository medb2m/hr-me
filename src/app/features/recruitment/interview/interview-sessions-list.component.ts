import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { InterviewSessionListItem } from '../../../models/interview-session';
import { InterviewService } from '../../../services/interview.service';

@Component({
  selector: 'app-interview-sessions-list',
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './interview-sessions-list.component.html',
  styleUrl: './interview-sessions-list.component.css',
})
export class InterviewSessionsListComponent implements OnInit {
  sessions: InterviewSessionListItem[] = [];
  loading = true;
  error: string | null = null;
  statusFilter: '' | 'in_progress' | 'completed' = '';

  constructor(private readonly interviewService: InterviewService) {}

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading = true;
    this.error = null;
    const status = this.statusFilter || undefined;
    this.interviewService.listSessions({ status, limit: 50 }).subscribe({
      next: (res) => {
        this.loading = false;
        this.sessions = res.data ?? [];
      },
      error: () => {
        this.loading = false;
        this.error = 'Could not load interview sessions.';
      },
    });
  }

  onFilterChange(): void {
    this.reload();
  }
}
