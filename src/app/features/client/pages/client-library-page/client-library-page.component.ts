import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import {
  LucideAward,
  LucideFileText,
  LucideGraduationCap,
  LucidePaperclip,
  LucideTrash2,
  LucideUpload,
  LucideX,
} from '@lucide/angular';
import { BackButtonComponent } from '../../../../shared/components/back-button/back-button.component';
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

@Component({
  selector: 'app-client-library-page',
  imports: [
    CommonModule,
    FormsModule,
    BackButtonComponent,
    LucideAward,
    LucideFileText,
    LucideGraduationCap,
    LucidePaperclip,
    LucideTrash2,
    LucideUpload,
    LucideX,
  ],
  templateUrl: './client-library-page.component.html',
  styleUrl: './client-library-page.component.css',
})
export class ClientLibraryPageComponent implements OnInit {
  private readonly api = inject(ClientDocumentsApiService);

  documents: ClientDocumentDto[] = [];
  loading = false;
  errorMsg = '';

  // upload
  pickKind: ClientDocKind = 'diploma';
  pickName = '';
  pickFile: File | null = null;
  uploading = false;
  uploadError = '';
  confirmDeleteId = '';
  deletingId = '';

  readonly kindLabels = KIND_LABELS;
  readonly kinds: ClientDocKind[] = ['diploma', 'certificate', 'other'];

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.api
      .list()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: ({ documents }) => {
          this.documents = documents;
        },
        error: () => {
          this.errorMsg = 'Impossible de charger tes documents.';
        },
      });
  }

  onFilePick(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    this.pickFile = input.files?.[0] || null;
    input.value = '';
  }

  submit(): void {
    if (!this.pickFile || this.uploading) return;
    this.uploadError = '';
    this.uploading = true;
    this.api
      .upload(this.pickFile, this.pickKind, this.pickName)
      .pipe(finalize(() => (this.uploading = false)))
      .subscribe({
        next: ({ document }) => {
          this.documents = [document, ...this.documents];
          this.pickFile = null;
          this.pickName = '';
          this.pickKind = 'diploma';
        },
        error: (err) => {
          this.uploadError = err?.error?.message || 'Upload impossible pour le moment.';
        },
      });
  }

  askDelete(d: ClientDocumentDto): void {
    this.confirmDeleteId = this.confirmDeleteId === d.id ? '' : d.id;
  }

  doDelete(d: ClientDocumentDto): void {
    if (this.deletingId) return;
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
