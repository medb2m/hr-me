import { Component } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { CandidateService } from '../../../services/candidate.service';
import { CommonModule } from '@angular/common';
import { PositionService } from '../../../services/position.service';
import { Position } from '../../../models/position';
import { Skill } from '../../../models/skill';
import { SkillService } from '../../../services/skill.service';

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

  uploadedImage: string | null = null; 

  suggestedSkills: Skill[] = [];
  selectedSkills: Skill[] = [];

  constructor(
    private fb: FormBuilder,
    private candidateService: CandidateService,
    private positionService: PositionService,
    private skillService: SkillService
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
      skills: [[]],
      skillSearch: new FormControl(''), // FormControl for search
    });
  }

  ngOnInit(){
    this.positionService.getPositions().subscribe((data) => {
      this.positions = data 
      console.log(this.positions)
    })
  }

  // Handle file selection
  /* onFileSelect(event: Event): void {
    const fileInput = event.target as HTMLInputElement;
    if (fileInput.files) {
      this.selectedFile = fileInput.files[0];
    }
  } */

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
    Object.keys(candidateData).forEach((key) => {
      if (key !== 'skills') {
        formData.append(key, candidateData[key]);
      }
    });
    // Append the skills array as a JSON string
    formData.append('skills', JSON.stringify(this.selectedSkills.map(skill => skill._id)));
  
        // Append file if selected
        if (this.selectedFile) {
          formData.append('image', this.selectedFile);
        }
  
        // Call service to add candidate
        this.candidateService.addCandidate(formData).subscribe(
          () => console.log('Candidate added successfully'),
          error => console.error('Error adding candidate:', error)
        );
        alert('Candidate added successfully!');
        this.resetForm();
    } else {
      console.log('Form is invalid');
    }
  }

  // Trigger file input programmatically
  triggerFileInput(): void {
    const fileInput = document.getElementById('image') as HTMLInputElement;
    fileInput.click();
  }

  // Reset the form and image preview
  resetForm(): void {
    this.candidateForm.reset();
    this.uploadedImage = null;
    this.selectedFile = null;

    // Reset status to default value
    this.candidateForm.patchValue({ status: 'waiting' });
  }

  // Handle file selection
  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      this.selectedFile = file;

      // Validate file type (e.g., only images allowed)
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
      if (!allowedTypes.includes(file.type)) {
        alert('Please upload a valid image file (JPEG or PNG).');
        return;
      }

      // Validate file size (e.g., max 2MB)
      const maxSizeInBytes = 2 * 1024 * 1024; // 2MB
      if (file.size > maxSizeInBytes) {
        alert('File size exceeds the 2MB limit.');
        return;
      }

      // Convert image to base64 for preview
      const reader = new FileReader();
      reader.onload = () => {
        this.uploadedImage = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  // Remove the uploaded file and reset preview
  removeUploadedFile(): void {
    this.uploadedImage = null;
    this.selectedFile = null;

    // Reset the file input value to allow re-upload of the same file if needed
    const fileInput = document.getElementById('image') as HTMLInputElement;
    fileInput.value = '';
  }

  searchTerm: string = '';

  // Fetch suggestions from backend
  onSearch(): void {
    const searchTerm = this.candidateForm.get('skillSearch')?.value || '';
    if (searchTerm.trim()) {
      this.skillService.getAllSkills().subscribe((skills) => {
        this.suggestedSkills = skills.filter(skill =>
          skill.name.toLowerCase().includes(this.searchTerm.toLowerCase())
        );
      });
    } else {
      this.suggestedSkills = [];
    }
  }

  // Add skill from suggestion or input
  addSkill(event: Event): void {
    event.preventDefault();
    const searchTerm = this.candidateForm.get('skillSearch')?.value || '';
    const newSkill = this.suggestedSkills.find(skill => skill.name === searchTerm);
    if (newSkill) {
      this.addSkillFromSuggestion(newSkill);
    } else if (searchTerm.trim()) {
      const newCustomSkill = { _id: '', name: searchTerm };
      this.addSkillFromSuggestion(newCustomSkill);
    }
    this.candidateForm.get('skillSearch')?.setValue('');
    this.suggestedSkills = [];
  }

  // Add skill from suggestion
  addSkillFromSuggestion(skill: Skill): void {
    if (!this.selectedSkills.some(s => s.name === skill.name)) {
      this.selectedSkills.push(skill);
      this.updateFormSkills();
    }
  }

  // Remove skill
  removeSkill(skill: Skill): void {
    this.selectedSkills = this.selectedSkills.filter(s => s._id !== skill._id);
    this.updateFormSkills();
  }

  // Sync skills to form
  updateFormSkills(): void {
    this.candidateForm.patchValue({
      skills: this.selectedSkills.map(skill => skill._id),
    });
  }
}
