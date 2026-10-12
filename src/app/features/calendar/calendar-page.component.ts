import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  LucideBell,
  LucideCalendarDays,
  LucideCheck,
  LucideChevronDown,
  LucideChevronLeft,
  LucideChevronRight,
  LucideClock,
  LucideDownload,
  LucideLoaderCircle,
  LucideMapPin,
  LucidePencil,
  LucidePlus,
  LucideTrash2,
  LucideUser,
  LucideUsers,
  LucideVideo,
  LucideX,
} from '@lucide/angular';
import { CalendarApiService } from '../../core/services/calendar-api.service';
import { SocketService } from '../../core/services/socket.service';
import { AuthService } from '../../core/services/auth.service';
import type { CalendarEventDto } from '../../core/models/hr-me-realtime.models';

type ViewMode = 'week' | 'month' | 'agenda';

interface DayCell {
  date: Date;
  inMonth: boolean;
  today: boolean;
  events: CalendarEventDto[];
}

interface Attendee {
  id: string;
  name: string;
  email: string;
  role: string;
}

const DAY_MS = 86400000;
const HOUR_PX = 56;
const GRID_START = 7; // 7h
const GRID_END = 21; // 20h→21h

const TYPE_DEFS: { value: string; label: string; color: string }[] = [
  { value: 'MEETING', label: 'Réunion / Entretien', color: '#0ea5e9' },
  { value: 'AI_INTERVIEW', label: 'Entretien IA', color: '#7c3aed' },
  { value: 'FOLLOWUP', label: 'Relance candidat', color: '#eab308' },
  { value: 'DEADLINE', label: 'Échéance', color: '#dc2626' },
  { value: 'OFFER_EXPIRY', label: "Expiration d'offre", color: '#f97316' },
  { value: 'DOCUMENT_DUE', label: 'Document attendu', color: '#64748b' },
  { value: 'VISA_APPT', label: 'RDV visa', color: '#15803d' },
  { value: 'EMBASSY_APPT', label: 'RDV ambassade', color: '#15803d' },
  { value: 'TICKET_DUE', label: 'Ticket à traiter', color: '#a16207' },
];

@Component({
  selector: 'app-calendar-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LucideBell,
    LucideCalendarDays,
    LucideCheck,
    LucideChevronDown,
    LucideChevronLeft,
    LucideChevronRight,
    LucideClock,
    LucideDownload,
    LucideLoaderCircle,
    LucideMapPin,
    LucidePencil,
    LucidePlus,
    LucideTrash2,
    LucideUser,
    LucideUsers,
    LucideVideo,
    LucideX,
  ],
  templateUrl: './calendar-page.component.html',
  styleUrl: './calendar-page.component.scss',
})
export class CalendarPageComponent implements OnInit {
  private readonly api = inject(CalendarApiService);
  private readonly socketSvc = inject(SocketService);
  readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  readonly viewMode = signal<ViewMode>('week');
  readonly anchor = signal(new Date()); // semaine/mois affichés
  readonly events = signal<CalendarEventDto[]>([]);
  readonly loading = signal(false);
  readonly typeFilters = signal<Set<string>>(new Set(TYPE_DEFS.map((t) => t.value)));

  readonly selected = signal<CalendarEventDto | null>(null);
  readonly editing = signal<CalendarEventDto | null>(null);

  // Modal création/édition
  readonly showForm = signal(false);
  readonly saving = signal(false);
  readonly formError = signal('');
  fTitle = '';
  fType = 'MEETING';
  fDate = '';
  fStart = '09:00';
  fEnd = '10:00';
  fAllDay = false;
  fLocation = '';
  fVideoLink = '';
  fDescription = '';
  fAttendees: Attendee[] = [];
  fCandidateId = '';
  fCandidateName = '';
  attendeeQuery = '';
  attendeeResults = signal<Attendee[]>([]);
  readonly typeMenuOpen = signal(false);
  searching = signal(false);
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  readonly typeDefs = TYPE_DEFS;
  readonly hours = Array.from({ length: GRID_END - GRID_START }, (_, i) => GRID_START + i);
  readonly dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  readonly isStaff = computed(() =>
    ['admin', 'agent', 'director', 'recruiter'].includes(this.auth.user()?.role || ''),
  );

