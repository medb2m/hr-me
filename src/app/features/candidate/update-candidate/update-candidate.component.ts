import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { CandidateService } from '../../../services/candidate.service';
import { PositionService } from '../../../services/position.service';
import { ActivatedRoute } from '@angular/router';
import { Position } from '../../../models/position';
import { Skill } from '../../../models/skill';
import { SkillService } from '../../../services/skill.service';

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

  uploadedImage: string | null = null; // For image preview
  imageError: string | null = null; // To display upload errors

  currentImage: string = ''

  // skills 
  suggestedSkills: Skill[] = [];
  selectedSkills: Skill[] = [];

  constructor(
    private fb: FormBuilder,
    private candidateService: CandidateService,
    private positionService: PositionService,
    private route: ActivatedRoute,
    private skillService: SkillService
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

      if(candidate.image){this.currentImage = candidate.image}
      

      // Patch the form with transformed data
      this.candidateForm.patchValue(transformedCandidate);
    });
  }

  

  // Submit updated Data 
  onSubmit(){
    if (this.candidateForm.valid){
      const formData = new FormData();
      const candidateData = this.candidateForm.value;

       // Append form fields to FormData
    /* Object.keys(candidateData).forEach((key) => {
      const value = candidateData[key];
      if (value !== null && value !== undefined) {
        if (key === 'skills' && this.candidateForm.value.skills[0] != '') {
          // Convert array to a comma-separated string if needed
          console.log(value);
          const formattedValue = value.join(', ');
          console.log('hello'+formattedValue);
          formData.append(key, value.join(','));
        } else if (typeof value === 'object' && key !== 'position' && key !== 'offer') {
          // Serialize objects except `position` and `offer`
          formData.append(key, JSON.stringify(value));
        } else {
          formData.append(key, value);
        }
      }
    }); */
    Object.keys(candidateData).forEach((key) => {
      if (key !== 'skills') {
        formData.append(key, candidateData[key]);
      }
    });

    formData.append('skills', JSON.stringify(this.selectedSkills.map(skill => skill._id)));

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
    }
  }

  triggerFileInput(): void {
    const fileInput = document.getElementById('image') as HTMLInputElement;
    fileInput.click();
  }

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      this.selectedFile = file;

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
      if (!allowedTypes.includes(file.type)) {
        alert('Please upload a valid image file (JPEG or PNG).');
        return;
      }

      // Validate file size
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

  removeUploadedFile(): void {
    this.uploadedImage = null;
    this.selectedFile = null;

    const fileInput = document.getElementById('image') as HTMLInputElement;
    fileInput.value = '';
  }

  // skills 
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
