import { Component } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { CandidateService } from '../../../services/candidate.service';
import { CommonModule } from '@angular/common';
import { PositionService } from '../../../services/position.service';
import { Position } from '../../../models/position';

@Component({
  selector: 'app-add-candidate',
  standalone: true,
  imports: [ReactiveFormsModule,CommonModule, FormsModule],
  templateUrl: './add-candidate.component.html',
  styleUrl: './add-candidate.component.css'
})
export class AddCandidateComponent {
  candidateForm: FormGroup;

  selectedFile: File | null = null;

  selectedPositionId : string = '';

  positions : Position[] = []

  constructor(
    private fb: FormBuilder,
    private candidateService: CandidateService,
    private positionService: PositionService
  ) {
    this.candidateForm = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', Validators.required],
      passportNumber: ['', Validators.required],
      cin: ['', Validators.required],
      position: [''],
      status: ['waiting'],
      experience: [0],
      //skills: this.fb.array([]),
      skills: new FormControl([]),
    });
  }

  ngOnInit(){
    this.positionService.getPositions().subscribe((data) => {
      this.positions = data 
      console.log(this.positions)
    })
  }

  // Handle file selection
  onFileSelect(event: Event): void {
    const fileInput = event.target as HTMLInputElement;
    if (fileInput.files) {
      this.selectedFile = fileInput.files[0];
    }
  }

  // Submit form data
  onSubmit() {
    if (this.candidateForm.valid) {
      /* const candidateData: Candidate = this.candidateForm.value;
      console.log('Candidate Data:', candidateData);
      this.candidateService.addCandidate(candidateData).subscribe(()=>{
        console.log('added')
      }) */
        const formData = new FormData();
        const candidateData = this.candidateForm.value;
  
        // Append form fields to FormData
        Object.keys(candidateData).forEach(key => {
          formData.append(key, candidateData[key]);
        });
  
        // Append file if selected
        if (this.selectedFile) {
          formData.append('image', this.selectedFile);
        }
  
        // Call service to add candidate
        this.candidateService.addCandidate(formData).subscribe(
          () => console.log('Candidate added successfully'),
          error => console.error('Error adding candidate:', error)
        );
    } else {
      console.log('Form is invalid');
    }
  }
}
