import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  LucideDownload,
  LucideFileText,
  LucideLoaderCircle,
  LucidePenLine,
  LucidePlus,
  LucideSearch,
  LucideTrash2,
} from '@lucide/angular';
import { BackButtonComponent } from '../../../../shared/components/back-button/back-button.component';
import { finalize } from 'rxjs/operators';
import { ClientCvApiService, ClientCvDto } from '../../services/client-cv-api.service';
import { createDefaultCvEditorState } from '../../models/cv-editor-state';

@Component({
  selector: 'app-client-cv-hub',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    BackButtonComponent,
    LucideDownload,
    LucideFileText,
    LucideLoaderCircle,
    LucidePenLine,
    LucidePlus,
    LucideSearch,
    LucideTrash2,
  ],
  templateUrl: './client-cv-hub.component.html',
  styleUrl: './client-cv-hub.component.css',
})
export class ClientCvHubComponent implements OnInit {
  private readonly api = inject(ClientCvApiService);
  private readonly router = inject(Router);

  cvs: ClientCvDto[] = [];
  loading = true;
  loadError = '';
  search = '';

  newName = '';
  newJobTitle = '';
  creating = false;
  createError = '';
  readonly downloadingIds = new Set<string>();

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading = true;
    this.loadError = '';
    this.api
      .listCvs()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: ({ cvs }) => {
          this.cvs = cvs ?? [];
        },
        error: () => {
          this.loadError = 'Impossible de charger la liste des CV.';
        },
      });
  }

  createCv(): void {
    const name = this.newName.trim();
    if (name.length < 2) {
      this.createError = 'Indiquez un nom d’au moins 2 caractères.';
      return;
    }
    this.creating = true;
    this.createError = '';
    const editorState = createDefaultCvEditorState();
    editorState.jobTitle = this.newJobTitle.trim();
    this.api
      .createCv({ name, editorState })
      .pipe(finalize(() => (this.creating = false)))
      .subscribe({
        next: ({ cv }) => {
          this.newName = '';
          this.newJobTitle = '';
          void this.router.navigate(['/candidat/editor/cv', cv._id]);
        },
        error: (err: { error?: { message?: string } }) => {
          this.createError = err.error?.message || 'Création impossible.';
        },
      });
  }

  /** Titre du CV (poste visé) enregistré dans `editorState`. */
  cvJobTitle(cv: ClientCvDto): string {
    const t = cv.editorState?.['jobTitle'];
    return typeof t === 'string' ? t.trim() : '';
  }

  /** CV filtrés par la recherche (nom + poste visé). */
  get filtered(): ClientCvDto[] {
    const q = this.search.trim().toLowerCase();
    if (!q) {
      return this.cvs;
    }
    return this.cvs.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || this.cvJobTitle(c).toLowerCase().includes(q),
    );
  }

  /** Téléchargement du PDF (rendu feuille généré côté serveur). */
  downloadPdf(ev: MouseEvent, cv: ClientCvDto): void {
    ev.preventDefault();
    if (this.downloadingIds.has(cv._id)) {
      return;
    }
    this.downloadingIds.add(cv._id);
    this.api
      .downloadPdf(cv._id)
      .pipe(finalize(() => this.downloadingIds.delete(cv._id)))
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `CV - ${cv.name || 'document'}.pdf`;
          a.click();
          URL.revokeObjectURL(url);
        },
        error: () => {
          alert('Export PDF impossible pour le moment.');
        },
      });
  }

  deleteCv(ev: MouseEvent, cv: ClientCvDto): void {
    ev.preventDefault();
    if (!confirm(`Supprimer le CV « ${cv.name} » ?`)) {
      return;
    }
    this.api.deleteCv(cv._id).subscribe({
      next: () => {
        this.cvs = this.cvs.filter((c) => c._id !== cv._id);
      },
      error: () => {
        alert('Suppression impossible.');
      },
    });
  }
}
