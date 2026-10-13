import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  LucideAlertTriangle,
  LucideBot,
  LucideCheckCircle2,
  LucideClock,
  LucideLoader2,
  LucideSend,
  LucideUser,
} from '@lucide/angular';
import { InterviewSession } from '../../../models/interview-session';
import { InterviewService } from '../../../services/interview.service';

type Phase = 'loading' | 'error' | 'ready' | 'chat' | 'done' | 'expired';

@Component({
  selector: 'app-interview-pass',
  imports: [
    CommonModule,
    LucideAlertTriangle,
    LucideBot,
    LucideCheckCircle2,
    LucideClock,
    LucideLoader2,
    LucideSend,
    LucideUser,
  ],
  providers: [DatePipe],
  templateUrl: './interview-pass.component.html',
  styleUrl: './interview-pass.component.css',
})
export class InterviewPassComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly interviewService = inject(InterviewService);
  private readonly datePipe = inject(DatePipe);

  readonly phase = signal<Phase>('loading');
  readonly session = signal<InterviewSession | null>(null);
  readonly error = signal('');
  readonly starting = signal(false);
  readonly sending = signal(false);
  readonly finishing = signal(false);
  readonly draft = signal('');
  readonly countdown = signal('');

  private token = '';
  private timer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token') ?? '';
    if (!this.token) {
      this.phase.set('error');
      this.error.set('Lien invalide.');
      return;
    }
    this.interviewService.accessSession(this.token).subscribe({
      next: (res) => {
        this.session.set(res.data);
        if (res.data.status === 'completed') this.phase.set('done');
        else if (res.data.status === 'expired') this.phase.set('expired');
        else this.phase.set('ready');
        this.startCountdown();
      },
      error: (err) => {
        this.phase.set('error');
        this.error.set(err?.error?.message || 'Impossible de charger cet entretien.');
      },
    });
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private startCountdown(): void {
    const tick = () => {
      const s = this.session();
      if (!s?.expiresAt) {
        this.countdown.set('');
        return;
      }
      const ms = new Date(s.expiresAt).getTime() - Date.now();
      if (ms <= 0) {
        this.countdown.set('Délai dépassé');
        if (this.phase() !== 'done' && this.phase() !== 'error') this.phase.set('expired');
        return;
      }
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      this.countdown.set(h > 0 ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`);
    };
    tick();
    this.timer = setInterval(tick, 30000);
  }

  start(): void {
    this.starting.set(true);
    this.interviewService.accessStart(this.token).subscribe({
      next: (res) => {
        this.starting.set(false);
        this.session.set(res.data);
        if (res.data.status === 'completed') this.phase.set('done');
        else this.phase.set('chat');
        this.scrollBottom();
      },
      error: (err) => {
        this.starting.set(false);
        if (err?.status === 410) this.phase.set('expired');
        else this.error.set(err?.error?.message || 'Démarrage impossible.');
      },
    });
  }

  onDraft(v: string): void {
    this.draft.set(v);
  }

  send(): void {
    const text = this.draft().trim();
    if (!text || this.sending()) return;
    this.sending.set(true);
    this.draft.set('');
    const s = this.session();
    if (s) {
      s.messages.push({ role: 'user', content: text, createdAt: new Date().toISOString() });
      this.session.set({ ...s });
      this.scrollBottom();
    }
    this.interviewService.accessMessage(this.token, text).subscribe({
      next: (res) => {
        this.sending.set(false);
        const cur = this.session();
        if (cur) {
          cur.messages.push({ role: 'assistant', content: res.data.assistantMessage });
          this.session.set({ ...cur });
          this.scrollBottom();
        }
      },
      error: (err) => {
        this.sending.set(false);
        if (err?.status === 410) this.phase.set('expired');
        else {
          const cur = this.session();
          if (cur) {
            cur.messages.push({
              role: 'assistant',
              content: '⚠️ ' + (err?.error?.message || 'Erreur de communication avec l’IA. Réessayez.'),
            });
            this.session.set({ ...cur });
          }
        }
      },
    });
  }

  onEnter(e: Event): void {
    e.preventDefault();
    this.send();
  }

  finish(): void {
    if (!confirm('Terminer l’entretien ? Il ne pourra pas être repris.')) return;
    this.finishing.set(true);
    this.interviewService.accessComplete(this.token).subscribe({
      next: (res) => {
        this.finishing.set(false);
        this.session.set(res.data);
        this.phase.set('done');
      },
      error: () => this.finishing.set(false),
    });
  }

  messages() {
    return this.session()?.messages ?? [];
  }

  scheduledLabel(): string {
    const s = this.session();
    if (!s?.scheduledAt) return '';
    return this.datePipe.transform(s.scheduledAt, 'EEEE d MMMM, HH:mm', 'fr') ?? '';
  }

  private scrollBottom(): void {
    setTimeout(() => {
      const el = document.querySelector('.pass-messages');
      if (el) el.scrollTop = el.scrollHeight;
    }, 40);
  }
}
