import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  LucideMail,
  LucidePenLine,
  LucidePlus,
  LucideSearch,
  LucideTrash2,
} from '@lucide/angular';
import { BackButtonComponent } from '../../../../shared/components/back-button/back-button.component';
import { finalize } from 'rxjs/operators';
import { ClientClApiService, ClientClDto } from '../../services/client-cl-api.service';
import { createDefaultClEditorState } from '../../models/cl-editor-state';

@Component({
  selector: 'app-client-cl-hub',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    BackButtonComponent,
    LucideMail,
    LucidePenLine,
    LucidePlus,
    LucideSearch,
    LucideTrash2,
  ],
  templateUrl: './client-cl-hub.component.html',
  styleUrl: './client-cl-hub.component.css',
})
export class ClientClHubComponent implements OnInit {
  private readonly api = inject(ClientClApiService);
  private readonly router = inject(Router);

  cls: ClientClDto[] = [];
  loading = true;
  loadError = '';
  search = '';

  newName = '';
  newCompany = '';
  creating = false;
  createError = '';

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading = true;
    this.loadError = '';
    this.api
      .listCls()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: ({ cls }) => {
          this.cls = cls ?? [];
        },
        error: () => {
          this.loadError = 'Impossible de charger la liste des lettres.';
        },
      });
  }

  createCl(): void {
    const name = this.newName.trim();
    if (name.length < 2) {
      this.createError = 'Indiquez un nom d’au moins 2 caractères.';
      return;
    }
    this.creating = true;
    this.createError = '';
    const editorState = createDefaultClEditorState();
    editorState.companyName = this.newCompany.trim();
    this.api
      .createCl({ name, editorState })
      .pipe(finalize(() => (this.creating = false)))
      .subscribe({
        next: ({ cl }) => {
          this.newName = '';
          this.newCompany = '';
          void this.router.navigate(['/candidat/editor/cl', cl._id]);
        },
        error: (err: { error?: { message?: string } }) => {
          this.createError = err.error?.message || 'Création impossible.';
        },
      });
  }

  /** Entreprise destinataire enregistrée dans `editorState`. */
  clCompany(cl: ClientClDto): string {
    const c = cl.editorState?.['companyName'];
    return typeof c === 'string' ? c.trim() : '';
  }

  /** Lettres filtrées par la recherche (nom + entreprise). */
  get filtered(): ClientClDto[] {
    const q = this.search.trim().toLowerCase();
    if (!q) {
      return this.cls;
    }
    return this.cls.filter(
      (c) => c.name.toLowerCase().includes(q) || this.clCompany(c).toLowerCase().includes(q),
    );
  }

  deleteCl(ev: MouseEvent, cl: ClientClDto): void {
    ev.preventDefault();
    if (!confirm(`Supprimer la lettre « ${cl.name} » ?`)) {
      return;
    }
    this.api.deleteCl(cl._id).subscribe({
      next: () => {
        this.cls = this.cls.filter((c) => c._id !== cl._id);
      },
      error: () => {
        alert('Suppression impossible.');
      },
    });
  }
}
