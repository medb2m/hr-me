import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MeetingsApiService } from '../../../../core/services/meetings-api.service';
import { CalendarApiService } from '../../../../core/services/calendar-api.service';
import type { MeetingParticipantDto } from '../../../../core/models/hr-me-realtime.models';

@Component({
  selector: 'app-meeting-new',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './meeting-new.component.html',
  styleUrl: './meeting-new.component.scss',
})
export class MeetingNewComponent {
  private readonly fb = inject(FormBuilder);
  private readonly meetingsApi = inject(MeetingsApiService);
  private readonly calendarApi = inject(CalendarApiService);
  private readonly router = inject(Router);

  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly conflictWarning = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    title: ['Entretien de présélection', [Validators.required, Validators.maxLength(300)]],
    type: ['screening'],
    scheduledAtLocal: ['', Validators.required],
    durationMin: [30, [Validators.required, Validators.min(5), Validators.max(480)]],
    timezone: ['Africa/Tunis'],
    language: ['fr'],
    description: [''],
    inviteRows: this.fb.array([this.buildInviteGroup()]),
  });

  get inviteRows(): FormArray {
    return this.form.controls.inviteRows;
  }

  private buildInviteGroup(): FormGroup {
    return this.fb.group({
      email: [''],
      name: [''],
      role: this.fb.nonNullable.control<'recruiter' | 'candidate'>('recruiter'),
      userId: [''],
    });
  }

  addInviteRow(): void {
    this.inviteRows.push(this.buildInviteGroup());
  }

  removeInviteRow(index: number): void {
    if (this.inviteRows.length <= 1) {
      return;
    }
    this.inviteRows.removeAt(index);
  }

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
    const scheduledAt = new Date(raw.scheduledAtLocal);
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
    for (const r of rows || []) {
      const email = (r.email || '').trim().toLowerCase();
      if (!email) {
        continue;
      }
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
