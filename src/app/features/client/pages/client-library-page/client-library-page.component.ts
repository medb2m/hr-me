import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import QRCode from 'qrcode';
import {
  LucideBuilding2,
  LucideCalendarDays,
  LucideCheck,
  LucideDownload,
  LucideEye,
  LucideFileText,
  LucideLoader2,
  LucidePencil,
  LucideSearch,
  LucideSparkles,
  LucideTrash2,
  LucideUpload,
  LucideX,
  LucideShieldCheck,
  LucideClock,
  LucideCopy,
} from '@lucide/angular';
import { BackButtonComponent } from '../../../../shared/components/back-button/back-button.component';
import { DocThumbComponent } from '../../components/doc-thumb/doc-thumb.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { FileViewerService } from '../../../../core/services/file-viewer.service';
import {
  VerificationsApiService,
  VerificationRequest,
} from '../../../../core/services/verifications-api.service';
import {
  ClientDocKind,
  ClientDocumentDto,
  ClientDocumentsApiService,
} from '../../services/client-documents-api.service';

const KIND_LABELS: Record<ClientDocKind, string> = {
  diploma: 'Diplôme',
  certificate: 'Certification',
  other: 'Autre',
};

/** Libellés FR des types détectés par l'IA. */
const AI_TYPE_LABELS: Record<string, string> = {
  diploma: 'Diplôme',
  certificate: 'Certification',
  attestation: 'Attestation',
  id: 'Pièce d’identité',
  cv: 'CV',
  contract: 'Contrat',
  other: 'Document',
};

const ACCEPT = '.pdf,.doc,.docx,.odt,.jpg,.jpeg,.png,.webp';
const MAX_BYTES = 10 * 1024 * 1024;

@Component({
  selector: 'app-client-library-page',
  imports: [
    CommonModule,
    FormsModule,
    BackButtonComponent,
    DocThumbComponent,
    LucideBuilding2,
    LucideCalendarDays,
    LucideCheck,
    LucideDownload,
    LucideEye,
    LucideFileText,
    LucideLoader2,
    LucidePencil,
    LucideSearch,
    LucideSparkles,
    LucideTrash2,
    LucideUpload,
    LucideX,
    LucideShieldCheck,
    LucideClock,
    LucideCopy,
    SelectComponent,
  ],
  templateUrl: './client-library-page.component.html',
  styleUrl: './client-library-page.component.css',
})
export class ClientLibraryPageComponent implements OnInit, OnDestroy {
  private readonly api = inject(ClientDocumentsApiService);
  private readonly vapi = inject(VerificationsApiService);
  private readonly viewer = inject(FileViewerService);

  readonly accept = ACCEPT;
  readonly kindLabels = KIND_LABELS;
  readonly kinds: ClientDocKind[] = ['diploma', 'certificate', 'other'];

  documents: ClientDocumentDto[] = [];
  loading = true;
  errorMsg = '';

  // Recherche + filtre type
  q = '';
  kindFilter: 'all' | ClientDocKind = 'all';

  // Upload
  pickKind: ClientDocKind = 'other'; // 'other' → l'IA suggère le bon type
  readonly pickKindOptions: SelectOption[] = [
    { value: 'other', label: 'Type automatique (IA)' },
    { value: 'diploma', label: 'Diplôme' },
    { value: 'certificate', label: 'Certification' },
    { value: 'other', label: 'Autre' },
  ];
  readonly kindOptions: SelectOption[] = [
    { value: 'diploma', label: 'Diplôme' },
    { value: 'certificate', label: 'Certification' },
    { value: 'other', label: 'Autre' },
  ];
  pickFile: File | null = null;
  dragOver = false;
  uploading = false;
  uploadError = '';
  confirmDeleteId = '';
  deletingId = '';

  // Modals
  editDoc: ClientDocumentDto | null = null;
  editName = '';
  editKind: ClientDocKind = 'other';
  editDescription = '';
  savingEdit = false;

  // Poll tant qu'un doc est en cours d'analyse IA
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private pollDeadline = 0;

  ngOnInit(): void {
    this.load();
    this.loadVerifs();
  }

  // ------------------------------------------------ Talent ID Passport
  verifs = new Map<string, VerificationRequest>();
  qrCache = new Map<string, string>();
  requestingId = '';

  loadVerifs(): void {
    this.vapi.mine().subscribe({
      next: ({ requests }) => {
        requests.forEach((r) => this.verifs.set(r.documentId, r));
        requests
          .filter((r) => r.status === 'approved' && r.token && !this.qrCache.has(r.id))
          .forEach((r) => {
            QRCode.toDataURL(this.verifyUrl(r), { width: 320, margin: 1 })
              .then((url) => this.qrCache.set(r.id, url));
          });
      },
    });
  }

  verifFor(d: { id: string }): VerificationRequest | undefined {
    return this.verifs.get(d.id);
  }

  requestVerif(d: { id: string }): void {
    if (this.requestingId) return;
    this.requestingId = d.id;
    this.vapi.request(d.id).subscribe({
      next: ({ request }) => {
        this.verifs.set(d.id, request);
        this.requestingId = '';
      },
      error: (e) => {
        this.requestingId = '';
        alert(e?.error?.message || 'Demande impossible.');
      },
    });
  }

  verifyUrl(r: VerificationRequest): string {
    return `${location.origin}/verify/${r.token}`;
  }

  copyVerifyUrl(r: VerificationRequest): void {
    void navigator.clipboard?.writeText(this.verifyUrl(r));
  }

