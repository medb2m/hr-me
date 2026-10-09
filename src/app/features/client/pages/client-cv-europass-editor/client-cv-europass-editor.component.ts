import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { BackButtonComponent } from '../../../../shared/components/back-button/back-button.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of, catchError, finalize } from 'rxjs';

import { AuthService } from '../../../../core/services/auth.service';
import { ClientCvApiService, ClientCvDto } from '../../services/client-cv-api.service';
import {
  ClientProfileApiService,
  ClientProfileDto,
} from '../../services/client-profile-api.service';
import { ClientProfileStateService } from '../../services/client-profile-state.service';
import {
  CvEditorState,
  CvSectionBlock,
  createDefaultCvEditorState,
  mergeCvEditorState,
} from '../../models/cv-editor-state';

export type CvBlockKey = Exclude<keyof CvEditorState, 'version'>;

@Component({
  selector: 'app-client-cv-europass-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, BackButtonComponent],
  templateUrl: './client-cv-europass-editor.component.html',
  styleUrl: './client-cv-europass-editor.component.css',
})
export class ClientCvEuropassEditorComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cvApi = inject(ClientCvApiService);
  private readonly profileApi = inject(ClientProfileApiService);
  readonly profileState = inject(ClientProfileStateService);
  private readonly auth = inject(AuthService);

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

  readonly blocks: { key: CvBlockKey; title: string; hint: string }[] = [
    { key: 'summary', title: 'Résumé / accroche', hint: 'Titre ou phrase d’introduction (profil ou texte libre).' },
    { key: 'personal', title: 'Coordonnées & identité', hint: 'Nom, contact, lieu, etc.' },
    { key: 'experience', title: 'Expérience professionnelle', hint: 'Postes et employeurs depuis votre fiche.' },
    { key: 'education', title: 'Formation', hint: 'Diplômes et établissements.' },
    { key: 'skills', title: 'Compétences', hint: 'Liste issue du profil ou liste personnalisée.' },
    { key: 'languages', title: 'Langues', hint: 'Langues et niveaux CECRL du profil.' },
  ];

  ngOnInit(): void {
    this.route.paramMap.subscribe((pm) => {
      const id = pm.get('cvId')?.trim();
      if (!id) {
        void this.router.navigate(['/client/editor/cv']);
        return;
      }
      this.cvId = id;
      this.load();
    });
  }

  load(): void {
    this.loading = true;
    forkJoin({
      cv: this.cvApi.getCv(this.cvId),
      prof: this.profileApi.getProfile(),
    })
      .pipe(
        catchError(() => {
          void this.router.navigate(['/client/editor/cv']);
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

  setBlockUseProfile(key: CvBlockKey, useProfile: boolean): void {
    this.state[key].useProfile = useProfile;
  }

  previewPhotoUrl(): string | null {
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
            const dates = [w.startDate, w.endDate].filter(Boolean).join(' → ');
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
            const dates = [e.startDate, e.endDate].filter(Boolean).join(' → ');
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

  previewBlockText(key: CvBlockKey): string {
    const b = this.state[key];
    if (!b.visible) {
      return '';
    }
    if (b.useProfile) {
      return this.textFromProfile(key);
    }
    return (b.customText || '').trim() || '—';
  }

  /** Nom affiché en-tête (profil + compte). */
  displayName(): string {
    const p = this.profileFull;
    const u = this.auth.user();
    const prenom = (p?.prenom || this.profileState.prenom() || '').trim();
    const nom = (p?.nom || u?.name || '').trim();
    const line = [prenom, nom].filter(Boolean).join(' ');
    return line || u?.name?.trim() || 'Candidat(e)';
  }

  save(): void {
    const name = this.cvName.trim();
    if (name.length < 2) {
      this.saveMessage = 'Nom du CV : au moins 2 caractères.';
      return;
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
          this.saveMessage = 'Enregistré.';
          setTimeout(() => (this.saveMessage = ''), 2500);
        },
        error: (err: { error?: { message?: string } }) => {
          this.saveMessage = err.error?.message || 'Erreur à l’enregistrement.';
        },
      });
  }

  onPhotoSelected(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
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
      next: () => void this.router.navigate(['/client/editor/cv']),
      error: () => {
        this.saveMessage = 'Suppression impossible.';
      },
    });
  }
}
