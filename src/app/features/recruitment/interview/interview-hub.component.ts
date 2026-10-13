import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  LucideBot,
  LucideCalendarClock,
  LucideCheckCircle2,
  LucideClipboardCopy,
  LucideClock,
  LucideFileText,
  LucideLayers,
  LucideListChecks,
  LucideLoader2,
  LucidePlay,
  LucidePlus,
  LucideSparkles,
  LucideStar,
  LucideTrash2,
  LucideUser,
  LucideX,
} from '@lucide/angular';
import {
  InterviewSessionListItem,
  InterviewTemplate,
} from '../../../models/interview-session';
import { InterviewService } from '../../../services/interview.service';

type HubTab = 'sessions' | 'create' | 'templates' | 'demo';

@Component({
  selector: 'app-interview-hub',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    LucideBot,
    LucideCalendarClock,
    LucideCheckCircle2,
    LucideClipboardCopy,
    LucideClock,
    LucideFileText,
    LucideLayers,
    LucideListChecks,
    LucideLoader2,
    LucidePlay,
    LucidePlus,
    LucideSparkles,
    LucideStar,
    LucideTrash2,
    LucideUser,
    LucideX,
  ],
  providers: [DatePipe],
  templateUrl: './interview-hub.component.html',
  styleUrl: './interview-hub.component.css',
})
export class InterviewHubComponent implements OnInit {
  private readonly interviewService = inject(InterviewService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly datePipe = inject(DatePipe);

  readonly tab = signal<HubTab>('sessions');

  // ── Sessions ──
  readonly sessions = signal<InterviewSessionListItem[]>([]);
  readonly sessionsLoading = signal(false);
  readonly statusFilter = signal<string>('');
  readonly templateFilter = signal<string>('');
  readonly sortBy = signal<string>('recent');
  readonly evaluationFor = signal<InterviewSessionListItem | null>(null);
  readonly evaluating = signal(false);
  readonly reviewEditing = signal<string | null>(null);
  readonly reviewScore = signal<number | null>(null);
  readonly reviewComment = signal('');

  // ── Création ──
  readonly createForm = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(140)]],
    assigneeName: ['', [Validators.maxLength(120)]],
    assigneeEmail: ['', [Validators.email, Validators.maxLength(190)]],
    scheduledAt: [''],
    deadlineHours: [48, [Validators.min(1), Validators.max(720)]],
    templateId: [''],
    topics: [''],
    instructions: [''],
  });
  readonly creating = signal(false);
  readonly createError = signal<string | null>(null);
  readonly createdInviteUrl = signal<string | null>(null);

  // ── Templates ──
  readonly templates = signal<InterviewTemplate[]>([]);
  readonly templatesLoading = signal(false);
  readonly templateEditing = signal<InterviewTemplate | null>(null);
  readonly templateForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(80)]],
    title: ['', [Validators.required, Validators.maxLength(140)]],
    deadlineHours: [48, [Validators.min(1), Validators.max(720)]],
    topics: [''],
    instructions: [''],
  });
  readonly templateSaving = signal(false);
  readonly templateUsageFor = signal<InterviewTemplate | null>(null);

  // ── Démo ──
  readonly demoForm = this.fb.nonNullable.group({
    title: ['Screening technique', [Validators.required, Validators.maxLength(120)]],
    candidateName: ['', [Validators.maxLength(80)]],
  });
  readonly demoSubmitting = signal(false);
  readonly demoError = signal<string | null>(null);

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      const t = params.get('tab');
      if (t === 'create' || t === 'templates' || t === 'demo' || t === 'sessions') {
        this.tab.set(t);
      }
    });
    this.loadSessions();
    this.loadTemplates();
  }

  setTab(t: HubTab): void {
    this.tab.set(t);
    if (t === 'sessions') this.loadSessions();
    if (t === 'templates') this.loadTemplates();
  }

  // ───────────────────────────── Sessions ─────────────────────────────

  loadSessions(): void {
    this.sessionsLoading.set(true);
    this.interviewService
      .listSessions({
        status: this.statusFilter() || undefined,
        templateId: this.templateFilter() || undefined,
        sort: this.sortBy(),
        limit: 100,
      })
      .subscribe({
        next: (res) => {
          this.sessions.set(res.data || []);
          this.sessionsLoading.set(false);
        },
        error: () => this.sessionsLoading.set(false),
      });
  }

  onStatusFilter(v: string): void {
    this.statusFilter.set(v);
    this.loadSessions();
  }
  onTemplateFilter(v: string): void {
    this.templateFilter.set(v);
    this.loadSessions();
  }
  onSort(v: string): void {
    this.sortBy.set(v);
    this.loadSessions();
  }

  templateName(s: InterviewSessionListItem): string {
    const t = s.templateId;
    if (t && typeof t === 'object' && 'name' in t) return t.name;
    return '';
  }

  statusLabel(s: InterviewSessionListItem): string {
    switch (s.status) {
      case 'pending': return 'À passer';
      case 'in_progress': return 'En cours';
      case 'completed': return 'Terminé';
      case 'expired': return 'Expiré';
      default: return s.status;
    }
  }

  deadlineLabel(s: InterviewSessionListItem): string {
    if (s.expiresAt) {
      const d = new Date(s.expiresAt);
      if (d.getTime() < Date.now() && s.status !== 'completed') return 'Délai dépassé';
      return `avant ${this.datePipe.transform(d, 'dd MMM, HH:mm')}`;
    }
    if (s.deadlineHours) return `${s.deadlineHours} h pour le passer`;
    return '—';
  }

  fmtDate(v?: string | null): string {
    if (!v) return '—';
    return this.datePipe.transform(v, 'dd MMM yyyy, HH:mm') ?? '—';
  }

  passUrl(s: InterviewSessionListItem): string {
    return `${window.location.origin}/interview/pass/${s.inviteToken}`;
  }

  copyInvite(s: InterviewSessionListItem): void {
    void navigator.clipboard?.writeText(this.passUrl(s));
  }

  copyText(v: string): void {
    void navigator.clipboard?.writeText(v);
  }

  /** Bouton « Résumé » : génère puis affiche l'évaluation IA. */
  openEvaluation(s: InterviewSessionListItem): void {
    this.evaluationFor.set(s);
    if (s.evaluation?.summary) return;
    this.evaluating.set(true);
    this.interviewService.evaluateSession(s._id).subscribe({
      next: (res) => {
        s.evaluation = res.data;
        this.sessions.update((list) =>
          list.map((x) => (x._id === s._id ? { ...x, evaluation: res.data } : x))
        );
        this.evaluating.set(false);
      },
      error: () => this.evaluating.set(false),
    });
  }

  closeEvaluation(): void {
    this.evaluationFor.set(null);
    this.evaluating.set(false);
  }

  startReview(s: InterviewSessionListItem): void {
    this.reviewEditing.set(s._id);
    this.reviewScore.set(s.review?.score ?? null);
    this.reviewComment.set(s.review?.comment ?? '');
  }

  saveReview(s: InterviewSessionListItem): void {
    this.interviewService
      .reviewSession(s._id, { score: this.reviewScore(), comment: this.reviewComment() })
      .subscribe({
        next: (res) => {
          this.sessions.update((list) =>
            list.map((x) => (x._id === s._id ? { ...x, review: res.data.review } : x))
          );
          this.reviewEditing.set(null);
        },
        error: () => this.reviewEditing.set(null),
      });
  }

  // ───────────────────────────── Création ─────────────────────────────

  create(): void {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }
    this.creating.set(true);
    this.createError.set(null);
    this.createdInviteUrl.set(null);
    const v = this.createForm.getRawValue();
    this.interviewService
      .createSession({
        title: v.title.trim(),
        assigneeName: v.assigneeName.trim(),
        assigneeEmail: v.assigneeEmail.trim(),
        scheduledAt: v.scheduledAt || null,
        deadlineHours: v.deadlineHours || null,
        templateId: v.templateId || null,
        topics: v.topics.split('\n').map((t) => t.trim()).filter(Boolean),
        instructions: v.instructions.trim(),
      })
      .subscribe({
        next: (res) => {
          this.creating.set(false);
          this.createdInviteUrl.set(
            `${window.location.origin}/interview/pass/${res.data.inviteToken}`
          );
          this.createForm.reset({
            title: '',
            assigneeName: '',
            assigneeEmail: '',
            scheduledAt: '',
            deadlineHours: 48,
            templateId: '',
            topics: '',
            instructions: '',
          });
          this.loadSessions();
        },
        error: (err) => {
          this.creating.set(false);
          this.createError.set(err?.error?.message || 'Création impossible.');
        },
      });
  }

  /** Remplit le formulaire avec le contenu d'un template. */
  applyTemplate(id: string): void {
    const t = this.templates().find((x) => x._id === id);
    if (!t) return;
    this.createForm.patchValue({
      title: t.title,
      deadlineHours: t.deadlineHours || 48,
      topics: t.topics.join('\n'),
      instructions: t.instructions,
    });
  }

  // ───────────────────────────── Templates ─────────────────────────────

  loadTemplates(): void {
    this.templatesLoading.set(true);
    this.interviewService.listTemplates().subscribe({
      next: (res) => {
        this.templates.set(res.data || []);
        this.templatesLoading.set(false);
      },
      error: () => this.templatesLoading.set(false),
    });
  }

  editTemplate(t: InterviewTemplate): void {
    this.templateEditing.set(t);
    this.templateForm.setValue({
      name: t.name,
      title: t.title,
      deadlineHours: t.deadlineHours || 48,
      topics: t.topics.join('\n'),
      instructions: t.instructions || '',
    });
  }

  resetTemplateForm(): void {
    this.templateEditing.set(null);
    this.templateForm.reset({
      name: '',
      title: '',
      deadlineHours: 48,
      topics: '',
      instructions: '',
    });
  }

  saveTemplate(): void {
    if (this.templateForm.invalid) {
      this.templateForm.markAllAsTouched();
      return;
    }
    this.templateSaving.set(true);
    const v = this.templateForm.getRawValue();
    const body = {
      name: v.name.trim(),
      title: v.title.trim(),
      deadlineHours: v.deadlineHours || 48,
      topics: v.topics.split('\n').map((t) => t.trim()).filter(Boolean),
      instructions: v.instructions.trim(),
    };
    const obs = this.templateEditing()
      ? this.interviewService.updateTemplate(this.templateEditing()!._id, body)
      : this.interviewService.createTemplate(body);
    obs.subscribe({
      next: () => {
        this.templateSaving.set(false);
        this.resetTemplateForm();
        this.loadTemplates();
      },
      error: () => this.templateSaving.set(false),
    });
  }

  removeTemplate(t: InterviewTemplate): void {
    if (!confirm(`Supprimer le modèle « ${t.name} » ?`)) return;
    this.interviewService.deleteTemplate(t._id).subscribe(() => this.loadTemplates());
  }

  /** Liste des personnes ayant passé un template (réutilise le filtre sessions). */
  showUsage(t: InterviewTemplate): void {
    this.templateUsageFor.set(t);
    this.templateFilter.set(t._id);
    this.statusFilter.set('');
    this.tab.set('sessions');
    this.loadSessions();
  }

  useTemplate(t: InterviewTemplate): void {
    this.createForm.patchValue({ templateId: t._id });
    this.applyTemplate(t._id);
    this.tab.set('create');
  }

  // ───────────────────────────── Démo ─────────────────────────────

  createDemo(): void {
    if (this.demoForm.invalid) {
      this.demoForm.markAllAsTouched();
      return;
    }
    this.demoSubmitting.set(true);
    this.demoError.set(null);
    this.interviewService
      .createSession({
        title: this.demoForm.controls.title.getRawValue().trim(),
        candidateName: this.demoForm.controls.candidateName.getRawValue().trim(),
        isDemo: true,
      })
      .subscribe({
        next: (res) => {
          this.demoSubmitting.set(false);
          void this.router.navigate(['/recruitment/interview/room', res.data._id]);
        },
        error: (err) => {
          this.demoSubmitting.set(false);
          this.demoError.set(err?.error?.message || 'Impossible de démarrer la démo.');
        },
      });
  }
}