  readonly title = computed(() => {
    const d = this.anchor();
    if (this.viewMode() === 'month' || this.viewMode() === 'agenda') {
      return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    }
    const w = this.weekStart(d);
    const end = new Date(w.getTime() + 6 * DAY_MS);
    if (w.getMonth() === end.getMonth()) {
      return `${w.toLocaleDateString('fr-FR', { month: 'long' })} ${w.getFullYear()}`;
    }
    return `${w.toLocaleDateString('fr-FR', { month: 'short' })} – ${end.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}`;
  });

  /** Semaine courante (lun→dim). */
  readonly weekDays = computed(() => {
    const start = this.weekStart(this.anchor());
    return Array.from({ length: 7 }, (_, i) => new Date(start.getTime() + i * DAY_MS));
  });

  readonly monthCells = computed<DayCell[]>(() => {
    const a = this.anchor();
    const first = new Date(a.getFullYear(), a.getMonth(), 1);
    const start = this.weekStart(first);
    const cells: DayCell[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start.getTime() + i * DAY_MS);
      cells.push({
        date: d,
        inMonth: d.getMonth() === a.getMonth(),
        today: this.isToday(d),
        events: this.dayEvents(d),
      });
    }
    return cells;
  });

  readonly miniMonthCells = computed(() => {
    const a = this.anchor();
    const first = new Date(a.getFullYear(), a.getMonth(), 1);
    const start = this.weekStart(first);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start.getTime() + i * DAY_MS);
      return { date: d, inMonth: d.getMonth() === a.getMonth(), today: this.isToday(d) };
    });
  });

  /** Liste agenda : événements futurs groupés par jour (sur la fenêtre chargée). */
  readonly agendaGroups = computed(() => {
    const map = new Map<string, { date: Date; items: CalendarEventDto[] }>();
    for (const e of this.filteredEvents()) {
      const d = new Date(e.startsAt);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const g = map.get(key) || { date: new Date(d.getFullYear(), d.getMonth(), d.getDate()), items: [] };
      g.items.push(e);
      map.set(key, g);
    }
    return [...map.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
  });

  readonly filteredEvents = computed(() =>
    this.events().filter((e) => this.typeFilters().has(e.type) && e.status !== 'CANCELLED'),
  );

  ngOnInit(): void {
    this.load();
    const qp = this.route.snapshot.queryParamMap;
    if (qp.get('new') === '1') {
      this.openCreate();
      const cname = qp.get('cname') || '';
      const cid = qp.get('candidate') || '';
      if (cid) {
        this.fCandidateId = cid;
        this.fCandidateName = cname;
        this.fTitle = `Entretien — ${cname}`;
        this.fType = 'MEETING';
      }
      if (qp.get('title')) this.fTitle = qp.get('title') as string;
    }
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('authToken') : '';
    if (token) {
      const s = this.socketSvc.connect(token);
      const uid = this.auth.user()?.id;
      if (uid) s.emit('calendar:subscribe', { agentIds: [uid] });
      s.on('calendar:event_created', () => this.load());
      s.on('calendar:event_updated', () => this.load());
      s.on('calendar:event_cancelled', () => this.load());
    }
  }

  /** Fenêtre chargée : la période visible + marge. */
  private range(): { from: Date; to: Date } {
    const a = this.anchor();
    if (this.viewMode() === 'week') {
      const from = this.weekStart(a);
      return { from, to: new Date(from.getTime() + 7 * DAY_MS) };
    }
    const first = new Date(a.getFullYear(), a.getMonth(), 1);
    const from = this.weekStart(first);
    return { from, to: new Date(from.getTime() + 42 * DAY_MS) };
  }

  load(): void {
    this.loading.set(true);
    const { from, to } = this.range();
    this.api.events(from, to).subscribe({
      next: (r) => {
        this.events.set(r.items || []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  setView(v: ViewMode): void {
    this.viewMode.set(v);
    this.load();
  }

  prev(): void {
    this.step(-1);
  }
  next(): void {
    this.step(1);
  }
  private step(dir: number): void {
    const a = this.anchor();
    if (this.viewMode() === 'week') {
      this.anchor.set(new Date(a.getTime() + dir * 7 * DAY_MS));
    } else {
      this.anchor.set(new Date(a.getFullYear(), a.getMonth() + dir, 1));
    }
    this.load();
  }
  today(): void {
    this.anchor.set(new Date());
    this.load();
  }
  pickDay(d: Date): void {
    this.anchor.set(d);
    this.viewMode.set('week');
    this.load();
  }

  toggleType(t: string): void {
    this.typeFilters.update((s) => {
      const n = new Set(s);
      if (n.has(t)) n.delete(t);
      else n.add(t);
      return n;
    });
  }

  isToday(d: Date): boolean {
    const n = new Date();
    return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
  }

  weekStart(d: Date): Date {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dow = (x.getDay() + 6) % 7; // lundi = 0
    return new Date(x.getTime() - dow * DAY_MS);
  }

  dayKey(d: Date): string {
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }

  dayEvents(d: Date): CalendarEventDto[] {
    const key = this.dayKey(d);
    return this.filteredEvents().filter((e) => {
      const s = new Date(e.startsAt);
      return this.dayKey(s) === key;
    });
  }

  /** Position d'un événement dans la grille semaine (px). */
  evTop(e: CalendarEventDto): number {
    const s = new Date(e.startsAt);
    const h = s.getHours() + s.getMinutes() / 60;
    return Math.max(0, (h - GRID_START) * HOUR_PX);
  }
  evHeight(e: CalendarEventDto): number {
    const s = new Date(e.startsAt).getTime();
    const en = e.endsAt ? new Date(e.endsAt).getTime() : s + 3600000;
    const durH = Math.max(0.5, (en - s) / 3600000);
    return durH * HOUR_PX;
  }
  nowTop(): number {
    const n = new Date();
    return (n.getHours() + n.getMinutes() / 60 - GRID_START) * HOUR_PX;
  }

  typeDef(t: string): { value: string; label: string; color: string } {
    return TYPE_DEFS.find((x) => x.value === t) || { value: t, label: t, color: '#64748b' };
  }

  evColor(e: CalendarEventDto): string {
    return e.color && e.color !== '#7B1C2E' ? e.color : this.typeDef(e.type).color;
  }

  fmtTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }
  fmtDateTime(iso: string): string {
    return new Date(iso).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  fmtDayLabel(d: Date): string {
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  openDetail(e: CalendarEventDto): void {
    this.selected.set(e);
  }
  closeDetail(): void {
    this.selected.set(null);
  }

  canEdit(e: CalendarEventDto): boolean {
    const uid = this.auth.user()?.id;
    return this.isStaff() && (this.auth.user()?.role === 'admin' || e.agentId === uid);
  }

  // ── Création / édition ──────────────────────────────

  openCreate(): void {
    this.editing.set(null);
    this.fTitle = '';
    this.fType = 'MEETING';
    const d = this.anchor();
    this.fDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    this.fStart = '09:00';
    this.fEnd = '10:00';
    this.fAllDay = false;
    this.fLocation = '';
    this.fVideoLink = '';
    this.fDescription = '';
    this.fAttendees = [];
    this.fCandidateId = '';
    this.fCandidateName = '';
    this.attendeeQuery = '';
    this.attendeeResults.set([]);
    this.formError.set('');
    this.showForm.set(true);
  }

  openEdit(e: CalendarEventDto): void {
    this.editing.set(e);
    const s = new Date(e.startsAt);
    const en = e.endsAt ? new Date(e.endsAt) : new Date(s.getTime() + 3600000);
    this.fTitle = e.title;
    this.fType = e.type;
    this.fDate = `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, '0')}-${String(s.getDate()).padStart(2, '0')}`;
    this.fStart = `${String(s.getHours()).padStart(2, '0')}:${String(s.getMinutes()).padStart(2, '0')}`;
    this.fEnd = `${String(en.getHours()).padStart(2, '0')}:${String(en.getMinutes()).padStart(2, '0')}`;
    this.fAllDay = e.allDay;
    this.fLocation = e.location || '';
    this.fVideoLink = e.videoLink || '';
    this.fDescription = e.description || '';
    this.fAttendees = (e.participants || [])
      .filter((p) => p.userId)
      .map((p) => ({ id: String(p.userId), name: p.email || String(p.userId), email: p.email || '', role: '' }));
    this.fCandidateId = e.candidateId || '';
    this.fCandidateName = '';
    this.formError.set('');
    this.showForm.set(true);
    this.closeDetail();
  }

  closeForm(): void {
    this.showForm.set(false);
    this.typeMenuOpen.set(false);
  }

  pickType(v: string): void {
    this.fType = v;
    this.typeMenuOpen.set(false);
  }

  searchAttendees(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      if (!this.isStaff()) return;
      this.searching.set(true);
      this.api.attendees(this.attendeeQuery.trim()).subscribe({
        next: (r) => {
          this.attendeeResults.set(
            (r.attendees || []).filter((a) => !this.fAttendees.some((x) => x.id === a.id)),
          );
          this.searching.set(false);
        },
        error: () => this.searching.set(false),
      });
    }, 250);
  }

  addAttendee(a: Attendee): void {
    this.fAttendees = [...this.fAttendees, a];
    this.attendeeQuery = '';
    this.attendeeResults.set([]);
  }

  removeAttendee(id: string): void {
    this.fAttendees = this.fAttendees.filter((a) => a.id !== id);
  }

  save(): void {
    if (this.fTitle.trim().length < 2) {
      this.formError.set('Indiquez un titre.');
      return;
    }
    const startsAt = this.fAllDay
      ? new Date(`${this.fDate}T08:00:00`)
      : new Date(`${this.fDate}T${this.fStart}:00`);
    const endsAt = this.fAllDay
      ? new Date(`${this.fDate}T18:00:00`)
      : new Date(`${this.fDate}T${this.fEnd}:00`);
    if (Number.isNaN(startsAt.getTime())) {
      this.formError.set('Date invalide.');
      return;
    }
    this.saving.set(true);
    const body: Record<string, unknown> = {
      title: this.fTitle.trim(),
      type: this.fType,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      allDay: this.fAllDay,
      location: this.fLocation,
      videoLink: this.fVideoLink,
      description: this.fDescription,
      color: this.typeDef(this.fType).color,
      participants: this.fAttendees.map((a) => ({ userId: a.id, email: a.email, role: 'REQUIRED' })),
      candidateId: this.fCandidateId || null,
    };
    const req = this.editing()
      ? this.api.update(this.editing()!.id, body as Partial<CalendarEventDto>)
      : this.api.create(body as Partial<CalendarEventDto>);
    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.showForm.set(false);
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.formError.set(err?.error?.message || 'Enregistrement impossible.');
      },
    });
  }

  cancelEvent(e: CalendarEventDto, ev?: Event): void {
    ev?.stopPropagation();
    this.api.cancel(e.id).subscribe({
      next: () => {
        this.closeDetail();
        this.load();
      },
    });
  }

  icsUrl(e: CalendarEventDto): string {
    return this.api.downloadIcsUrl(e.id);
  }
}
