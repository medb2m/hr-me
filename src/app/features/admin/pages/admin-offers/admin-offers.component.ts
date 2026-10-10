import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import {
  LucideBriefcase,
  LucideBuilding2,
  LucideCalendar,
  LucideChevronLeft,
  LucideChevronRight,
  LucideClock,
  LucideEye,
  LucideLaptop,
  LucidePencil,
  LucidePlus,
  LucideRefreshCw,
  LucideSearch,
  LucideTimer,
  LucideTrash2,
  LucideUserCheck,
  LucideUsers,
  LucideWifi,
  LucideX,
} from '@lucide/angular';
import {
  AdminOffer,
  AdminOffersApiService,
  OfferCounters,
  OfferStatusFilter,
  OfferWorkMode,
} from '../../services/admin-offers-api.service';
import { COUNTRIES, flagEmoji } from '../../../../shared/data/countries.data';

type SortKey = 'recent' | 'deadline' | 'name';

@Component({
  selector: 'app-admin-offers',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    LucideBriefcase,
    LucideBuilding2,
    LucideCalendar,
    LucideChevronLeft,
    LucideChevronRight,
    LucideClock,
    LucideEye,
    LucideLaptop,
    LucidePencil,
    LucidePlus,
    LucideRefreshCw,
    LucideSearch,
    LucideTimer,
    LucideTrash2,
    LucideUserCheck,
    LucideUsers,
    LucideWifi,
    LucideX,
  ],
  templateUrl: './admin-offers.component.html',
  styleUrl: './admin-offers.component.css',
})
export class AdminOffersComponent implements OnInit {
  private readonly api = inject(AdminOffersApiService);

  offers: AdminOffer[] = [];
  total = 0;
  page = 1;
  pages = 1;
  readonly limit = 10;
  counters: OfferCounters = {
    total: 0,
    published: 0,
    draft: 0,
    closed: 0,
    expired: 0,
    applications: 0,
  };

  statusFilter: OfferStatusFilter = '';
  modeFilter: '' | OfferWorkMode = '';
  countryFilter = '';
  sort: SortKey = 'recent';
  search = '';

  readonly countries = COUNTRIES;
  loading = false;
  errorMsg = '';
  expandedId = '';
  deletingId = '';
  confirmDeleteId = '';

  ngOnInit(): void {
    this.load();
  }

  load(page = 1): void {
    this.loading = true;
    this.errorMsg = '';
    this.api
      .list({
        page,
        limit: this.limit,
        status: this.statusFilter,
        mode: this.modeFilter,
        country: this.countryFilter,
        sort: this.sort,
        q: this.search,
      })
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (r) => {
          this.offers = r.offers;
          this.total = r.total;
          this.page = r.page;
          this.pages = r.pages;
          this.counters = r.counters;
        },
        error: () => {
          this.errorMsg = 'Impossible de charger les offres.';
        },
      });
  }

  applyFilters(): void {
    this.load(1);
  }

  setStatus(f: OfferStatusFilter): void {
    this.statusFilter = f;
    this.applyFilters();
  }

  clearSearch(): void {
    this.search = '';
    this.applyFilters();
  }

  resetFilters(): void {
    this.statusFilter = '';
    this.modeFilter = '';
    this.countryFilter = '';
    this.sort = 'recent';
    this.search = '';
    this.applyFilters();
  }

  prevPage(): void {
    if (this.page > 1) this.load(this.page - 1);
  }

  nextPage(): void {
    if (this.page < this.pages) this.load(this.page + 1);
  }

  toggleExpand(o: AdminOffer): void {
    this.expandedId = this.expandedId === o.id ? '' : o.id;
  }

  askDelete(o: AdminOffer): void {
    this.confirmDeleteId = o.id;
  }

  cancelDelete(): void {
    this.confirmDeleteId = '';
  }

  doDelete(o: AdminOffer): void {
    this.deletingId = o.id;
    this.api
      .delete(o.id)
      .pipe(finalize(() => (this.deletingId = '')))
      .subscribe({
        next: () => {
          this.confirmDeleteId = '';
          this.offers = this.offers.filter((x) => x.id !== o.id);
          this.total -= 1;
          if (this.offers.length === 0 && this.page > 1) {
            this.load(this.page - 1);
          } else {
            this.load(this.page);
          }
        },
        error: () => {
          this.errorMsg = 'Suppression impossible.';
        },
      });
  }

  // ---------- helpers d'affichage ----------

  flag(code: string): string {
    return flagEmoji(code);
  }

  modeLabel(m: OfferWorkMode): string {
    return m === 'remote' ? 'Remote' : m === 'hybrid' ? 'Hybride' : 'Sur site';
  }

  statusLabel(o: AdminOffer): string {
    if (o.isExpired) return 'Expirée';
    return o.status === 'draft' ? 'Brouillon' : o.status === 'closed' ? 'Clôturée' : 'Publiée';
  }

  /** Badge échéance : « J-x » si proche (≤ 15 j), « Expirée » si passée. */
  deadlineBadge(o: AdminOffer): string {
    if (o.daysLeft === null) return '';
    if (o.daysLeft < 0) return 'Expirée';
    if (o.daysLeft === 0) return 'Dernier jour';
    if (o.daysLeft === 1) return 'Expire demain';
    return `J-${o.daysLeft}`;
  }

  deadlineTone(o: AdminOffer): 'expired' | 'soon' | 'ok' | '' {
    if (o.daysLeft === null) return '';
    if (o.daysLeft < 0) return 'expired';
    if (o.daysLeft <= 7) return 'soon';
    return 'ok';
  }

  fmtDate(d: string | null): string {
    if (!d) return '—';
    const dt = new Date(d);
    return Number.isNaN(dt.getTime())
      ? '—'
      : dt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  fmtDateTime(d: string | null): string {
    if (!d) return '—';
    const dt = new Date(d);
    return Number.isNaN(dt.getTime())
      ? '—'
      : dt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) +
          ' ' +
          dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  trackById(_i: number, o: AdminOffer): string {
    return o.id;
  }
}
