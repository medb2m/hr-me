import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  LucideArchive,
  LucideBan,
  LucideCalendar,
  LucideCheck,
  LucideClock,
  LucideCopy,
  LucideHistory,
  LucideLoaderCircle,
  LucidePencil,
  LucidePin,
  LucidePlus,
  LucideRotateCcw,
  LucideSearch,
  LucideSparkles,
  LucideUser,
  LucideUsers,
  LucideVideo,
  LucideX,
} from '@lucide/angular';
import { MeetingsApiService } from '../../../../core/services/meetings-api.service';
import { AuthService } from '../../../../core/services/auth.service';
import { DatePickerComponent } from '../../../../shared/components/date-picker/date-picker.component';
import { TimePickerComponent } from '../../../../shared/components/time-picker/time-picker.component';
import type { MeetingDto, MeetingParticipantDto } from '../../../../core/models/hr-me-realtime.models';

type PeriodTab = 'upcoming' | 'history' | 'all';
type Scope = 'mine' | 'all';

const TYPE_DEFS: { value: string; label: string; color: string }[] = [
  { value: 'screening', label: 'Présélection', color: '#0ea5e9' },
  { value: 'technical', label: 'Technique', color: '#8b5cf6' },
  { value: 'final', label: 'Finale', color: '#eab308' },
  { value: 'ai_automated', label: 'IA automatisée', color: '#f97316' },
];

const STATUS_DEFS: Record<string, { label: string; color: string; bg: string }> = {
  SCHEDULED: { label: 'Planifiée', color: '#0369a1', bg: '#e0f2fe' },
  WAITING: { label: 'En attente', color: '#b45309', bg: '#fef3c7' },
  IN_PROGRESS: { label: 'En cours', color: '#15803d', bg: '#dcfce7' },
  ENDED: { label: 'Terminée', color: '#475569', bg: '#f1f5f9' },
  ARCHIVED: { label: 'Archivée', color: '#64748b', bg: '#f1f5f9' },
  CANCELLED: { label: 'Annulée', color: '#b91c1c', bg: '#fee2e2' },
};

const DURATIONS = [15, 20, 30, 45, 60, 90, 120];
const TIMEZONES = ['Africa/Tunis', 'Europe/Paris', 'Europe/Berlin', 'Asia/Dubai', 'America/New_York'];
const LANGS = [
  { value: 'fr', label: 'Français' },
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'العربية' },
  { value: 'it', label: 'Italiano' },
];

/** Idées futures — section statique en attente de validation. */
const FUTURE_IDEAS = [
  { icon: 'video', title: 'Enregistrement', desc: 'Revoir les entretiens après coup, partage interne sécurisé.' },
  { icon: 'sparkles', title: 'Transcription & résumé IA', desc: 'Compte rendu automatique de chaque réunion.' },
  { icon: 'check', title: 'Feedback & notation', desc: 'Grille d’évaluation remplie par chaque recruteur (champ prêt en base).' },
  { icon: 'history', title: 'Récurrence', desc: 'Points hebdomadaires d’équipe auto-reconduits.' },
  { icon: 'clock', title: 'Rappels automatiques', desc: 'Notification + e-mail 24 h et 15 min avant le début.' },
];

@Component({
  selector: 'app-meetings-hub',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    DatePickerComponent,
    TimePickerComponent,
    LucideArchive,
    LucideBan,
    LucideCalendar,
    LucideCheck,
    LucideClock,
    LucideCopy,
    LucideHistory,
    LucideLoaderCircle,
    LucidePencil,
    LucidePin,
    LucidePlus,
    LucideRotateCcw,
    LucideSearch,
    LucideSparkles,
    LucideUser,
    LucideUsers,
    LucideVideo,
    LucideX,
  ],
  templateUrl: './meetings-hub.component.html',
  styleUrl: './meetings-hub.component.scss',
})
export class MeetingsHubComponent implements OnInit {
  private readonly api = inject(MeetingsApiService);
  private readonly auth = inject(AuthService);

  readonly typeDefs = TYPE_DEFS;
  readonly statusDefs = STATUS_DEFS;
  readonly durations = DURATIONS;
  readonly timezones = TIMEZONES;
  readonly langs = LANGS;
  readonly futureIdeas = FUTURE_IDEAS;

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly items = signal<MeetingDto[]>([]);

