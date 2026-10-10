import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { BackButtonComponent } from '../../../../shared/components/back-button/back-button.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of, catchError, finalize } from 'rxjs';
import {
  LucideArrowLeft,
  LucideArrowRight,
  LucideCheck,
  LucideCircleCheckBig,
} from '@lucide/angular';

import { AuthService } from '../../../../core/services/auth.service';
import { ClientCvApiService, ClientCvDto } from '../../services/client-cv-api.service';
import {
  ClientProfileApiService,
  ClientProfileDto,
} from '../../services/client-profile-api.service';
import { ClientProfileStateService } from '../../services/client-profile-state.service';
import { ProfilePhotoUploadComponent } from '../../../../shared/components/profile-photo-upload/profile-photo-upload.component';
import { RichTextEditorComponent } from '../../../../shared/components/rich-text-editor/rich-text-editor.component';
import { DatePickerComponent } from '../../../../shared/components/date-picker/date-picker.component';
import { CvPreviewComponent } from '../../../../shared/components/cv-preview/cv-preview.component';
import {
  CvBlockKey,
  CvEditorState,
  CvSectionBlock,
  CvFormEntry,
  createDefaultCvEditorState,
  mergeCvEditorState,
} from '../../models/cv-editor-state';

export type { CvBlockKey };
export type CvStepKey = 'infos' | 'preview' | CvBlockKey;

@Component({
  selector: 'app-client-cv-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, BackButtonComponent, DatePickerComponent, ProfilePhotoUploadComponent, RichTextEditorComponent, CvPreviewComponent, LucideArrowLeft, LucideArrowRight, LucideCheck, LucideCircleCheckBig],
  templateUrl: './client-cv-editor.component.html',
  styleUrl: './client-cv-editor.component.css',
})
export class ClientCvEditorComponent implements OnInit, OnDestroy {
  /** Étape courante du parcours guidé (0 = infos & photo). */
  step = 0;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cvApi = inject(ClientCvApiService);
  private readonly profileApi = inject(ClientProfileApiService);
  readonly profileState = inject(ClientProfileStateService);
  readonly auth = inject(AuthService);

  cvId = '';
  loading = true;
  cv: ClientCvDto | null = null;
  cvName = '';
  state: CvEditorState = createDefaultCvEditorState();
  photoSource: 'profile' | 'custom' = 'profile';
  profileFull: ClientProfileDto | null = null;

  saving = false;
  saveMessage = '';
  uploadBusy = false;

  /** Mode « personnaliser pour une candidature » (?from=apply) — l'onglet se referme après enregistrement. */
  applyMode = false;
  applySaved = false;
  private readonly cvChannel =
    typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('alwassit-cv') : null;

  readonly blocks: { key: CvBlockKey; title: string; hint: string }[] = [
    { key: 'summary', title: 'Résumé / accroche', hint: 'Titre ou phrase d’introduction (profil ou texte libre).' },
    { key: 'personal', title: 'Coordonnées & identité', hint: 'Nom, contact, lieu, etc.' },
    { key: 'experience', title: 'Expérience professionnelle', hint: 'Postes et employeurs depuis votre fiche.' },
    { key: 'education', title: 'Formation', hint: 'Diplômes et établissements.' },
    { key: 'skills', title: 'Compétences', hint: 'Liste issue du profil ou liste personnalisée.' },
    { key: 'languages', title: 'Langues', hint: 'Langues et niveaux CECRL du profil.' },
  ];

  /** Parcours : étape 0 = infos générales, puis une étape par bloc, puis l'aperçu final. */
  readonly steps: { key: CvStepKey; title: string }[] = [
    { key: 'infos', title: 'CV & photo' },
    ...this.blocks.map((b) => ({ key: b.key as CvStepKey, title: b.title })),
    { key: 'preview', title: 'Aperçu final' },
  ];

  goStep(i: number): void {
    if (i >= 0 && i < this.steps.length) {
      this.step = i;
    }
  }

  nextStep(): void {
    this.goStep(this.step + 1);
  }

  prevStep(): void {
    this.goStep(this.step - 1);
  }

  get lastStep(): number {
    return this.steps.length - 1;
  }