  qrFor(r: VerificationRequest): string {
    return this.qrCache.get(r.id) || '';
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  load(): void {
    this.api.list().subscribe({
      next: ({ documents }) => {
        this.documents = documents;
        this.loading = false;
        this.schedulePolling();
      },
      error: () => {
        this.loading = false;
        this.errorMsg = 'Impossible de charger tes documents.';
      },
    });
  }

  /** true tant qu'au moins un document est en cours d'analyse IA. */
  hasAnalyzing(): boolean {
    return this.documents.some((d) => d.aiStatus === 'analyzing');
  }

  /** Relance la liste tant qu'une analyse IA est en cours (max ~45 s). */
  private schedulePolling(): void {
    this.stopPolling();
    if (!this.hasAnalyzing()) {
      return;
    }
    if (!this.pollDeadline) {
      this.pollDeadline = Date.now() + 45_000;
    }
    if (Date.now() > this.pollDeadline) {
      this.pollDeadline = 0;
      return;
    }
    this.pollTimer = setTimeout(() => this.load(), 3000);
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    this.pollDeadline = 0;
  }

  // ================= Upload =================

  onFilePick(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    this.setPickedFile(input.files?.[0] || null);
    input.value = '';
  }

  onDrop(ev: DragEvent): void {
    ev.preventDefault();
    this.dragOver = false;
    this.setPickedFile(ev.dataTransfer?.files?.[0] || null);
  }

  onDragOver(ev: DragEvent): void {
    ev.preventDefault();
    this.dragOver = true;
  }

  onDragLeave(): void {
    this.dragOver = false;
  }

  private setPickedFile(f: File | null): void {
    this.uploadError = '';
    if (!f) {
      this.pickFile = null;
      return;
    }
    if (f.size > MAX_BYTES) {
      this.uploadError = 'Fichier trop lourd (10 Mo max).';
      this.pickFile = null;
      return;
    }
    this.pickFile = f;
  }

  submit(): void {
    if (!this.pickFile || this.uploading) {
      return;
    }
    this.uploadError = '';
    this.uploading = true;
    this.api
      .upload(this.pickFile, this.pickKind)
      .pipe(finalize(() => (this.uploading = false)))
      .subscribe({
        next: ({ document }) => {
          this.documents = [document, ...this.documents];
          this.pickFile = null;
          this.pickKind = 'other';
          this.schedulePolling();
        },
        error: (err) => {
          this.uploadError = err?.error?.message || 'Upload impossible pour le moment.';
        },
      });
  }

  // ================= Liste =================

  filtered(): ClientDocumentDto[] {
    const query = this.q.trim().toLowerCase();
    return this.documents.filter((d) => {
      if (this.kindFilter !== 'all' && d.kind !== this.kindFilter) {
        return false;
      }
      if (!query) {
        return true;
      }
      const hay = [
        d.name,
        d.description,
        d.ai?.title,
        d.ai?.issuer,
        d.ai?.summary,
        ...(d.ai?.keywords || []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(query);
    });
  }

  /** Nom affiché : titre IA en priorité quand le nom est celui du fichier. */
  displayName(d: ClientDocumentDto): string {
    return d.name || d.ai?.title || 'Document';
  }

  aiTypeLabel(d: ClientDocumentDto): string {
    return AI_TYPE_LABELS[d.ai?.docType] || '';
  }

  hasAiDates(d: ClientDocumentDto): boolean {
    return !!(d.ai?.issueDate || d.ai?.expiryDate);
  }

  isPreviewable(d: ClientDocumentDto): boolean {
    return d.mime === 'application/pdf' || d.mime.startsWith('image/');
  }

  // ================= Modals =================

  /** Aperçu plein écran via la visionneuse partagée. */
  openPreview(d: ClientDocumentDto): void {
    this.viewer.open({ name: this.displayName(d), mime: d.mime, url: d.path });
  }

  openEdit(d: ClientDocumentDto): void {
    this.editDoc = d;
    this.editName = d.name;
    this.editKind = d.kind;
    this.editDescription = d.description || d.ai?.summary || '';
  }

  closeEdit(): void {
    this.editDoc = null;
    this.savingEdit = false;
  }

  saveEdit(): void {
    const d = this.editDoc;
    if (!d || this.savingEdit) {
      return;
    }
    this.savingEdit = true;
    this.api
      .update(d.id, {
        name: this.editName.trim(),
        kind: this.editKind,
        description: this.editDescription.trim(),
      })
      .pipe(finalize(() => (this.savingEdit = false)))
      .subscribe({
        next: ({ document }) => {
          this.documents = this.documents.map((x) => (x.id === d.id ? document : x));
          this.closeEdit();
        },
        error: (err) => {
          this.errorMsg = err?.error?.message || 'Mise à jour impossible.';
        },
      });
  }

  // ================= Suppression =================

  askDelete(d: ClientDocumentDto): void {
    this.confirmDeleteId = this.confirmDeleteId === d.id ? '' : d.id;
  }

  doDelete(d: ClientDocumentDto): void {
    if (this.deletingId) {
      return;
    }
    this.deletingId = d.id;
    this.api
      .delete(d.id)
      .pipe(
        finalize(() => {
          this.deletingId = '';
          this.confirmDeleteId = '';
        }),
      )
      .subscribe({
        next: () => {
          this.documents = this.documents.filter((x) => x.id !== d.id);
        },
        error: () => {
          this.errorMsg = 'Suppression impossible pour le moment.';
        },
      });
  }

  // ================= Helpers =================

  kindLabel(k: ClientDocKind): string {
    return KIND_LABELS[k] || 'Autre';
  }

  fmtSize(bytes: number): string {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  }

  fmtDate(d: string): string {
    const dt = new Date(d);
    return Number.isNaN(dt.getTime())
      ? ''
      : dt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  trackById(_i: number, d: ClientDocumentDto): string {
    return d.id;
  }
}
