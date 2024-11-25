import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { CandidateService } from '../../../services/candidate.service';
import { PositionService } from '../../../services/position.service';
import { ActivatedRoute } from '@angular/router';
import { Position } from '../../../models/position';

@Component({
  selector: 'app-update-candidate',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, FormsModule],
  templateUrl: './update-candidate.component.html',
  styleUrl: './update-candidate.component.css'
})
export class UpdateCandidateComponent {
  candidateForm: FormGroup;
  candidateId!: string;
  positions: Position[] = [];
  selectedFile: File | null = null;

  constructor(
    private fb: FormBuilder,
    private candidateService: CandidateService,
    private positionService: PositionService,
    private route: ActivatedRoute
  ) {
    this.candidateForm = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.pattern(/^[0-9]{8}$/)]],
      passportNumber: ['', Validators.required],
      cin: ['', Validators.required],
      position: [null],
      offer: [null],
      status: ['waiting'],
      experience: [0, Validators.min(0)],
      skills: [[]],
      image: ['']
    })
  }

  ngOnInit(){
    // Fetch candidate ID from route
    this.candidateId = this.route.snapshot.paramMap.get('id')!;
    this.loadCandidate();

    this.positionService.getPositions().subscribe((data) => {
      this.positions = data;
    });
  }

  loadCandidate(){
    this.candidateService.getCandidateById(this.candidateId).subscribe((candidate) => {
      console.log("hello")
      console.log(candidate)
      // Transform backend response to fit the form structure if necessary
      const transformedCandidate = {
        name: candidate.name || '',
        email: candidate.email || '',
        phone: candidate.phone?.toString() || '', // Ensure phone is a string
        passportNumber: candidate.passportNumber || '',
        cin: candidate.cin || '',
        position: candidate.position?._id || null, // Position object
        offers: candidate.offers || null, 
        //offer: candidate.offer?._id || null,
        status: candidate.status || 'waiting',
        experience: candidate.experience || 0,
        skills: candidate.skills || [],
        image: candidate.image || '',
      };

      // Patch the form with transformed data
      this.candidateForm.patchValue(transformedCandidate);
    });
  }

  // Handle file sleection
  onFileSelect(event: Event) : void {
    const fileInput = event.target as HTMLInputElement;
    if (fileInput.files){
      this.selectedFile = fileInput.files[0]
    }
  }
  private debugFormErrors() {
    Object.keys(this.candidateForm.controls).forEach((key) => {
      const control = this.candidateForm.get(key);
      if (control && control.invalid) {
        console.error(`Field "${key}" is invalid. Errors:`, control.errors);
      }
    });
  
    // Log the overall form status
    console.log('Form status:', this.candidateForm.status);
    console.log('Form controls:', this.candidateForm.controls);
  }

  // Submit updated Data 
  onSubmit(){
    if (this.candidateForm.valid){
      const formData = new FormData();
      const candidateData = this.candidateForm.value;

       // Append form fields to FormData
    Object.keys(candidateData).forEach((key) => {
      const value = candidateData[key];
      if (value !== null && value !== undefined) {
        if (key === 'skills') {
          // Convert array to a comma-separated string if needed
          formData.append(key, value.join(','));
        } else if (typeof value === 'object' && key !== 'position' && key !== 'offer') {
          // Serialize objects except `position` and `offer`
          formData.append(key, JSON.stringify(value));
        } else {
          formData.append(key, value);
        }
      }
    });

      // Append image if uploaded
      if (this.selectedFile){
        formData.append('image', this.selectedFile)
      }

      this.candidateService.updateCandidate(this.candidateId, formData).subscribe(
        () => console.log('candidate update succed'),
        (error) => console.error('error updating candidate: ', error)
      )
    } else {
      console.log('Form is invalid')
      this.debugFormErrors();
    }
  }
}
