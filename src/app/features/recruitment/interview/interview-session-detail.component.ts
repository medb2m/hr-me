import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  LucideArrowLeft,
  LucideBot,
  LucideCheckCircle2,
  LucideClock,
  LucideLoader2,
  LucidePlay,
  LucideSparkles,
  LucideStar,
  LucideUser,
} from '@lucide/angular';
import { InterviewSession } from '../../../models/interview-session';
import { InterviewService } from '../../../services/interview.service';

@Component({
  selector: 'app-interview-session-detail',
  imports: [
    CommonModule,
    RouterLink,
    LucideArrowLeft,
    LucideBot,
    LucideCheckCircle2,
    LucideClock,
    LucideLoader2,
    LucidePlay,
    LucideSparkles,
    LucideStar,
    LucideUser,
  ],
  providers: [DatePipe],
  templateUrl: './interview-session-detail.component.html',
  styleUrl: './interview-session-detail.component.css',
})
export class InterviewSessionDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly interviewService = inject(InterviewService);
  private readonly datePipe = inject(DatePipe);

  readonly session = signal<InterviewSession | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly evaluating = signal(false);
  readonly reviewScore = signal<number | null>(null);
  readonly reviewComment = signal('');
  readonly reviewEditing = signal(false);
  readonly reviewSaving = signal(false);
  sessionId = '';

  ngOnInit(): void {
    this.sessionId = this.route.snapshot.paramMap.get('sessionId') ?? '';
    if (!this.sessionId) {
      this.loading.set(false);
      this.error.set('Identifiant de session manquant.');
      return;
    }
    this.interviewService.getSession(this.sessionId).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.session.set(res.data ?? null);
        if (!res.data) this.error.set('Session introuvable.');
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Impossible de charger la session.');
      },
    });
  }

  get visibleMessages() {
    return this.session()?.messages?.filter((m) => m.role !== 'system') ?? [];
  }

  fmtDate(v?: string | null): string {
    if (!v) return '—';
    return this.datePipe.transform(v, 'dd MMM yyyy, HH:mm') ?? '—';
  }

  statusLabel(): string {
    switch (this.session()?.status) {
      case 'pending': return 'À passer';
      case 'in_progress': return 'En cours';
      case 'completed': return 'Terminé';
      case 'expired': return 'Expiré';
      default: return this.session()?.status ?? '';
    }
  }

  /** Bouton « Résumé » : génère l'évaluation IA (avis + note par sujet). */
  evaluate(): void {
    if (this.evaluating()) return;
    this.evaluating.set(true);
    this.interviewService.evaluateSession(this.sessionId).subscribe({
      next: (res) => {
        this.evaluating.set(false);
        const s = this.session();
        if (s) this.session.set({ ...s, evaluation: res.data });
      },
      error: () => this.evaluating.set(false),
    });
  }

  startReview(): void {
    const s = this.session();
    this.reviewEditing.set(true);
    this.reviewScore.set(s?.review?.score ?? null);
    this.reviewComment.set(s?.review?.comment ?? '');
  }

  saveReview(): void {
    if (this.reviewSaving()) return;
    this.reviewSaving.set(true);
    this.interviewService
      .reviewSession(this.sessionId, {
        score: this.reviewScore(),
        comment: this.reviewComment(),
      })
      .subscribe({
        next: (res) => {
          this.reviewSaving.set(false);
          this.reviewEditing.set(false);
          const s = this.session();
          if (s) this.session.set({ ...s, review: res.data.review });
        },
        error: () => this.reviewSaving.set(false),
      });
  }
}
