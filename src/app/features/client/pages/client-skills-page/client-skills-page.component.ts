import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, finalize, map, switchMap } from 'rxjs/operators';
import {
  LucideBriefcase,
  LucideCheck,
  LucideLanguages,
  LucideLoader2,
  LucideMonitor,
  LucidePlus,
  LucideSparkles,
  LucideX,
} from '@lucide/angular';
import { AiTextService } from '../../../../core/services/ai-text.service';
import { BackButtonComponent } from '../../../../shared/components/back-button/back-button.component';
import {
  ClientProfileApiService,
  type ClientProfileDto,
} from '../../services/client-profile-api.service';
import { ClientProfileStateService } from '../../services/client-profile-state.service';
import {
  ClientSkillsApiService,
  type SkillSuggestion,
} from '../../services/client-skills-api.service';
import { CEFR_LEVELS, LANGUAGES, SKILL_CATEGORY_LABELS } from '../../models/skills.data';

type Kind = 'skills' | 'digitalSkills';

interface SuggestPanel {
  input: string;
  open: boolean;
  hi: number;
  list: SkillSuggestion[];
}

/** Normalise pour la déduplication (casse/accents/espaces ignorés). */
function fold(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

@Component({
  selector: 'app-client-skills-page',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    BackButtonComponent,
    LucideBriefcase,
    LucideCheck,
    LucideLanguages,
    LucideLoader2,
    LucideMonitor,
    LucidePlus,
    LucideSparkles,
    LucideX,
  ],
  templateUrl: './client-skills-page.component.html',
  styleUrl: './client-skills-page.component.css',
})
export class ClientSkillsPageComponent implements OnInit {
  private readonly profileApi = inject(ClientProfileApiService);
  private readonly skillsApi = inject(ClientSkillsApiService);
  private readonly aiText = inject(AiTextService);
  private readonly destroyRef = inject(DestroyRef);
  readonly profileState = inject(ClientProfileStateService);

  readonly cefrLevels = CEFR_LEVELS;
  readonly languageOptions = LANGUAGES;
  readonly MAX_PER_KIND = 40;
  readonly MAX_LANGUAGES = 15;

  loading = true;
  loadError = '';
  saving = false;
  saveError = '';
  savedFlash = false;
  private savedTimer: ReturnType<typeof setTimeout> | null = null;

  /** Sélections locales — synchronisées au profil via patchProfile. */
  skills: string[] = [];
  digitalSkills: string[] = [];
  languages: Array<{ language: string; cefrLevel: string }> = [];

  /** Snapshot JSON pour détecter les modifications non enregistrées. */
  private snapshot = '';

  /** Panneaux d'autocomplétion (bibliothèque) par type de compétence. */
  panels: Record<Kind, SuggestPanel> = {
    skills: { input: '', open: false, hi: -1, list: [] },
    digitalSkills: { input: '', open: false, hi: -1, list: [] },
  };
  private readonly suggestQueries = new Subject<{ kind: Kind; q: string }>();

  /** Suggestions « populaires » (top bibliothèque, sans saisie). */
  private popular: Record<Kind, string[]> = { skills: [], digitalSkills: [] };

  /** Suggestions IA par type (jamais appliquées sans clic utilisateur). */
  aiList: Record<Kind, string[]> = { skills: [], digitalSkills: [] };
  aiBusy: Record<Kind, boolean> = { skills: false, digitalSkills: false };
  aiDone: Record<Kind, boolean> = { skills: false, digitalSkills: false };

  /** Contexte IA chargé du profil (accroche + métiers). */
  private aiContext: { headline: string; jobs: string[] } = { headline: '', jobs: [] };

  /** Nouvelle ligne langue. */
  langInput = '';
  langLevel = 'B1';

  /** Config des deux cartes compétences (même mécanique, `kind` différent). */
  readonly sections = [
    {
      kind: 'skills' as Kind,
      title: 'Compétences clés',
      sub: 'Savoir-faire métier — ce que les recruteurs cherchent en premier.',
      placeholder: 'Ex. Soudure TIG, Service en salle, Comptabilité…',
      aiTitle: 'Suggestions IA selon votre profil',
    },
    {
      kind: 'digitalSkills' as Kind,
      title: 'Compétences numériques',
      sub: 'Outils, logiciels et usages digitaux maîtrisés.',
      placeholder: 'Ex. Excel, AutoCAD, Visioconférence…',
      aiTitle: 'Suggestions IA pour le numérique',
    },
  ];

