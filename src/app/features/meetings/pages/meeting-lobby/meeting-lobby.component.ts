import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  LucideArrowLeft,
  LucideCalendar,
  LucideClock,
  LucideCopy,
  LucideGlobe,
  LucideLoaderCircle,
  LucidePin,
  LucideUser,
  LucideUsers,
  LucideVideo,
} from '@lucide/angular';
import { MeetingsApiService } from '../../../../core/services/meetings-api.service';
import type { MeetingDto } from '../../../../core/models/hr-me-realtime.models';

const TYPE_LABELS: Record<string, string> = {
  general: 'Générale',
  team: 'Équipe',
  partner: 'Partenaire',
  client: 'Client',
  screening: 'Présélection',
  technical: 'Technique',
  final: 'Finale',
  ai_automated: 'IA automatisée',
};

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Planifiée',
  WAITING: 'En attente',
  IN_PROGRESS: 'En cours',
  ENDED: 'Terminée',
  ARCHIVED: 'Archivée',
  CANCELLED: 'Annulée',
};

const ROLE_LABELS: Record<string, string> = {
  host: 'Animateur',
  recruiter: 'Recruteur',
  candidate: 'Candidat',
  observer: 'Observateur',
};

@Component({
  selector: 'app-meeting-lobby',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    LucideArrowLeft,
    LucideCalendar,
    LucideClock,
    LucideCopy,
    LucideGlobe,
    LucideLoaderCircle,
    LucidePin,
    LucideUser,
    LucideUsers,
    LucideVideo,
  ],
  templateUrl: './meeting-lobby.component.html',
  styleUrl: './meeting-lobby.component.scss',
})
export class MeetingLobbyComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly meetingsApi = inject(MeetingsApiService);

  /** Lien retour : dans un espace dédié, on renvoie vers son calendrier ; sinon vers le hub. */
  readonly backLink = this.router.url.startsWith('/candidat')
    ? '/candidat/calendrier'
    : this.router.url.startsWith('/espace')
      ? '/espace/calendrier'
      : '/meetings';
  readonly backLabel = this.backLink === '/meetings' ? 'Réunions' : 'Calendrier';

  readonly meeting = signal<MeetingDto | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly copied = signal(false);
  readonly now = signal(Date.now());
  private readonly tick = setInterval(() => this.now.set(Date.now()), 30000);

  readonly typeLabel = computed(() => TYPE_LABELS[this.meeting()?.type ?? ''] ?? this.meeting()?.type);
  readonly statusLabel = computed(() => STATUS_LABELS[this.meeting()?.status ?? ''] ?? this.meeting()?.status);
  readonly roleLabel = (r: string) => ROLE_LABELS[r] ?? r;

  readonly startsIn = computed(() => {
    const m = this.meeting();
    if (!m) return '';
    const diff = +new Date(m.scheduledAt) - this.now();
    if (diff <= 0) return '';
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const min = Math.floor((diff % 3600000) / 60000);
    if (d > 0) return `dans ${d} j ${h} h`;
    if (h > 0) return `dans ${h} h ${min} min`;
    return `dans ${min} min`;
  });

  readonly ended = computed(() => {
    const m = this.meeting();
    if (!m) return false;
    const end = +new Date(m.scheduledAt) + m.durationMin * 60000;
    return ['ENDED', 'ARCHIVED', 'CANCELLED'].includes(m.status) || this.now() > end;
  });

  dateLong(): string {
    const m = this.meeting();
    if (!m) return '';
    return new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(m.scheduledAt));
  }

  timeOf(): string {
    const m = this.meeting();
    if (!m) return '';
    return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(
      new Date(m.scheduledAt)
    );
  }

  initials(name: string): string {
    return (name || '?')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('');
  }

  copyLink(): void {
    const m = this.meeting();
    if (!m) return;
    navigator.clipboard?.writeText(`${window.location.origin}/meetings/${m.id}/lobby`);
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 1600);
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set('Identifiant manquant.');
      this.loading.set(false);
      return;
    }
    this.meetingsApi.get(id).subscribe({
      next: (r) => {
        this.meeting.set(r.meeting);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Entretien introuvable ou accès refusé.');
        this.loading.set(false);
      },
    });
  }

  ngOnDestroy(): void {
    clearInterval(this.tick);
  }
}
