import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { OfferService } from '../../../../services/offer.service';
import { Offer } from '../../../../models/offer';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-list-offer',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink
  ],
  templateUrl: './list-offer.component.html',
  styleUrl: './list-offer.component.css'
})
export class ListOfferComponent {
  offers: Offer[] = [];

  constructor(private offerService: OfferService) {}

  ngOnInit(): void {
    this.loadOffers();
  }

  loadOffers() {
    this.offerService.getOffers().subscribe((offers) => {
      this.offers = offers;
    });
  }
}
