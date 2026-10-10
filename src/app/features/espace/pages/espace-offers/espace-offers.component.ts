import { Component } from '@angular/core';
import {
  LucideBriefcase,
  LucideImage,
} from '@lucide/angular';
import { OffersCatalogComponent } from '../../../../shared/components/offers-catalog/offers-catalog.component';

/** Catalogue public — vraies offres publiées (remplace la liste statique). */
@Component({
  selector: 'app-espace-offers',
  imports: [
    OffersCatalogComponent,
    LucideBriefcase,
    LucideImage,
  ],
  templateUrl: './espace-offers.component.html',
  styleUrl: './espace-offers.component.css',
})
export class EspaceOffersComponent {}