  ngOnInit(): void {
    // Autocomplétion : debounce + annulation des requêtes précédentes.
    this.suggestQueries
      .pipe(
        debounceTime(160),
        distinctUntilChanged((a, b) => a.kind === b.kind && a.q === b.q),
        switchMap(({ kind, q }) =>
          this.skillsApi
            .suggest(q, kind === 'skills' ? 'skill' : 'digital', 12)
            .pipe(map(({ skills }) => ({ kind, skills }))),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ kind, skills }) => {
          const p = this.panels[kind];
          if (p.open) {
            p.list = skills.filter((s) => !this.hasSkill(kind, s.label));
            p.hi = p.list.length ? 0 : -1;
          }
        },
        error: () => {},
      });

    this.profileApi
      .getProfile()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ profile }) => {
          this.applyProfile(profile);
          this.loading = false;
          this.loadPopular();
        },
        error: () => {
          this.loading = false;
          this.loadError = 'Impossible de charger votre profil. Réessayez.';
        },
      });
  }

  private applyProfile(p: ClientProfileDto): void {
    this.profileState.applyFromServerProfile(p);
    this.skills = [...(p.skills ?? [])];
    this.digitalSkills = [...(p.digitalSkills ?? [])];
    this.languages = (p.languagesSpoken ?? []).map((l) => ({
      language: l.language ?? '',
      cefrLevel: l.cefrLevel ?? '',
    }));
    this.aiContext = {
      headline: p.headline ?? '',
      jobs: (p.workExperiences ?? [])
        .map((w) => w.jobTitle ?? '')
        .filter(Boolean)
        .slice(0, 8),
    };
    this.snapshot = this.serialize();
  }

  /** Top bibliothèque (les plus utilisées) — suggestions « pour vous ». */
  private loadPopular(): void {
    for (const kind of ['skills', 'digitalSkills'] as Kind[]) {
      this.skillsApi
        .suggest('', kind === 'skills' ? 'skill' : 'digital', 14)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: ({ skills }) => (this.popular[kind] = skills.map((s) => s.label)),
          error: () => {},
        });
    }
  }

  private serialize(): string {
    return JSON.stringify([this.skills, this.digitalSkills, this.languages]);
  }

  isDirty(): boolean {
    return this.serialize() !== this.snapshot;
  }

  totalCount(): number {
    return this.skills.length + this.digitalSkills.length + this.languages.length;
  }

  categoryLabel(cat: string): string {
    return SKILL_CATEGORY_LABELS[cat] || SKILL_CATEGORY_LABELS['autre'];
  }

  hasSkill(kind: Kind, label: string): boolean {
    const k = fold(label);
    return this[kind].some((s) => fold(s) === k);
  }

  /** Liste sélectionnée d'un type — accesseur typé pour le template. */
  selectedFor(kind: Kind): string[] {
    return this[kind];
  }

  // ================= Compétences =================

  onSkillInput(kind: Kind): void {
    const p = this.panels[kind];
    p.open = true;
    this.suggestQueries.next({ kind, q: p.input });
  }

  onSkillFocus(kind: Kind): void {
    this.panels[kind].open = true;
    this.suggestQueries.next({ kind, q: this.panels[kind].input });
  }

  /** Fermeture différée pour laisser le clic sur une option se déclencher. */
  onSkillBlur(kind: Kind): void {
    setTimeout(() => (this.panels[kind].open = false), 160);
  }

  onSkillKeydown(kind: Kind, ev: KeyboardEvent): void {
    const p = this.panels[kind];
    if (ev.key === 'ArrowDown' && p.list.length) {
      ev.preventDefault();
      p.hi = (p.hi + 1) % p.list.length;
    } else if (ev.key === 'ArrowUp' && p.list.length) {
      ev.preventDefault();
      p.hi = (p.hi - 1 + p.list.length) % p.list.length;
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      this.addSkill(kind, p.hi >= 0 && p.list[p.hi] ? p.list[p.hi].label : p.input);
    } else if (ev.key === 'Escape') {
      p.open = false;
    }
  }

  addSkill(kind: Kind, raw: string): void {
    const label = (raw || '').replace(/\s+/g, ' ').trim().slice(0, 60);
    const p = this.panels[kind];
    if (!label || this[kind].length >= this.MAX_PER_KIND || this.hasSkill(kind, label)) {
      p.input = '';
      p.open = false;
      return;
    }
    this[kind].push(label);
    p.input = '';
    p.list = [];
    p.open = false;
    p.hi = -1;
    // La bibliothèque « apprend » : la compétence rejoint les suggestions de tous.
    this.skillsApi
      .register(label, kind === 'skills' ? 'skill' : 'digital')
      .subscribe({ error: () => {} });
    this.aiList[kind] = this.aiList[kind].filter((s) => !this.hasSkill(kind, s));
  }

  removeSkill(kind: Kind, i: number): void {
    this[kind].splice(i, 1);
  }

  /** Suggestions « pour vous » : populaires non encore sélectionnées. */
  popularFor(kind: Kind): string[] {
    return this.popular[kind].filter((s) => !this.hasSkill(kind, s)).slice(0, 8);
  }

  // ================= Suggestions IA =================

  suggestWithAi(kind: Kind): void {
    if (this.aiBusy[kind]) {
      return;
    }
    this.aiBusy[kind] = true;
    this.aiText
      .suggestProfileSkills({
        headline: this.aiContext.headline,
        jobs: this.aiContext.jobs,
        existing: this[kind],
        kind: kind === 'skills' ? 'skill' : 'digital',
      })
      .pipe(finalize(() => (this.aiBusy[kind] = false)))
      .subscribe({
        next: ({ skills }) => {
          this.aiList[kind] = skills.filter((s) => !this.hasSkill(kind, s));
          this.aiDone[kind] = true;
        },
        error: (err: { error?: { message?: string } }) => {
          this.saveError = err.error?.message || 'Suggestions IA indisponibles pour le moment.';
        },
      });
  }

  acceptAi(kind: Kind, label: string): void {
    this.addSkill(kind, label);
  }

  // ================= Langues =================

  hasLanguage(name: string): boolean {
    const k = fold(name);
    return this.languages.some((l) => fold(l.language) === k);
  }

  addLanguage(name?: string): void {
    const label = (name ?? this.langInput).replace(/\s+/g, ' ').trim().slice(0, 40);
    if (!label || this.languages.length >= this.MAX_LANGUAGES || this.hasLanguage(label)) {
      this.langInput = '';
      return;
    }
    this.languages.push({ language: label, cefrLevel: this.langLevel });
    this.langInput = '';
  }

  removeLanguage(i: number): void {
    this.languages.splice(i, 1);
  }

  /** Langues courantes proposées en accès rapide (non déjà listées). */
  quickLanguages(): string[] {
    return ['Français', 'Anglais', 'Arabe', 'Espagnol', 'Allemand', 'Italien', 'Portugais', 'Turc'].filter(
      (l) => !this.hasLanguage(l),
    );
  }

  // ================= Sauvegarde =================

  save(): void {
    if (this.saving || !this.isDirty()) {
      return;
    }
    this.saving = true;
    this.saveError = '';
    this.profileApi
      .patchProfile({
        skills: this.skills,
        digitalSkills: this.digitalSkills,
        languagesSpoken: this.languages
          .map((l) => ({ language: l.language.trim(), cefrLevel: l.cefrLevel }))
          .filter((l) => l.language),
      })
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: ({ profile }) => {
          this.applyProfile(profile);
          if (this.savedTimer) {
            clearTimeout(this.savedTimer);
          }
          this.savedFlash = true;
          this.savedTimer = setTimeout(() => (this.savedFlash = false), 2600);
        },
        error: (err: { error?: { message?: string } }) => {
          this.saveError = err.error?.message || 'Enregistrement impossible.';
        },
      });
  }
}
