import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { CdkDrag, CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import {
  LucideGripVertical,
  LucideInfo,
  LucideLoaderCircle,
  LucidePlus,
  LucideSearch,
  LucideUserPlus,
  LucideUsers,
  LucideVideo,
  LucideX,
} from '@lucide/angular';
import { BackButtonComponent } from '../../../../shared/components/back-button/back-button.component';
import { DatePickerComponent } from '../../../../shared/components/date-picker/date-picker.component';
import { TimePickerComponent } from '../../../../shared/components/time-picker/time-picker.component';
import { MeetingsApiService } from '../../../../core/services/meetings-api.service';
import { CalendarApiService } from '../../../../core/services/calendar-api.service';
import type { MeetingParticipantDto } from '../../../../core/models/hr-me-realtime.models';

interface PanelUser {
  id: string | null;
  name: string;
  email: string;
  role?: string;
  avatarUrl?: string;
}

const TYPE_CHIPS = [
  { value: 'general', label: 'Générale', color: '#64748b' },
  { value: 'team', label: 'Équipe', color: '#22c55e' },
  { value: 'partner', label: 'Partenaire', color: '#06b6d4' },
  { value: 'client', label: 'Client', color: '#ec4899' },
  { value: 'screening', label: 'Présélection', color: '#0ea5e9' },
  { value: 'technical', label: 'Technique', color: '#8b5cf6' },
  { value: 'final', label: 'Finale', color: '#eab308' },
  { value: 'ai_automated', label: 'IA automatisée', color: '#f97316' },
];

const DURATIONS = [15, 20, 30, 45, 60, 90, 120];

/** Fonctions Teams/Meet prévues — statique en attente de validation. */
const ROADMAP = [
  'Enregistrement de la réunion',
  'Transcription & résumé IA',
  'Lever la main',
  'Réactions en direct',
  'Arrière-plan flou / virtuel',
  'Salles de sous-commission',
  'Sondages pendant la réunion',
  'Notes partagées',
  "Salle d'attente & admission",
  'Verrouillage de la réunion',
  'RSVP (accepté / décliné)',
  'Récurrence hebdomadaire',
];

@Component({
  selector: 'app-meeting-new',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    BackButtonComponent,
    DatePickerComponent,
    TimePickerComponent,
    CdkDrag,
    CdkDropList,
    LucideGripVertical,
    LucideInfo,
    LucideLoaderCircle,
    LucidePlus,
    LucideSearch,
    LucideUserPlus,
    LucideUsers,
    LucideVideo,
    LucideX,
  ],
  templateUrl: './meeting-new.component.html',
  styleUrl: './meeting-new.component.scss',
})
export class MeetingNewComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly meetingsApi = inject(MeetingsApiService);
  private readonly calendarApi = inject(CalendarApiService);
  private readonly router = inject(Router);

  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly conflictWarning = signal<string | null>(null);

  readonly typeChips = TYPE_CHIPS;
  readonly durations = DURATIONS;
  readonly roadmap = ROADMAP;

  // ── Panneau utilisateurs ──
  readonly recentUsers = signal<PanelUser[]>([]);
  readonly searchResults = signal<PanelUser[]>([]);
  readonly userQuery = signal('');
  readonly searching = signal(false);
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  readonly form = this.fb.nonNullable.group({
    title: ['Nouvelle réunion', [Validators.required, Validators.maxLength(300)]],
    type: ['general'],
    date: ['', Validators.required],
    time: ['09:00'],
    durationMin: [30, [Validators.required, Validators.min(5), Validators.max(480)]],
    timezone: ['Africa/Tunis'],
    language: ['fr'],
    description: [''],
    inviteRows: this.fb.array<FormGroup>([]),
  });

  get inviteRows(): FormArray {
    return this.form.controls.inviteRows;
  }

  ngOnInit(): void {
    this.meetingsApi.recentParticipants().subscribe({
      next: (r) => this.recentUsers.set(r.items),
      error: () => {},
    });
  }

  // ── Recherche utilisateurs ──

  onUserQuery(q: string): void {
    this.userQuery.set(q);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    const query = q.trim();
    if (!query) {
      this.searchResults.set([]);
      return;
    }
    this.searchTimer = setTimeout(() => {
      this.searching.set(true);
      this.calendarApi.attendees(query).subscribe({
        next: (r) => {
          this.searchResults.set(
            r.attendees.map((a) => ({ id: a.id, name: a.name, email: a.email, role: a.role, avatarUrl: a.avatarUrl }))
          );
          this.searching.set(false);
        },
        error: () => this.searching.set(false),
      });
    }, 250);
  }

  panelUsers(): PanelUser[] {
    return this.userQuery().trim() ? this.searchResults() : this.recentUsers();
  }

  // ── Drag & drop ──

  onUserDrop(ev: CdkDragDrop<unknown>): void {
    const u = ev.item.data as PanelUser | undefined;
    if (u?.email) {
      this.addInviteRow(u);
    }
  }

  /** Prédicat : on n'accepte le drop que si l'email n'est pas déjà invité. */
  inviteDropPredicate = (drag: CdkDrag<PanelUser>): boolean => {
    const email = drag.data?.email?.toLowerCase();
    return Boolean(email) && !this.inviteRows.controls.some((c) => (c.get('email')?.value || '').toLowerCase() === email);
  };

  addInviteRow(u?: PanelUser): void {
    this.inviteRows.push(
      this.fb.group({
        email: [u?.email ?? ''],
        name: [u?.name ?? ''],
        role: this.fb.nonNullable.control<'recruiter' | 'candidate'>(
          u?.role === 'candidate' ? 'candidate' : 'recruiter'
        ),
        userId: [u?.id ?? ''],
        avatarUrl: [u?.avatarUrl ?? ''],
      })
    );
  }

  removeInviteRow(index: number): void {
    this.inviteRows.removeAt(index);
  }

  initials(name: string): string {
    return (name || '?')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('');
  }

  // ── Soumission ──

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    for (const row of raw.inviteRows || []) {
      const r = row as Record<string, string | undefined>;
      const e = (r['email'] || '').trim();
      if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
        this.error.set(`E-mail invalide : ${e}`);
        return;
      }
    }
    const [y, mo, d] = String(raw.date).split('-').map(Number);
    const [hh, mm] = String(raw.time || '09:00').split(':').map(Number);
    const scheduledAt = new Date(y, (mo || 1) - 1, d || 1, hh || 0, mm || 0);
    if (Number.isNaN(scheduledAt.getTime())) {
      this.error.set('Date / heure invalides.');
      return;
    }
    const endsAt = new Date(scheduledAt.getTime() + raw.durationMin * 60 * 1000);
    this.submitting.set(true);
    this.error.set(null);
    this.conflictWarning.set(null);

    const participants = this.buildParticipantsFromInvites(raw.inviteRows);

    const agentId =
      typeof localStorage !== 'undefined' ? JSON.parse(localStorage.getItem('authUser') || '{}')?.id : '';
    const check$ =
      agentId && typeof agentId === 'string'
        ? this.calendarApi.conflicts(agentId, scheduledAt, endsAt)
        : null;

    const proceed = (withConflictNote: string | null) => {
      if (withConflictNote) {
        this.conflictWarning.set(withConflictNote);
      }
      this.meetingsApi
        .create({
          title: raw.title.trim(),
          type: raw.type,
          scheduledAt: scheduledAt.toISOString(),
          durationMin: raw.durationMin,
          timezone: raw.timezone,
          language: raw.language as 'fr' | 'en' | 'ar' | 'it',
          description: raw.description.trim(),
          participants,
        })
        .subscribe({
          next: (res) => {
            this.submitting.set(false);
            void this.router.navigate(['/meetings', res.meeting.id, 'lobby']);
          },
          error: (err: { error?: { message?: string } }) => {
            this.submitting.set(false);
            this.error.set(err.error?.message || 'Création impossible.');
          },
        });
    };

    if (check$) {
      check$.subscribe({
        next: (r) => {
          const note =
            r.conflicts?.length > 0
              ? `Attention : ${r.conflicts.length} événement(s) chevauch(e)ent ce créneau.`
              : null;
          proceed(note);
        },
        error: () => proceed(null),
      });
    } else {
      proceed(null);
    }
  }

  private buildParticipantsFromInvites(
    rows: Array<{ email?: string; name?: string; role?: string; userId?: string }>
  ): MeetingParticipantDto[] {
    const out: MeetingParticipantDto[] = [];
    const seen = new Set<string>();
    for (const r of rows || []) {
      const email = (r.email || '').trim().toLowerCase();
      if (!email || seen.has(email)) {
        continue;
      }
      seen.add(email);
      const uid = (r.userId || '').trim();
      const p: MeetingParticipantDto = {
        email,
        name: (r.name || '').trim(),
        role: r.role === 'candidate' ? 'candidate' : 'recruiter',
      };
      if (/^[a-f\d]{24}$/i.test(uid)) {
        p.userId = uid;
      }
      out.push(p);
    }
    return out;
  }
}