  readonly period = signal<PeriodTab>('upcoming');
  readonly scope = signal<Scope>('mine');
  readonly statusFilter = signal<string>('');
  readonly query = signal('');

  // ── Modal édition / détail ──
  readonly editing = signal<MeetingDto | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly copied = signal<string | null>(null);

  fTitle = '';
  fType = 'screening';
  fDate = '';
  fTime = '';
  fDuration = 30;
  fTimezone = 'Africa/Tunis';
  fLanguage = 'fr';
  fDescription = '';
  pEmail = '';
  pName = '';
  pRole: 'recruiter' | 'candidate' = 'recruiter';

  // ── Confirmation annulation ──
  readonly cancelling = signal<MeetingDto | null>(null);
  readonly cancelBusy = signal(false);

  readonly isStaff = computed(() =>
    ['admin', 'agent', 'director', 'recruiter'].includes(this.auth.user()?.role ?? '')
  );
  readonly isAdmin = computed(() => this.auth.user()?.role === 'admin');

  readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const st = this.statusFilter();
    const now = Date.now();
    return this.items().filter((m) => {
      if (st && m.status !== st) return false;
      if (this.period() === 'upcoming' && new Date(m.scheduledAt).getTime() < now - 3600000) return false;
      if (this.period() === 'history' && new Date(m.scheduledAt).getTime() >= now) return false;
      if (q) {
        const hay = `${m.title} ${m.createdByName ?? ''} ${(m.participants || [])
          .map((p) => `${p.name} ${p.email}`)
          .join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  });

  readonly sorted = computed(() => {
    const arr = [...this.filtered()];
    if (this.period() === 'history') {
      return arr.sort((a, b) => +new Date(b.scheduledAt) - +new Date(a.scheduledAt));
    }
    return arr.sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt));
  });

  readonly stats = computed(() => {
    const all = this.items();
    const today = new Date().toDateString();
    const now = Date.now();
    return {
      upcoming: all.filter((m) => new Date(m.scheduledAt).getTime() >= now && !['CANCELLED', 'ARCHIVED', 'ENDED'].includes(m.status)).length,
      today: all.filter((m) => new Date(m.scheduledAt).toDateString() === today && m.status !== 'CANCELLED').length,
      live: all.filter((m) => m.status === 'IN_PROGRESS').length,
      ended: all.filter((m) => m.status === 'ENDED').length,
      cancelled: all.filter((m) => m.status === 'CANCELLED').length,
    };
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    const from = new Date();
    const to = new Date();
    if (this.period() === 'upcoming') {
      to.setDate(to.getDate() + 90);
    } else if (this.period() === 'history') {
      from.setDate(from.getDate() - 180);
    } else {
      from.setDate(from.getDate() - 180);
      to.setDate(to.getDate() + 90);
    }
    this.api.list(from, to, { scope: this.scope() }).subscribe({
      next: (r) => {
        this.items.set(r.items);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Impossible de charger les réunions.');
        this.loading.set(false);
      },
    });
  }

  setPeriod(p: PeriodTab): void {
    this.period.set(p);
    this.load();
  }

  setScope(s: Scope): void {
    this.scope.set(s);
    this.load();
  }

  typeDef(t: string) {
    return TYPE_DEFS.find((d) => d.value === t) ?? { value: t, label: t, color: '#64748b' };
  }

  statusDef(s: string) {
    return STATUS_DEFS[s] ?? { label: s, color: '#475569', bg: '#f1f5f9' };
  }

  isLiveNow(m: MeetingDto): boolean {
    const start = +new Date(m.scheduledAt);
    const end = start + m.durationMin * 60000;
    return Date.now() >= start - 900000 && Date.now() <= end && !['ENDED', 'ARCHIVED', 'CANCELLED'].includes(m.status);
  }

  canManage(m: MeetingDto): boolean {
    return this.isAdmin() || m.createdByAgentId === this.auth.user()?.id;
  }

  isPast(m: MeetingDto): boolean {
    return +new Date(m.scheduledAt) < Date.now() - 3600000;
  }

  dayNum(m: MeetingDto): string {
    return String(new Date(m.scheduledAt).getDate()).padStart(2, '0');
  }

  monthShort(m: MeetingDto): string {
    return new Intl.DateTimeFormat('fr-FR', { month: 'short' }).format(new Date(m.scheduledAt)).replace('.', '');
  }

  timeOf(m: MeetingDto): string {
    return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(new Date(m.scheduledAt));
  }

  dateLong(m: MeetingDto): string {
    return new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(m.scheduledAt));
  }

  joinUrl(m: MeetingDto): string {
    return `${window.location.origin}/meetings/${m.id}/lobby`;
  }

  copyLink(m: MeetingDto, ev: Event): void {
    ev.stopPropagation();
    navigator.clipboard?.writeText(this.joinUrl(m));
    this.copied.set(m.id);
    setTimeout(() => this.copied.set(null), 1600);
  }

  // ── Édition ──

  openEdit(m: MeetingDto): void {
    this.editing.set(m);
    const d = new Date(m.scheduledAt);
    this.fTitle = m.title;
    this.fType = m.type;
    this.fDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    this.fTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    this.fDuration = m.durationMin;
    this.fTimezone = m.timezone || 'Africa/Tunis';
    this.fLanguage = m.language || 'fr';
    this.fDescription = m.description || '';
    this.pEmail = '';
    this.pName = '';
    this.formError.set(null);
  }

  closeEdit(): void {
    this.editing.set(null);
  }

  saveEdit(): void {
    const m = this.editing();
    if (!m) return;
    if (!this.fTitle.trim()) {
      this.formError.set('Le titre est requis.');
      return;
    }
    if (!this.fDate) {
      this.formError.set('La date est requise.');
      return;
    }
    const [y, mo, d] = this.fDate.split('-').map(Number);
    const [h, mi] = (this.fTime || '09:00').split(':').map(Number);
    const scheduledAt = new Date(y, mo - 1, d, h, mi).toISOString();
    this.saving.set(true);
    this.formError.set(null);
    this.api
      .update(m.id, {
        title: this.fTitle.trim(),
        type: this.fType,
        scheduledAt,
        durationMin: this.fDuration,
        timezone: this.fTimezone,
        language: this.fLanguage,
        description: this.fDescription,
      })
      .subscribe({
        next: (r) => {
          this.items.update((arr) => arr.map((x) => (x.id === m.id ? r.meeting : x)));
          this.saving.set(false);
          this.editing.set(null);
        },
        error: (e) => {
          this.formError.set(e?.error?.message || 'Enregistrement impossible.');
          this.saving.set(false);
        },
      });
  }

  // ── Participants ──

  addParticipant(m: MeetingDto): void {
    if (!this.pEmail.trim()) return;
    this.api
      .addParticipant(m.id, { email: this.pEmail.trim(), name: this.pName.trim(), role: this.pRole })
      .subscribe({
        next: (r) => {
          this.editing.set(r.meeting);
          this.items.update((arr) => arr.map((x) => (x.id === m.id ? r.meeting : x)));
          this.pEmail = '';
          this.pName = '';
        },
        error: (e) => this.formError.set(e?.error?.message || 'Ajout impossible.'),
      });
  }

  removeParticipant(m: MeetingDto, p: MeetingParticipantDto): void {
    if (!p.email) return;
    this.api.removeParticipant(m.id, p.email).subscribe({
      next: (r) => {
        this.editing.set(r.meeting);
        this.items.update((arr) => arr.map((x) => (x.id === m.id ? r.meeting : x)));
      },
      error: (e) => this.formError.set(e?.error?.message || 'Suppression impossible.'),
    });
  }

  // ── Statut ──

  askCancel(m: MeetingDto): void {
    this.cancelling.set(m);
  }

  confirmCancel(): void {
    const m = this.cancelling();
    if (!m) return;
    this.cancelBusy.set(true);
    this.api.patchStatus(m.id, 'CANCELLED').subscribe({
      next: (r) => {
        this.items.update((arr) => arr.map((x) => (x.id === m.id ? r.meeting : x)));
        this.cancelBusy.set(false);
        this.cancelling.set(null);
      },
      error: () => this.cancelBusy.set(false),
    });
  }

  setStatus(m: MeetingDto, status: string): void {
    this.api.patchStatus(m.id, status).subscribe({
      next: (r) => this.items.update((arr) => arr.map((x) => (x.id === m.id ? r.meeting : x))),
    });
  }
}
