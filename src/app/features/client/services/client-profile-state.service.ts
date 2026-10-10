import { Injectable, computed, signal } from '@angular/core';

/** Sections du dossier — chacune est « complétée » uniquement si elle contient de vraies données. */
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
  education: false,
  skills: false,
  languages: false,
  digitalSkills: false,
};

export interface ProfileChecklistItem {
  key: string;
  label: string;
  done: boolean;
  /** true = bloquant pour atteindre 100 % (identité). */
  required: boolean;
  /** Détail affiché quand l'item est incomplet (ex. « Prénom manquant »). */
  hint: string;
}

@Injectable({ providedIn: 'root' })
export class ClientProfileStateService {
  /** URL photo (chemin `/uploads/...` ou `assets/...`) ; null = à compléter. */
  readonly profilePhotoUrl = signal<string | null>(null);
  /** Date de naissance ISO ou affichage court ; null = manquant. */
  readonly birthDate = signal<string | null>(null);
  /** Prénom / nom issus du modèle `ClientProfile` (serveur). */
  readonly prenom = signal<string | null>(null);
  readonly nom = signal<string | null>(null);
  readonly sections = signal<ClientProfileSections>({ ...defaultSections });

  /** Ce qui manque côté identité : 'both' | 'prenom' | 'nom' | null. */
  readonly missingIdentity = computed<'both' | 'prenom' | 'nom' | null>(() => {
    const p = !!this.prenom();
    const n = !!this.nom();
    if (p && n) return null;
    if (!p && !n) return 'both';
    return p ? 'nom' : 'prenom';
  });

  readonly identityOk = computed(() => this.missingIdentity() === null);

  /**
   * Checklist dérivée — 9 items : identité (requis), photo, naissance + 6 sections
   * alimentées par les vraies données du dossier (jamais des cases cochées à la main).
   */
  readonly checklist = computed<ProfileChecklistItem[]>(() => {
    const miss = this.missingIdentity();
    const s = this.sections();
    const items: ProfileChecklistItem[] = [
      {
        key: 'identity',
        label: 'Prénom & nom',
        done: miss === null,
        required: true,
        hint:
          miss === 'both'
            ? 'Prénom et nom à renseigner'
            : miss === 'prenom'
              ? 'Prénom manquant'
              : miss === 'nom'
                ? 'Nom manquant'
                : '',
      },
      {
        key: 'photo',
        label: 'Photo de profil',
        done: this.profilePhotoUrl() != null,
        required: false,
        hint: 'Ajoutez une photo professionnelle',
      },
      {
        key: 'birthDate',
        label: 'Date de naissance',
        done: this.birthDate() != null,
        required: false,
        hint: 'Indiquez votre date de naissance',
      },
      {
        key: 'personalInfo',
        label: 'Informations personnelles & contact',
        done: s.personalInfo,
        required: false,
        hint: 'Téléphone, liens, ville ou accroche',
      },
      {
        key: 'workHistory',
        label: 'Expériences professionnelles',
        done: s.workHistory,
        required: false,
        hint: 'Ajoutez au moins une expérience',
      },
      {
        key: 'education',
        label: 'Formation & diplômes',
        done: s.education,
        required: false,
        hint: 'Ajoutez au moins une formation',
      },
      {
        key: 'skills',
        label: 'Compétences',
        done: s.skills,
        required: false,
        hint: 'Listez vos compétences clés',
      },
      {
        key: 'languages',
        label: 'Langues',
        done: s.languages,
        required: false,
        hint: 'Indiquez vos langues (CECRL)',
      },
      {
        key: 'digitalSkills',
        label: 'Compétences numériques',
        done: s.digitalSkills,
        required: false,
        hint: 'Outils et logiciels maîtrisés',
      },
    ];
    return items;
  });

  readonly completionPercent = computed(() => {
    const items = this.checklist();
    const done = items.filter((i) => i.done).length;
    return Math.round((done / items.length) * 100);
  });

  readonly isProfileComplete = computed(() => this.completionPercent() >= 100);

  setPhoto(url: string | null): void {
    this.profilePhotoUrl.set(url);
  }

  setBirthDate(value: string | null): void {
    this.birthDate.set(value);
  }

  /** Hydrate l’UI depuis `GET /api/client/profile` — tout est dérivé des vraies données. */
  applyFromServerProfile(doc: unknown): void {
    if (!doc || typeof doc !== 'object') {
      return;
    }
    const d = doc as Record<string, unknown>;
    const str = (k: string): string | null => {
      const v = d[k];
      return typeof v === 'string' && v.trim() ? v.trim() : null;
    };
    const arr = (k: string): boolean => Array.isArray(d[k]) && (d[k] as unknown[]).length > 0;

    this.profilePhotoUrl.set(str('profilePhotoUrl'));
    this.prenom.set(str('prenom'));
    this.nom.set(str('nom'));

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

    // Sections dérivées : la section compte dès qu'elle contient une vraie donnée.
    this.sections.set({
      personalInfo:
        !!str('phone') ||
        arr('phones') ||
        arr('links') ||
        !!str('city') ||
        !!str('country') ||
        !!str('nationality') ||
        !!str('headline'),
      workHistory: arr('workExperiences'),
      education: arr('educations'),
      skills: arr('skills'),
      languages: arr('languagesSpoken'),
      digitalSkills: arr('digitalSkills'),
    });
  }
}
