import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Position } from '../../../../models/position';
import { ActivatedRoute } from '@angular/router';
import { OfferService } from '../../../../services/offer.service';
import { PositionService } from '../../../../services/position.service';

@Component({
  selector: 'app-update-offer',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './update-offer.component.html',
  styleUrl: './update-offer.component.css'
})
export class UpdateOfferComponent {
  offerForm: FormGroup;
  positions: Position[] = [];
  offerId!: string;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private offerService: OfferService,
    private positionService: PositionService
  ){
    this.offerForm = this.fb.group({
      name: ['', Validators.required],
      partner: ['', Validators.required],
      description: [''],
      price: [0, [Validators.required, Validators.min(0)]],
      positions: this.fb.array([]),
    });
  }

  ngOnInit(){
    this.loadPositions();
    this.loadOffer();
  }

  loadPositions() {
    this.positionService.getPositions().subscribe((positions) => {
      this.positions = positions;
    });
  }

  loadOffer() {
    this.offerId = this.route.snapshot.paramMap.get('id')!;
    this.offerService.getOfferById(this.offerId).subscribe((offer) => {
      // Transform and patch form
      this.offerForm.patchValue({
        name: offer.name,
        partner: offer.partner,
        description: offer.description,
        price: offer.price,
      });
      const positionsArray = this.offerForm.get('positions') as FormArray;
      offer.positions.forEach((position) => {
        positionsArray.push(
          this.fb.group({
            positionId: position.positionId._id || position.positionId,
            candidatesNeeded: position.candidatesNeeded,
          })
        );
      });
    });
  }

  get positionControls() {
    return (this.offerForm.get('positions') as FormArray)?.controls || [];
  }

  addPosition() {
    const positionsArray = this.offerForm.get('positions') as FormArray;
    positionsArray.push(
      this.fb.group({
        positionId: ['', Validators.required],
        candidatesNeeded: [0, Validators.required]
      })
    );
  }

  removePosition(index: number) {
    const positionsArray = this.offerForm.get('positions') as FormArray;
    positionsArray.removeAt(index);
  }

  onSubmit() {
    if (this.offerForm.valid) {
      this.offerService.updateOffer(this.offerId, this.offerForm.value).subscribe(() => {
        console.log('Offer updated successfully');
      });
    }
  }
}
