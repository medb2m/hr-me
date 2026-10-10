import { Component } from '@angular/core';
import { LucideBriefcase } from '@lucide/angular';
import { OffersCatalogComponent } from '../../../../shared/components/offers-catalog/offers-catalog.component';

/** Espace candidat — catalogue des offres publiées (même moteur que l'espace client). */
@Component({
  selector: 'app-client-offers',
  imports: [OffersCatalogComponent, LucideBriefcase],
  templateUrl: './client-offers.component.html',
  styleUrl: './client-offers.component.css',
})
export class ClientOffersComponent {}
