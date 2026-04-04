import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { InterviewSession } from '../../../models/interview-session';
import { InterviewService } from '../../../services/interview.service';

@Component({
  selector: 'app-interview-session-detail',
  imports: [CommonModule, RouterLink],
  templateUrl: './interview-session-detail.component.html',
  styleUrl: './interview-session-detail.component.css',
})
export class InterviewSessionDetailComponent implements OnInit {
  session: InterviewSession | null = null;
  loading = true;
  error: string | null = null;
  sessionId = '';

  constructor(
    private readonly route: ActivatedRoute,
    private readonly interviewService: InterviewService
  ) {}

  ngOnInit(): void {
    this.sessionId = this.route.snapshot.paramMap.get('sessionId') ?? '';
    if (!this.sessionId) {
      this.loading = false;
      this.error = 'Missing session id.';
      return;
    }
    this.interviewService.getSession(this.sessionId).subscribe({
      next: (res) => {
        this.loading = false;
        this.session = res.data ?? null;
        if (!this.session) {
          this.error = 'Session not found.';
        }
      },
      error: () => {
        this.loading = false;
        this.error = 'Could not load session.';
      },
    });
  }

  get visibleMessages() {
    return this.session?.messages?.filter((m) => m.role !== 'system') ?? [];
  }
}
