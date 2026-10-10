import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of, catchError, finalize } from 'rxjs';
import {
  LucideCircleCheckBig,
  LucideLoader2,
  LucideSparkles,
} from '@lucide/angular';

import { AuthService } from '../../../../core/services/auth.service';
import { AiTextService } from '../../../../core/services/ai-text.service';
import { ClientClApiService, ClientClDto } from '../../services/client-cl-api.service';
import {
  ClientProfileApiService,
  ClientProfileDto,
} from '../../services/client-profile-api.service';
import { BackButtonComponent } from '../../../../shared/components/back-button/back-button.component';
import { RichTextEditorComponent } from '../../../../shared/components/rich-text-editor/rich-text-editor.component';
import { DatePickerComponent } from '../../../../shared/components/date-picker/date-picker.component';
import { ClPreviewComponent } from '../../../../shared/components/cl-preview/cl-preview.component';
import {
  ClEditorState,
  createDefaultClEditorState,
  mergeClEditorState,
} from '../../models/cl-editor-state';

/** Éditeur de lettre de motivation — champs structurés + corps riche + aperçu document live. */
@Component({
  selector: 'app-client-cl-editor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    BackButtonComponent,
    RichTextEditorComponent,
    DatePickerComponent,
    ClPreviewComponent,
    LucideCircleCheckBig,
    LucideLoader2,
    LucideSparkles,
  ],
  templateUrl: './client-cl-editor.component.html',
  styleUrl: './client-cl-editor.component.css',
})
export class ClientClEditorComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly clApi = inject(ClientClApiService);
  private readonly profileApi = inject(ClientProfileApiService);
  private readonly ai = inject(AiTextService);
  readonly auth = inject(AuthService);

  clId = '';
  loading = true;
  cl: ClientClDto | null = null;
  clName = '';
  state: ClEditorState = createDefaultClEditorState();
  profileFull: ClientProfileDto | null = null;

  saving = false;
  saveMessage = '';

  // Panneau IA « générer le corps »
  aiOpen = false;
  aiPrompt = '';
  aiBusy = false;
  aiError = '';

  /** Mode « personnaliser pour une candidature » (?from=apply) — l'onglet se referme après enregistrement. */
  applyMode = false;
  applySaved = false;
  private readonly clChannel =
    typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('alwassit-cl') : null;

  ngOnInit(): void {
    this.applyMode = this.route.snapshot.queryParamMap.get('from') === 'apply';
    this.route.paramMap.subscribe((pm) => {
      const id = pm.get('clId')?.trim();
      if (!id) {
        void this.router.navigate(['/candidat/editor/cl']);
        return;
      }
      this.clId = id;
      this.load();
    });
  }

  ngOnDestroy(): void {
    this.clChannel?.close();
  }

  load(): void {
    this.loading = true;
    forkJoin({
      cl: this.clApi.getCl(this.clId),
      prof: this.profileApi.getProfile(),
    })
      .pipe(
        catchError(() => {
          void this.router.navigate(['/candidat/editor/cl']);
          return of(null);
        }),
        finalize(() => (this.loading = false)),
      )
      .subscribe((pack) => {
        if (!pack) {
          return;
        }
        this.profileFull = pack.prof.profile;
        this.cl = pack.cl.cl;
        this.clName = pack.cl.cl.name;
        this.state = mergeClEditorState(pack.cl.cl.editorState);
      });
  }

  /** Nom affiché dans la signature de l'aperçu. */
  displayName(): string {
    const p = this.profileFull;
    const u = this.auth.user();
    const line = [(p?.prenom || '').trim(), (p?.nom || '').trim()].filter(Boolean).join(' ');
    return line || (p?.nom || u?.name || '').trim() || 'Candidat(e)';
  }

  closeTab(): void {
    window.close();
  }

  save(): void {
    const name = this.clName.trim();
    if (name.length < 2) {
      this.saveMessage = 'Nom de la lettre : au moins 2 caractères.';
      return;
    }
    this.saving = true;
    this.saveMessage = '';
    this.clApi
      .saveCl(this.clId, { name, editorState: this.state })
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: ({ cl }) => {
          this.cl = cl;
          this.clChannel?.postMessage({ type: 'cl-saved', clId: this.clId });
          if (this.applyMode) {
            this.applySaved = true;
            setTimeout(() => window.close(), 600);
            return;
          }
          this.saveMessage = 'Enregistré.';
          setTimeout(() => (this.saveMessage = ''), 2500);
        },
        error: (err: { error?: { message?: string } }) => {
          this.saveMessage = err.error?.message || 'Erreur à l’enregistrement.';
        },
      });
  }

  /** « Générer avec l'IA » — remplit le corps via le contexte lettre + prompt optionnel. */
  generateWithAi(): void {
    if (this.aiBusy) {
      return;
    }
    this.aiBusy = true;
    this.aiError = '';
    this.ai
      .generateLetter({
        prompt: this.aiPrompt.trim(),
        jobTitle: this.state.object.trim(),
        companyName: this.state.companyName.trim(),
        candidateName: this.displayName(),
        userName: this.auth.user()?.name || '',
      })
      .pipe(finalize(() => (this.aiBusy = false)))
      .subscribe({
        next: ({ letter }) => {
          this.state.body = letter;
          this.aiOpen = false;
          this.aiPrompt = '';
        },
        error: (err: { error?: { message?: string } }) => {
          this.aiError = err.error?.message || 'Génération impossible pour le moment.';
        },
      });
  }

  deleteCl(): void {
    if (!this.cl || !confirm(`Supprimer définitivement « ${this.cl.name} » ?`)) {
      return;
    }
    this.clApi.deleteCl(this.clId).subscribe({
      next: () => void this.router.navigate(['/candidat/editor/cl']),
      error: () => {
        this.saveMessage = 'Suppression impossible.';
      },
    });
  }
}
