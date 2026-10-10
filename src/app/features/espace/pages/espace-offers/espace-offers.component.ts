import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import {
  LucideBanknote,
  LucideBriefcase,
  LucideBuilding2,
  LucideCheck,
  LucideClock,
  LucideImage,
  LucideMapPin,
  LucideTimer,
} from '@lucide/angular';
import { OfferService, PublicOffer } from '../../../../services/offer.service';
import { FlagComponent } from '../../../../shared/components/flag/flag.component';

/** Catalogue public — vraies offres publiées (remplace la liste statique). */
@Component({
  selector: 'app-espace-offers',
  imports: [
    CommonModule,
    RouterLink,
    FlagComponent,
    LucideBanknote,
    LucideBriefcase,
    LucideBuilding2,
    LucideCheck,
    LucideClock,
    LucideImage,
    LucideMapPin,
    LucideTimer,
  ],
  templateUrl: './espace-offers.component.html',
  styleUrl: './espace-offers.component.css',
})
export class EspaceOffersComponent implements OnInit {
  private readonly offerService = inject(OfferService);

  offers: PublicOffer[] = [];
  loading = false;
  errorMsg = '';
  activeFilter = 'Tous';

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

  /** Filtres pays — construits depuis les offres réellement publiées. */
  get filters(): string[] {
    const countries = [...new Set(this.offers.map((o) => o.country.name).filter(Boolean))];
    return ['Tous', ...countries];
  }

  filtered(): PublicOffer[] {
    if (this.activeFilter === 'Tous') return this.offers;
    return this.offers.filter((o) => o.country.name === this.activeFilter);
  }

  /** Tags affichés : secteur + premières compétences. */
  tags(o: PublicOffer): string[] {
    return [o.sector, ...o.skills.slice(0, 3)].filter(Boolean);
  }

  deadlineLabel(o: PublicOffer): string {
    if (o.daysLeft === null) return '';
    if (o.daysLeft === 0) return 'Dernier jour';
    return `J-${o.daysLeft}`;
  }
}
