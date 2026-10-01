import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../../core/services/auth.service';

/** Champs utilisés pour le pourcentage de complétion (démo / futur branchement API). */
export interface ClientProfileSections {
  personalInfo: boolean;
  workHistory: boolean;
  education: boolean;
  skills: boolean;
  languages: boolean;
  digitalSkills: boolean;
}

const defaultSections: ClientProfileSections = {
  personalInfo: false,
  workHistory: false,
  education: true,
  skills: true,
  languages: false,
  digitalSkills: false,
};

@Injectable({ providedIn: 'root' })
export class ClientProfileStateService {
  private readonly auth = inject(AuthService);

  /** URL photo (chemin `/uploads/...` ou `assets/...`) ; null = à compléter. */
  readonly profilePhotoUrl = signal<string | null>(null);
  /** Date de naissance ISO ou affichage court ; null = manquant. */
  readonly birthDate = signal<string | null>(null);
  /** Prénom issu du modèle `ClientProfile` (serveur). */
  readonly prenom = signal<string | null>(null);
  readonly sections = signal<ClientProfileSections>({ ...defaultSections });

  /** Inclut blocs profil + photo + date de naissance + nom sur le compte. */
  readonly completionPercent = computed(() => {
    const s = this.sections();
    const keys = Object.keys(s) as (keyof ClientProfileSections)[];
    const sectionsFilled = keys.filter((k) => s[k]).length;
    const u = this.auth.user();
    const nameOk = Boolean(u?.name?.trim());
    const photoOk = this.profilePhotoUrl() != null;
    const birthOk = this.birthDate() != null;
    const total = keys.length + 3;
    const filled = sectionsFilled + (nameOk ? 1 : 0) + (photoOk ? 1 : 0) + (birthOk ? 1 : 0);
    return Math.round((filled / total) * 100);
  });

  readonly isProfileComplete = computed(() => this.completionPercent() >= 100);

  patchSections(partial: Partial<ClientProfileSections>): void {
    this.sections.update((cur) => ({ ...cur, ...partial }));
  }

  setPhoto(url: string | null): void {
    this.profilePhotoUrl.set(url);
  }

  setBirthDate(value: string | null): void {
    this.birthDate.set(value);
  }

  /** Hydrate l’UI depuis `GET /api/client/profile` (sans écraser les toggles locaux si `sectionFlags` absent). */
  applyFromServerProfile(doc: unknown): void {
    if (!doc || typeof doc !== 'object') {
      return;
    }
    const d = doc as Record<string, unknown>;
    const rawPhoto = d['profilePhotoUrl'];
    const photo = typeof rawPhoto === 'string' ? rawPhoto.trim() : '';
    this.profilePhotoUrl.set(photo || null);

    const rawPrenom = d['prenom'];
    const pr = typeof rawPrenom === 'string' ? rawPrenom.trim() : '';
    this.prenom.set(pr || null);

    if ('birthDate' in d) {
      const bd = d['birthDate'];
      if (bd == null || bd === '') {
        this.birthDate.set(null);
      } else if (bd instanceof Date) {
        this.birthDate.set(bd.toISOString().slice(0, 10));
      } else if (typeof bd === 'string') {
        const iso = bd.trim().slice(0, 10);
        this.birthDate.set(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null);
      }
    }

    const sf = d['sectionFlags'];
    if (sf && typeof sf === 'object' && !Array.isArray(sf)) {
      const o = sf as Record<string, boolean>;
      const keys = Object.keys(defaultSections) as (keyof ClientProfileSections)[];
      const next = { ...defaultSections };
      for (const k of keys) {
        if (typeof o[k] === 'boolean') {
          next[k] = o[k];
        }
      }
      this.sections.set(next);
    }
  }
}
