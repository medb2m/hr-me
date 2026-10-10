import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import {
  LucideArrowLeft,
  LucideBriefcase,
  LucideCheckCircle,
  LucideClock,
  LucideEye,
  LucideFileText,
  LucideGraduationCap,
  LucideLanguages,
  LucideMail,
  LucideMapPin,
  LucideMessageSquare,
  LucidePaperclip,
  LucidePhone,
  LucideSend,
  LucideTimer,
  LucideUserCheck,
  LucideWrench,
  LucideX,
  LucideXCircle,
} from '@lucide/angular';
import {
  AdminApplication,
  AdminAppStatus,
  AdminApplicationsApiService,
  AppSource,
} from '../../services/admin-applications-api.service';
import { CvPreviewComponent } from '../../../../shared/components/cv-preview/cv-preview.component';
import { ClPreviewComponent } from '../../../../shared/components/cl-preview/cl-preview.component';
import { CvEditorState, mergeCvEditorState } from '../../../client/models/cv-editor-state';
import { ClEditorState, mergeClEditorState } from '../../../client/models/cl-editor-state';

const STATUS_META: Record<AdminAppStatus, { label: string; cls: string }> = {
  pending: { label: 'Envoyée', cls: 'pending' },
  review: { label: 'En révision', cls: 'review' },
  accepted: { label: 'Acceptée', cls: 'accepted' },
  rejected: { label: 'Refusée', cls: 'rejected' },
};

const SOURCE_META: Record<AppSource, string> = {
  candidate: 'Candidat',
  client: 'Client',
  agent: 'Agent RH',
};

@Component({
  selector: 'app-admin-applicant',
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    CvPreviewComponent,
    ClPreviewComponent,
    LucideArrowLeft,
    LucideBriefcase,
    LucideCheckCircle,
    LucideClock,
    LucideEye,
    LucideFileText,
    LucideGraduationCap,
    LucideLanguages,
    LucideMail,
    LucideMapPin,
    LucideMessageSquare,
    LucidePaperclip,
    LucidePhone,
    LucideSend,
    LucideTimer,
    LucideUserCheck,
    LucideWrench,
    LucideX,
    LucideXCircle,
  ],
  templateUrl: './admin-applicant.component.html',
  styleUrl: './admin-applicant.component.css',
})
export class AdminApplicantComponent implements OnInit {
  private readonly api = inject(AdminApplicationsApiService);
  private readonly route = inject(ActivatedRoute);

  app: AdminApplication | null = null;
  loading = false;
  errorMsg = '';
  saving = false;
  noteSaving = false;
  noteSaved = false;
  notes = '';
  cvPreviewOpen = false;
  clPreviewOpen = false;

  /** `editorState` fusionné du CV partagé — pour `app-cv-preview`. */
  sharedCvState(): CvEditorState {
    return mergeCvEditorState(this.app?.sharedCvDoc?.editorState);
  }

  /** Photo du CV : dédiée au CV si « custom », sinon photo du dossier. */
  sharedCvPhoto(): string | null {
    const doc = this.app?.sharedCvDoc;
    if (!doc) return null;
    if (doc.photoSource === 'custom' && doc.customPhotoUrl) {
      return doc.customPhotoUrl;
    }
    return this.app?.profile?.photoUrl || this.app?.user?.avatarUrl || null;
  }

  /** `editorState` fusionné de la lettre partagée — pour `app-cl-preview`. */
  sharedClState(): ClEditorState {
    return mergeClEditorState(this.app?.sharedClDoc?.editorState);
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') || '';
    this.loading = true;
    this.api
      .get(id)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: ({ application }) => {
          this.app = application;
          this.notes = application.adminNotes || '';
        },
        error: () => {
          this.errorMsg = 'Candidature introuvable.';
        },
      });
  }

  setStatus(status: AdminAppStatus): void {
    if (!this.app || this.app.status === status || this.saving) return;
    this.saving = true;
    this.api
      .update(this.app.id, { status })
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: () => {
          if (this.app) this.app.status = status;
        },
        error: () => {
          this.errorMsg = 'Changement de statut impossible.';
        },
      });
  }

  saveNotes(): void {
    if (!this.app || this.noteSaving) return;
    this.noteSaving = true;
    this.noteSaved = false;
    this.api
      .update(this.app.id, { adminNotes: this.notes })
      .pipe(finalize(() => (this.noteSaving = false)))
      .subscribe({
        next: () => {
          this.noteSaved = true;
          setTimeout(() => (this.noteSaved = false), 2500);
        },
      });
  }

  offerExpired(): boolean {
    return !!this.app?.offer?.expired;
  }

  statusLabel(s: AdminAppStatus): string {
    return STATUS_META[s]?.label || s;
  }

  statusCls(s: AdminAppStatus): string {
    return STATUS_META[s]?.cls || 'pending';
  }

  sourceLabel(s: AppSource): string {
    return SOURCE_META[s] || s;
  }

  docKindLabel(k?: string): string {
    if (k === 'diploma') return 'Diplôme';
    if (k === 'certificate') return 'Certification';
    return 'Document';
  }

  displayName(): string {
    const a = this.app;
    if (!a) return '—';
    return a.applicantName || a.profile?.name || a.user?.name || a.user?.email || '—';
  }

  avatarUrl(): string {
    return this.app?.profile?.photoUrl || this.app?.user?.avatarUrl || '';
  }

  initials(): string {
    const n = this.displayName().trim();
    if (!n || n === '—') return '?';
    return n
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
  }

  fmtDate(d?: string | null): string {
    if (!d) return '—';
    const dt = new Date(d);
    return Number.isNaN(dt.getTime())
      ? '—'
      : dt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  fmtPeriod(current: boolean | undefined, start?: string | null, end?: string | null): string {
    const s = start ? this.fmtDate(start) : '…';
    const e = current ? 'Présent' : end ? this.fmtDate(end) : '…';
    return `${s} → ${e}`;
  }
}
