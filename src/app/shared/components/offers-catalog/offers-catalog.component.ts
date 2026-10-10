import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import {
  LucideBanknote,
  LucideBuilding2,
  LucideCheck,
  LucideChevronLeft,
  LucideChevronRight,
  LucideClock,
  LucideFlame,
  LucideLaptop,
  LucideMapPin,
  LucideRotateCcw,
  LucideSearch,
  LucideTimer,
  LucideWifi,
} from '@lucide/angular';
import { OfferService, PublicOffer } from '../../../services/offer.service';
import { FlagComponent } from '../flag/flag.component';

const PAGE_SIZE = 9;

type SortMode = 'recent' | 'deadline' | 'urgent';

/**
 * Catalogue des offres publiées — recherche, filtres pays/contrat/mode/urgent,
 * tri et pagination. `detailBase` = route de la page détail
 * (`/espace/offres` ou `/candidat/offres`).
 */
@Component({
  selector: 'app-offers-catalog',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    FlagComponent,
    LucideBanknote,
    LucideBuilding2,
    LucideCheck,
    LucideChevronLeft,
    LucideChevronRight,
    LucideClock,
    LucideFlame,
    LucideLaptop,
    LucideMapPin,
    LucideRotateCcw,
    LucideSearch,
    LucideTimer,
    LucideWifi,
  ],
  templateUrl: './offers-catalog.component.html',
  styleUrl: './offers-catalog.component.css',
})
export class OffersCatalogComponent implements OnInit {
  /** Préfixe de route vers la page détail (sans l'id). */
  @Input() detailBase = '/espace/offres';

  private readonly offerService = inject(OfferService);

  offers: PublicOffer[] = [];
  loading = false;
  errorMsg = '';

  search = '';
  countryFilter = 'Tous';
  contractFilter = '';
  modeFilter = '';
  urgentOnly = false;
  sort: SortMode = 'recent';
  page = 1;

  ngOnInit(): void {
    this.loading = true;
    this.offerService
      .getPublicOffers()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: ({ offers }) => {
          this.offers = offers;
        },
        error: () => {
          this.errorMsg = 'Impossible de charger les offres pour le moment.';
        },
      });
  }

  get countries(): string[] {
    return [...new Set(this.offers.map((o) => o.country.name).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, 'fr'),
    );
  }

  get contracts(): string[] {
    const base = (c: string) => c.split(' ')[0];
    return [...new Set(this.offers.map((o) => base(o.contract)).filter(Boolean))].sort();
  }

  contractBase(c: string): string {
    return c.split(' ')[0];
  }

  modeLabel(m: string): string {
    return m === 'remote' ? 'Remote' : m === 'hybrid' ? 'Hybride' : 'Sur site';
  }

  hasFilters(): boolean {
    return !!(
      this.search.trim() ||
      this.countryFilter !== 'Tous' ||
      this.contractFilter ||
      this.modeFilter ||
      this.urgentOnly
    );
  }

  resetFilters(): void {
    this.search = '';
    this.countryFilter = 'Tous';
    this.contractFilter = '';
    this.modeFilter = '';
    this.urgentOnly = false;
    this.sort = 'recent';
    this.page = 1;
  }

  onFilterChange(): void {
    this.page = 1;
  }

  filtered(): PublicOffer[] {
    const q = this.search.trim().toLowerCase();
    let list = this.offers.filter((o) => {
      if (q) {
        const hay = [o.name, o.partner, o.city, o.country.name, o.sector, ...o.skills]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (this.countryFilter !== 'Tous' && o.country.name !== this.countryFilter) return false;
      if (this.contractFilter && this.contractBase(o.contract) !== this.contractFilter) return false;
      if (this.modeFilter && o.workMode !== this.modeFilter) return false;
      if (this.urgentOnly && !o.urgent) return false;
      return true;
    });

    if (this.sort === 'deadline') {
      list = [...list].sort((a, b) => (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999));
    } else if (this.sort === 'urgent') {
      list = [...list].sort((a, b) => Number(b.urgent) - Number(a.urgent));
    } else {
      list = [...list].sort(
        (a, b) => new Date(b.publishDate || 0).getTime() - new Date(a.publishDate || 0).getTime(),
      );
    }
    return list;
  }

  totalPages(): number {
    return Math.max(1, Math.ceil(this.filtered().length / PAGE_SIZE));
  }

  pages(): number[] {
    return Array.from({ length: this.totalPages() }, (_, i) => i + 1);
  }

  paged(): PublicOffer[] {
    const p = Math.min(this.page, this.totalPages());
    return this.filtered().slice((p - 1) * PAGE_SIZE, p * PAGE_SIZE);
  }

  goTo(p: number): void {
    if (p < 1 || p > this.totalPages()) return;
    this.page = p;
    document.querySelector('.oc-body')?.scrollIntoView({ behavior: 'smooth' });
  }

  tags(o: PublicOffer): string[] {
    return [o.sector, ...o.skills].filter(Boolean).slice(0, 4);
  }

  deadlineLabel(o: PublicOffer): string {
    if (o.daysLeft === null) return '';
    if (o.daysLeft === 0) return 'Dernier jour';
    return `J-${o.daysLeft}`;
  }

  trackById(_i: number, o: PublicOffer): string {
    return o.id;
  }
}
