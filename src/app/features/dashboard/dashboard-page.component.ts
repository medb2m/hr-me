import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  LucideBot,
  LucideBriefcase,
  LucideCalendar,
  LucideGauge,
  LucideLifeBuoy,
  LucideTicket,
  LucideUsers,
  LucideVideo,
} from '@lucide/angular';
import { AuthService } from '../../core/services/auth.service';
import { MeetingsApiService } from '../../core/services/meetings-api.service';
import { TicketsApiService } from '../../core/services/tickets-api.service';
import { AdminUsersApiService } from '../admin/services/admin-users-api.service';
import { AdminOffersApiService } from '../admin/services/admin-offers-api.service';
import type { MeetingDto } from '../../core/models/hr-me-realtime.models';

interface Kpi {
  label: string;
  value: string;
  sub: string;
  icon: string;
}

interface QuickLink {
  label: string;
  sub: string;
  link: string;
  icon: string;
}

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    LucideGauge,
    LucideUsers,
    LucideBriefcase,
    LucideTicket,
    LucideVideo,
    LucideCalendar,
    LucideBot,
    LucideLifeBuoy,
  ],
  templateUrl: './dashboard-page.component.html',
  styleUrl: './dashboard-page.component.scss',
})
export class DashboardPageComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly meetingsApi = inject(MeetingsApiService);
  private readonly ticketsApi = inject(TicketsApiService);
  private readonly usersApi = inject(AdminUsersApiService);
  private readonly offersApi = inject(AdminOffersApiService);

  readonly loading = signal(true);
  readonly kpis = signal<Kpi[]>([]);
  readonly upcoming = signal<MeetingDto[]>([]);

  readonly today = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  readonly isAdmin = computed(() => this.auth.user()?.role === 'admin');
  readonly isStaff = computed(() =>
    ['admin', 'agent', 'director', 'recruiter'].includes(this.auth.user()?.role || '')
  );

  readonly firstName = computed(
    () => (this.auth.user()?.name || this.auth.user()?.email || '').split(' ')[0] || 'vous'
  );

  readonly roleLabel = computed(() => {
    const r = this.auth.user()?.role || '';
    return (
      {
        admin: 'Administrateur',
        director: 'Directeur',
        agent: 'Agent',
        recruiter: 'Recruteur',
        client: 'Client',
        candidate: 'Candidat',
      }[r] || r
    );
  });

  readonly quickLinks = computed<QuickLink[]>(() => {
    if (this.isStaff()) {
      return [
        { label: 'Mes réunions', sub: 'Planifier et rejoindre', link: '/meetings', icon: 'video' },
        { label: 'Calendrier', sub: 'Agenda et événements', link: '/calendar', icon: 'calendar' },
        { label: 'Tickets', sub: 'Support & kanban', link: '/admin/tickets', icon: 'ticket' },
        { label: 'Entretiens IA', sub: 'Sessions automatisées', link: '/recruitment/interview', icon: 'bot' },
        ...(this.isAdmin()
          ? [
              { label: 'Utilisateurs', sub: 'Comptes et rôles', link: '/admin/users', icon: 'users' },
              { label: 'Offres', sub: 'Publication et suivi', link: '/admin/offers', icon: 'briefcase' },
            ]
          : []),
      ];
    }
    const isCandidate = this.auth.user()?.role === 'candidate';
    return [
      {
        label: isCandidate ? 'Mon espace candidat' : 'Mon espace client',
        sub: 'Profil et documents',
        link: isCandidate ? '/candidat/overview' : '/espace/accueil',
        icon: 'users',
      },
      { label: 'Mes réunions', sub: 'Entretiens planifiés', link: '/meetings', icon: 'video' },
      { label: 'Offres ouvertes', sub: 'Postes internationaux', link: '/jobs', icon: 'briefcase' },
      {
        label: 'Support',
        sub: 'Aide et demandes',
        link: isCandidate ? '/candidat/support' : '/espace/support',
        icon: 'lifebuoy',
      },
    ];
  });

  ngOnInit(): void {
    const now = new Date();
    const inTwoWeeks = new Date(now.getTime() + 14 * 86400000);

    const meetings$ = this.meetingsApi
      .list(now, inTwoWeeks, { scope: 'mine' })
      .pipe(catchError(() => of({ items: [] as MeetingDto[] })));

    if (!this.isStaff()) {
      meetings$.subscribe((r) => {
        this.applyMeetings(r.items);
        this.loading.set(false);
      });
      return;
    }

    // Équipe interne : KPIs réunions + tickets (+ admin : users, offres, candidatures)
    forkJoin({
      meetings: meetings$,
      tickets: this.ticketsApi.stats().pipe(catchError(() => of(null))),
      users: this.isAdmin() ? this.usersApi.stats().pipe(catchError(() => of(null))) : of(null),
      offers: this.isAdmin()
        ? this.offersApi.list({ limit: 1 }).pipe(catchError(() => of(null)))
        : of(null),
    }).subscribe(({ meetings, tickets, users, offers }) => {
      this.applyMeetings(meetings.items);
      const kpis: Kpi[] = [];
      const openTickets = tickets
        ? (tickets.byStatus.open || 0) +
          (tickets.byStatus.in_progress || 0) +
          (tickets.byStatus.waiting || 0)
        : 0;
      kpis.push({
        label: 'Réunions à venir',
        value: String(meetings.items.length),
        sub: '14 prochains jours',
        icon: 'video',
      });
      if (tickets) {
        kpis.push({
          label: 'Tickets ouverts',
          value: String(openTickets),
          sub: tickets.urgentOpen ? `${tickets.urgentOpen} urgent(s)` : 'file de support',
          icon: 'ticket',
        });
      }
      if (users) {
        kpis.push({
          label: 'Utilisateurs',
          value: String(users.total),
          sub: `${users.recent30d} nouveau(x) · 30 j`,
          icon: 'users',
        });
      }
      if (offers) {
        kpis.push({
          label: 'Offres publiées',
          value: String(offers.counters.published),
          sub: `${offers.counters.total} au total`,
          icon: 'briefcase',
        });
      }
      this.kpis.set(kpis);
      this.loading.set(false);
    });
  }

  private applyMeetings(items: MeetingDto[]): void {
    const now = Date.now();
    this.upcoming.set(
      items
        .filter((m) => m.status !== 'CANCELLED' && new Date(m.scheduledAt).getTime() >= now - 3600000)
        .sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt))
        .slice(0, 6)
    );
  }

  meetingWhen(m: MeetingDto): string {
    return new Intl.DateTimeFormat('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(m.scheduledAt));
  }

  meetingDay(m: MeetingDto): string {
    return new Intl.DateTimeFormat('fr-FR', { day: '2-digit' }).format(new Date(m.scheduledAt));
  }

  meetingMonth(m: MeetingDto): string {
    return new Intl.DateTimeFormat('fr-FR', { month: 'short' }).format(new Date(m.scheduledAt));
  }
}
