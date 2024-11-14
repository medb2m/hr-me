import { Component } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Position } from '../../../../models/position';
import { OfferService } from '../../../../services/offer.service';
import { PositionService } from '../../../../services/position.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-add-offer',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule],
  templateUrl: './add-offer.component.html',
  styleUrl: './add-offer.component.css'
})
export class AddOfferComponent {
  offerForm: FormGroup;
  positions: Position[] = [];

  constructor(
    private fb: FormBuilder,
    private offerService: OfferService,
    private positionService: PositionService
  ) {
    // Initialize form group
    this.offerForm = this.fb.group({
      name: ['', Validators.required],
      partner: ['', Validators.required],
      description: [''],
      positions: this.fb.array([]) // form array for each position in the offer
    });

    this.loadPositions();
  }

  get positionControls() {
    return (this.offerForm.get('positions') as FormArray)?.controls || [];
  }

  loadPositions() {
    this.positionService.getPositions().subscribe((positions) => {
      this.positions = positions;
    });
  }

  // To add a new position entry
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
      this.offerService.createOffer(this.offerForm.value).subscribe(() => {
        console.log('Offer added successfully');
        this.offerForm.reset();
      });
    }
  }
}
