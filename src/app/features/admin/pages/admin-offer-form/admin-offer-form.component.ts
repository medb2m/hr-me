import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, OnInit, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import {
  LucideArrowLeft,
  LucideBuilding2,
  LucideCheck,
  LucideChevronDown,
  LucideFilePen,
  LucideGlobe,
  LucideImagePlus,
  LucideLaptop,
  LucideLock,
  LucideMapPin,
  LucideMinus,
  LucidePlus,
  LucideSave,
  LucideSparkles,
  LucideWifi,
  LucideX,
} from '@lucide/angular';
import {
  AdminOffer,
  AdminOffersApiService,
  OfferStatus,
  OfferWorkMode,
} from '../../services/admin-offers-api.service';
import { COUNTRIES, CountryOption } from '../../../../shared/data/countries.data';
import { CITIES_BY_COUNTRY } from '../../../../shared/data/cities.data';
import { DatePickerComponent } from '../../../../shared/components/date-picker/date-picker.component';
import { FlagComponent } from '../../../../shared/components/flag/flag.component';
import { RichTextEditorComponent } from '../../../../shared/components/rich-text-editor/rich-text-editor.component';

@Component({
  selector: 'app-admin-offer-form',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    DatePickerComponent,
    FlagComponent,
    RichTextEditorComponent,
    LucideArrowLeft,
    LucideBuilding2,
    LucideCheck,
    LucideChevronDown,
    LucideFilePen,
    LucideGlobe,
    LucideImagePlus,
    LucideLaptop,
    LucideLock,
    LucideMapPin,
    LucideMinus,
    LucidePlus,
    LucideSave,
    LucideSparkles,
    LucideWifi,
    LucideX,
  ],
  templateUrl: './admin-offer-form.component.html',
  styleUrl: './admin-offer-form.component.css',
})
export class AdminOfferFormComponent implements OnInit {
  private readonly api = inject(AdminOffersApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly host = inject(ElementRef<HTMLElement>);

  @ViewChild('countryInput') countryInput?: ElementRef<HTMLInputElement>;

  // ---------- état du formulaire ----------
  offerId = '';
  saving = false;
  loadingOffer = false;
  errorMsg = '';
  fieldErrors: Record<string, string> = {};

  name = '';
  partner = '';
  companyLogo = '';
  city = '';
  workMode: OfferWorkMode = 'onsite';
  openings = 1;
  status: OfferStatus = 'published';
  publishDate = '';
  deadline = '';
  description = '';
  skills: string[] = [];
  skillDraft = '';

  // Pays — dropdown recherchable avec drapeaux
  country: CountryOption | null = null;
  countryQuery = '';
  countryOpen = false;
  countryActive = 0;
  readonly allCountries = COUNTRIES;

  // Ville — suggestions selon le pays (saisie libre conservée)
  cityOpen = false;
  cityActive = 0;

  // Statut — dropdown custom avec icônes
  statusOpen = false;
  readonly statusOptions: { value: OfferStatus; label: string; icon: 'globe' | 'filepen' | 'lock' }[] = [
    { value: 'published', label: 'Publiée', icon: 'globe' },
    { value: 'draft', label: 'Brouillon', icon: 'filepen' },
    { value: 'closed', label: 'Clôturée', icon: 'lock' },
  ];

  // Logo
  logoUploading = false;
  logoError = '';

  // IA — génération de description
  aiPanelOpen = false;
  aiPrompt = '';
  aiLoading = false;
  aiError = '';

  // IA — suggestion de compétences
  skillsLoading = false;
  suggestedSkills: string[] = [];
  skillsError = '';

  // Méta (édition)
  postedByLabel = '';
  lastModifiedAt = '';
  applicationsTotal = 0;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.offerId = id;
      this.loadingOffer = true;
      this.api
        .get(id)
        .pipe(finalize(() => (this.loadingOffer = false)))
        .subscribe({
          next: ({ offer }) => this.fillForm(offer),
          error: () => {
            this.errorMsg = 'Impossible de charger cette offre.';
          },
        });
    } else {
      // Défauts : publication aujourd'hui, fin dans 30 jours.
      const now = new Date();
      this.publishDate = this.toIso(now);
      this.deadline = this.toIso(new Date(now.getTime() + 30 * 86400000));
    }
  }

  private fillForm(o: AdminOffer): void {
    this.name = o.name;
    this.partner = o.partner;
    this.companyLogo = o.companyLogo;
    this.city = o.city;
    this.workMode = o.workMode;
    this.openings = o.openings || 1;
    this.status = o.status;
    this.publishDate = o.publishDate ? String(o.publishDate).slice(0, 10) : '';
    this.deadline = o.deadline ? String(o.deadline).slice(0, 10) : '';
    this.description = o.description;
    this.skills = [...o.skills];
    this.country =
      this.allCountries.find((c) => c.code === o.country?.code) ||
      (o.country?.name ? { code: o.country.code, name: o.country.name } : null);
    this.postedByLabel = o.postedBy?.label || '';
    this.lastModifiedAt = o.lastModifiedAt || '';
    this.applicationsTotal = o.applications?.total || 0;
  }

  private toIso(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // ---------- pays ----------

  get filteredCountries(): CountryOption[] {
    const q = this.norm(this.countryQuery);
    const list = this.allCountries;
    if (!q) return list;
    return list.filter((c) => this.norm(c.name).includes(q) || c.code.toLowerCase() === q);
  }

  private norm(s: string): string {
    return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  /** Options de statut — « Clôturée » masquée à la création. */
  get visibleStatusOptions() {
    return this.isEdit ? this.statusOptions : this.statusOptions.filter((o) => o.value !== 'closed');
  }

  get statusOption() {
    return this.statusOptions.find((o) => o.value === this.status) || this.statusOptions[0];
  }

  pickStatus(s: OfferStatus): void {
    this.status = s;
    this.statusOpen = false;
  }

  openCountry(): void {
    this.countryOpen = true;
    this.countryActive = 0;
  }

  /** Clic sur le champ : ouvre la liste ; un pays affiché repasse en recherche. */
  onCountryBoxClick(): void {
    if (this.countryOpen) return;
    this.countryOpen = true;
    this.countryActive = 0;
    setTimeout(() => this.countryInput?.nativeElement.focus());
  }

  toggleCountry(): void {
    this.countryOpen = !this.countryOpen;
    if (this.countryOpen) {
      this.countryActive = 0;
      setTimeout(() => this.countryInput?.nativeElement.focus());
    }
  }

  pickCountry(c: CountryOption): void {
    this.country = c;
    this.countryQuery = '';
    this.countryOpen = false;
  }

  clearCountry(): void {
    this.country = null;
    this.countryQuery = '';
    setTimeout(() => this.countryInput?.nativeElement.focus());
  }

  onCountryKey(ev: KeyboardEvent): void {
    const list = this.filteredCountries;
    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      this.countryOpen = true;
      if (list.length) this.countryActive = (this.countryActive + 1) % list.length;
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      if (list.length) this.countryActive = (this.countryActive - 1 + list.length) % list.length;
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      const c = list[this.countryActive];
      if (this.countryOpen && c) this.pickCountry(c);
    } else if (ev.key === 'Escape') {
      this.countryOpen = false;
    }
  }

  // ---------- ville ----------

  /** Villes suggérées — filtrées par ce que l'utilisateur tape. */
  get filteredCities(): string[] {
    const base = this.country ? CITIES_BY_COUNTRY[this.country.code] || [] : [];
    const q = this.norm(this.city);
    if (!q) return base;
    return base.filter((c) => this.norm(c).includes(q));
  }

  get hasCitySuggestions(): boolean {
    return !!this.country && (CITIES_BY_COUNTRY[this.country.code] || []).length > 0;
  }

  openCity(): void {
    if (this.hasCitySuggestions) {
      this.cityOpen = true;
      this.cityActive = 0;
    }
  }

  pickCity(c: string): void {
    this.city = c;
    this.cityOpen = false;
  }

  onCityKey(ev: KeyboardEvent): void {
    const list = this.filteredCities;
    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      this.cityOpen = this.hasCitySuggestions;
      if (list.length) this.cityActive = (this.cityActive + 1) % list.length;
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      if (list.length) this.cityActive = (this.cityActive - 1 + list.length) % list.length;
    } else if (ev.key === 'Enter') {
      if (this.cityOpen && list[this.cityActive]) {
        ev.preventDefault();
        this.pickCity(list[this.cityActive]);
      }
    } else if (ev.key === 'Escape') {
      this.cityOpen = false;
    }
  }

  @HostListener('document:click', ['$event'])
  onDocClick(ev: Event): void {
    const t = ev.target as HTMLElement;
    if (!t.closest('.aof-country')) this.countryOpen = false;
    if (!t.closest('.aof-city')) this.cityOpen = false;
    if (!t.closest('.aof-status')) this.statusOpen = false;
  }

  // ---------- logo ----------

  onLogoFile(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.logoError = '';
    this.logoUploading = true;
    this.api
      .uploadLogo(file)
      .pipe(finalize(() => (this.logoUploading = false)))
      .subscribe({
        next: ({ url }) => {
          this.companyLogo = url;
        },
        error: () => {
          this.logoError = 'Image refusée (JPEG/PNG/WebP, 2 Mo max).';
        },
      });
    input.value = '';
  }

  removeLogo(): void {
    this.companyLogo = '';
  }

  // ---------- postes ----------

  bumpOpenings(delta: number): void {
    this.openings = Math.min(500, Math.max(1, this.openings + delta));
  }

  /** Saisie directe dans le stepper — clamp 1..500 au blur / entrée non numérique. */
  onOpeningsInput(ev: Event): void {
    const v = parseInt((ev.target as HTMLInputElement).value, 10);
    this.openings = Number.isFinite(v) ? Math.min(500, Math.max(1, v)) : 1;
  }

  // ---------- compétences ----------

  addSkill(raw?: string): void {
    const v = (raw ?? this.skillDraft).trim();
    if (!v) return;
    if (!this.skills.some((s) => s.toLowerCase() === v.toLowerCase())) {
      this.skills.push(v);
    }
    this.skillDraft = '';
    this.suggestedSkills = this.suggestedSkills.filter((s) => s !== v);
  }

  onSkillKey(ev: KeyboardEvent): void {
    if (ev.key === 'Enter' || ev.key === ',') {
      ev.preventDefault();
      this.addSkill();
    } else if (ev.key === 'Backspace' && !this.skillDraft && this.skills.length) {
      this.skills.pop();
    }
  }

  removeSkill(s: string): void {
    this.skills = this.skills.filter((x) => x !== s);
  }

  suggestSkills(): void {
    if (!this.name && !this.description) {
      this.skillsError = 'Renseigne le titre ou la description d\u2019abord.';
      return;
    }
    this.skillsError = '';
    this.skillsLoading = true;
    this.api
      .suggestSkills({ title: this.name, description: this.description })
      .pipe(finalize(() => (this.skillsLoading = false)))
      .subscribe({
        next: ({ skills }) => {
          this.suggestedSkills = skills.filter(
            (s) => !this.skills.some((x) => x.toLowerCase() === s.toLowerCase()),
          );
          if (!this.suggestedSkills.length) {
            this.skillsError = 'Aucune nouvelle suggestion.';
          }
        },
        error: () => {
          this.skillsError = 'Suggestion impossible pour le moment.';
        },
      });
  }

  // ---------- IA description ----------

  generateDescription(): void {
    this.aiError = '';
    this.aiLoading = true;
    this.api
      .generateDescription({
        title: this.name,
        partner: this.partner,
        country: this.country?.name,
        city: this.city,
        workMode: this.workMode,
        skills: this.skills,
        prompt: this.aiPrompt,
      })
      .pipe(finalize(() => (this.aiLoading = false)))
      .subscribe({
        next: ({ description }) => {
          this.description = description;
          this.aiPanelOpen = false;
        },
        error: (err) => {
          this.aiError = err?.error?.message || 'Génération impossible pour le moment.';
        },
      });
  }

  // ---------- soumission ----------

  get isEdit(): boolean {
    return !!this.offerId;
  }

  validate(): boolean {
    const e: Record<string, string> = {};
    if (!this.name.trim()) e['name'] = 'Le titre du poste est requis.';
    if (!this.partner.trim()) e['partner'] = 'L\u2019entreprise est requise.';
    if (this.publishDate && this.deadline && this.deadline < this.publishDate) {
      e['deadline'] = 'La date de fin doit être après la publication.';
    }
    this.fieldErrors = e;
    return Object.keys(e).length === 0;
  }

  save(): void {
    if (!this.validate()) {
      this.errorMsg = 'Certains champs sont à corriger.';
      return;
    }
    this.errorMsg = '';
    this.saving = true;
    const payload = {
      name: this.name.trim(),
      partner: this.partner.trim(),
      companyLogo: this.companyLogo,
      description: this.description,
      country: this.country
        ? { code: this.country.code, name: this.country.name }
        : { code: '', name: '' },
      city: this.city.trim(),
      workMode: this.workMode,
      openings: this.openings,
      skills: this.skills,
      publishDate: this.publishDate || null,
      deadline: this.deadline || null,
      status: this.status,
    };
    const req$ = this.isEdit ? this.api.update(this.offerId, payload) : this.api.create(payload);
    req$.pipe(finalize(() => (this.saving = false))).subscribe({
      next: () => {
        void this.router.navigate(['/admin/offers']);
      },
      error: (err) => {
        this.errorMsg = err?.error?.message || 'Enregistrement impossible.';
      },
    });
  }

  /** Aperçu « expire dans X j » à côté du picker. */
  get deadlineHint(): string {
    if (!this.deadline) return '';
    const diff = Math.ceil((new Date(this.deadline).getTime() - Date.now()) / 86400000);
    if (diff < 0) return 'Échéance déjà dépassée';
    if (diff === 0) return 'Expire aujourd\u2019hui';
    return `Expire dans ${diff} jour${diff > 1 ? 's' : ''}`;
  }

  get deadlineHintTone(): 'bad' | 'warn' | 'ok' {
    if (!this.deadline) return 'ok';
    const diff = Math.ceil((new Date(this.deadline).getTime() - Date.now()) / 86400000);
    if (diff < 0) return 'bad';
    if (diff <= 7) return 'warn';
    return 'ok';
  }

  modeLabel(m: OfferWorkMode): string {
    return m === 'remote' ? 'Remote' : m === 'hybrid' ? 'Hybride' : 'Sur site';
  }
}
