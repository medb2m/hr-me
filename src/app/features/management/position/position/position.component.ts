import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { PositionService } from '../../../../services/position.service';
import { Position } from '../../../../models/position';

@Component({
  selector: 'app-position',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule
  ],
  templateUrl: './position.component.html',
  styleUrl: './position.component.css'
})
export class PositionComponent {
  positionForm: FormGroup;
  positions: Position[] = [];  // Array to hold fetched positions

  constructor(private fb: FormBuilder, private positionService : PositionService) {
    this.positionForm = this.fb.group({
      name: ['', Validators.required],
    });
  }

  ngOnInit(): void {
    this.fetchPositions();  // Fetch positions on component initialization
  }

  // Fetch positions from the server
  fetchPositions(): void {
    this.positionService.getPositions().subscribe((data) => {
      this.positions = data; // Store the fetched positions
      console.log('Fetched positions:', this.positions);
    });
  }

  onSubmit() {
    if (this.positionForm.valid) {
      this.positionService.createPosition(this.positionForm.value).subscribe(data =>{
        console.log('Positions added :', data);
        this.fetchPositions(); // Refresh the list of positions after adding
      })
    } else {
      console.log('Form is invalid');
    }
  }

}