  /** « avr. 2023 » — format court lisible sur un CV. */
  fmtMonth(d: string | null | undefined): string {
    if (!d) {
      return '';
    }
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) {
      return String(d).slice(0, 10);
    }
    return new Intl.DateTimeFormat('fr-FR', { month: 'short', year: 'numeric' }).format(dt);
  }

  /** « avr. 2020 → Présent » / « janv. 2019 → déc. 2021 ». */
  rangeText(start: string | null | undefined, end: string | null | undefined, current?: boolean): string {
    const s = this.fmtMonth(start);
    const e = current ? 'Présent' : this.fmtMonth(end);
    if (s && e) {
      return `${s} → ${e}`;
    }
    return s || e;
  }

  /** Étape considérée "remplie" (pour le point vert dans la navigation). */
  isStepDone(i: number): boolean {
    const s = this.steps[i];
    if (!s || s.key === 'preview') {
      return true;
    }
    if (s.key === 'infos') {
      return this.cvName.trim().length >= 2 && this.state.jobTitle.trim().length >= 2;
    }
    const b = this.state[s.key as CvBlockKey];
    return (
      b.visible &&
      (b.useProfile || (b.customText || '').trim().length > 0 || b.entries.length > 0)
    );
  }

  /** Blocs qui proposent la saisie guidée par formulaire. */
  supportsForm(key: CvBlockKey): boolean {
    return key === 'experience' || key === 'education';
  }

  /** Libellés des champs du formulaire guidé selon le bloc. */
  formLabels(key: CvBlockKey): { title: string; org: string; entry: string } {
    if (key === 'education') {
      return { title: 'Diplôme / formation', org: 'Établissement', entry: 'formation' };
    }
    return { title: 'Poste', org: 'Entreprise / employeur', entry: 'expérience' };
  }

  /** Troisième source : formulaire guidé (entries). */
  setBlockSource(key: CvBlockKey, source: 'profile' | 'custom' | 'form'): void {
    const b = this.state[key];
    b.useForm = source === 'form';
    b.useProfile = source === 'profile';
  }

  blockSource(key: CvBlockKey): 'profile' | 'custom' | 'form' {
    const b = this.state[key];
    return b.useForm ? 'form' : b.useProfile ? 'profile' : 'custom';
  }

  addEntry(key: CvBlockKey): void {
    this.state[key].entries.push({
      title: '',
      org: '',
      startDate: '',
      endDate: '',
      current: false,
      description: '',
    });
  }

  /** « En cours » coché → la date de fin n'a plus de sens. */
  onEntryCurrentToggle(e: CvFormEntry): void {
    if (e.current) {
      e.endDate = '';
    }
  }

  removeEntry(key: CvBlockKey, i: number): void {
    this.state[key].entries.splice(i, 1);
  }

  hasCustomPhoto(): boolean {
    return !!(this.cv?.customPhotoUrl && this.photoSource === 'custom');
  }

  ngOnInit(): void {
    this.applyMode = this.route.snapshot.queryParamMap.get('from') === 'apply';
    this.route.paramMap.subscribe((pm) => {
      const id = pm.get('cvId')?.trim();
      if (!id) {
        void this.router.navigate(['/candidat/editor/cv']);
        return;
      }
      this.cvId = id;
      this.load();
    });
  }

  ngOnDestroy(): void {
    this.cvChannel?.close();
  }

  /** Bouton « Fermer l'onglet » — ne marche que si l'onglet a été ouvert par script (window.open). */
  closeTab(): void {
    window.close();
  }

  load(): void {
    this.loading = true;
    forkJoin({
      cv: this.cvApi.getCv(this.cvId),
      prof: this.profileApi.getProfile(),
    })
      .pipe(
        catchError(() => {
          void this.router.navigate(['/candidat/editor/cv']);
          return of(null);
        }),
        finalize(() => (this.loading = false)),
      )
      .subscribe((pack) => {
        if (!pack) {
          return;
        }
        const doc = pack.prof.profile;
        const cvDoc = pack.cv.cv;
        this.profileFull = doc;
        this.profileState.applyFromServerProfile(doc);
        this.cv = cvDoc;
        this.cvName = cvDoc.name;
        this.state = mergeCvEditorState(cvDoc.editorState);
        this.photoSource = cvDoc.photoSource === 'custom' ? 'custom' : 'profile';
      });
  }

  block(key: CvBlockKey): CvSectionBlock {
    return this.state[key];
  }

  previewPhotoUrl(): string | null {
    if (this.state.hidePhoto) {
      return null;
    }
    if (this.photoSource === 'custom' && this.cv?.customPhotoUrl) {
      return this.profileApi.resolveMediaUrl(this.cv.customPhotoUrl);
    }
    return this.profileApi.resolveMediaUrl(this.profileState.profilePhotoUrl());
  }

  textFromProfile(key: CvBlockKey): string {
    const u = this.auth.user();
    const p = this.profileFull;
    const nom = (p?.nom || u?.name || '').trim() || '—';
    const prenom = (p?.prenom || this.profileState.prenom() || '').trim();
    const email = u?.email || '';
    const bd = this.profileState.birthDate();

    switch (key) {
      case 'summary': {
        const h = (p?.headline || '').trim();
        if (h) {
          return h;
        }
        const identity = [prenom, nom].filter(Boolean).join(' ');
        return identity ? `${identity} — candidat(e) (données profil).` : 'Complétez votre accroche dans Identité & profil.';
      }
      case 'personal': {
        const lines: string[] = [];
        const fullName = [prenom, nom].filter(Boolean).join(' ');
        if (fullName) {
          lines.push(fullName);
        }
        if (email) {
          lines.push(email);
        }
        if (p?.phone?.trim()) {
          lines.push(p.phone.trim());
        }
        if (this.state.includePhones) {
          lines.push(...(p?.phones ?? []).map((t) => t.trim()).filter(Boolean));
        }
        if (this.state.includeLinks) {
          lines.push(
            ...(p?.links ?? [])
              .map((l) => {
                const u = (l.url || '').trim();
                const lab = (l.label || '').trim();
                return u ? (lab ? `${lab} : ${u}` : u) : '';
              })
              .filter(Boolean),
          );
        }
        const place = [p?.city, p?.country].filter((x) => x?.trim()).join(', ');
        if (place) {
          lines.push(place);
        }
        if (p?.nationality?.trim()) {
          lines.push(`Nationalité : ${p.nationality.trim()}`);
        }
        if (bd) {
          lines.push(`Né(e) le : ${bd}`);
        }
        return lines.length ? lines.join('\n') : 'Renseignez vos coordonnées dans Identité & profil.';
      }
      case 'experience': {
        const list = p?.workExperiences ?? [];
        if (!list.length) {
          return 'Aucune expérience enregistrée dans le profil — ajoutez-en dans Identité & profil.';
        }
        return list
          .map((w) => {
            const title = (w.jobTitle || '').trim() || 'Poste';
            const emp = (w.employer || '').trim();
            const dates = this.rangeText(w.startDate, w.endDate, w.current);
            const desc = (w.description || '').trim();
            const head = emp ? `${title}, ${emp}` : title;
            return [head, dates, desc].filter(Boolean).join('\n');
          })
          .join('\n\n');
      }
      case 'education': {
        const list = p?.educations ?? [];
        if (!list.length) {
          return 'Aucune formation enregistrée dans le profil.';
        }
        return list
          .map((e) => {
            const t = (e.title || '').trim() || 'Formation';
            const org = (e.organization || '').trim();
            const dates = this.rangeText(e.startDate, e.endDate, e.current);
            return [org ? `${t} — ${org}` : t, dates].filter(Boolean).join('\n');
          })
          .join('\n\n');
      }
      case 'skills': {
        const s = p?.skills?.filter((x) => x.trim()) ?? [];
        const d = p?.digitalSkills?.filter((x) => x.trim()) ?? [];
        const parts: string[] = [];
        if (s.length) {
          parts.push(s.join(', '));
        }
        if (d.length) {
          parts.push(`Comp. numériques : ${d.join(', ')}`);
        }
        return parts.length ? parts.join('\n') : 'Ajoutez des compétences dans Identité & profil.';
      }
      case 'languages': {
        const list = p?.languagesSpoken ?? [];
        if (!list.length) {
          return 'Aucune langue renseignée dans le profil.';
        }
        return list
          .map((l) => {
            const lang = (l.language || '').trim() || 'Langue';
            const lv = (l.cefrLevel || '').trim();
            return lv ? `${lang} (${lv})` : lang;
          })
          .join('\n');
      }
      default:
        return '';
    }
  }

  save(): void {
    const name = this.cvName.trim();
    if (name.length < 2) {
      this.saveMessage = 'Nom du CV : au moins 2 caractères.';
      return;
    }
    // Validation des dates des entrées guidées (expérience / formation).
    for (const key of ['experience', 'education'] as CvBlockKey[]) {
      for (const e of this.state[key].entries) {
        if (!e.current && e.startDate && e.endDate && e.startDate > e.endDate) {
          this.saveMessage = `Dates invalides dans « ${key === 'experience' ? 'Expérience' : 'Formation'} » : la date de début doit être avant la fin.`;
          return;
        }
      }
    }
    this.saving = true;
    this.saveMessage = '';
    this.cvApi
      .saveCv(this.cvId, {
        name,
        editorState: this.state,
        photoSource: this.photoSource,
      })
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: ({ cv }) => {
          this.cv = cv;
          this.cvChannel?.postMessage({ type: 'cv-saved', cvId: this.cvId });
          if (this.applyMode) {
            this.applySaved = true;
            // L'onglet a été ouvert par le script de la page candidature → window.close() autorisé.
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

  onPhotoSelected(file: File): void {
    if (!file || !this.cvId) {
      return;
    }
    this.uploadBusy = true;
    this.cvApi
      .uploadCvPhoto(this.cvId, file)
      .pipe(finalize(() => (this.uploadBusy = false)))
      .subscribe({
        next: ({ cv }) => {
          this.cv = cv;
          this.photoSource = 'custom';
        },
        error: () => {
          this.saveMessage = 'Échec de l’upload photo.';
        },
      });
  }

  deleteCv(): void {
    if (!this.cv || !confirm(`Supprimer définitivement « ${this.cv.name} » ?`)) {
      return;
    }
    this.cvApi.deleteCv(this.cvId).subscribe({
      next: () => void this.router.navigate(['/candidat/editor/cv']),
      error: () => {
        this.saveMessage = 'Suppression impossible.';
      },
    });
  }
}
