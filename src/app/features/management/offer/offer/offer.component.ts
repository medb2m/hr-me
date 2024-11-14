import { Component } from '@angular/core';
import { Offer } from '../../../../models/offer';
import { ActivatedRoute } from '@angular/router';
import { OfferService } from '../../../../services/offer.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-offer',
  standalone: true,
  imports: [
    CommonModule
  ],
  templateUrl: './offer.component.html',
  styleUrl: './offer.component.css'
})
export class OfferComponent {
  offer?: Offer;

  constructor(
    private route: ActivatedRoute,
    private offerService: OfferService
  ) {}

  ngOnInit(): void {
    const offerId = this.route.snapshot.paramMap.get('id');
    if (offerId) {
      this.offerService.getOfferById(offerId).subscribe((offer) => {
        this.offer = offer;
      });
    }
  }
}
