import { Component } from '@angular/core';
import { Candidate } from '../../../models/candidate';
import { FormArray, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CandidateService } from '../../../services/candidate.service';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FilePreviewComponent } from '../file-preview/file-preview.component';

@Component({
  selector: 'app-dossier',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule/* , FilePreviewComponent */],
  templateUrl: './dossier.component.html',
  styleUrl: './dossier.component.css'
})
export class DossierComponent {
  selectedCandidate?: Candidate;
  uploadedFiles: File[] = [];
  fileTypes: string[] = [];
  fileTypesOptions = ['passport', 'cv', 'diploma', 'other'];

  constructor(
    private candidateService: CandidateService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    const candidateId = this.route.snapshot.paramMap.get('id');
    if (candidateId) {
      this.loadCandidate(candidateId);
    }
  }

  loadCandidate(candidateId: string): void {
    this.candidateService.getCandidateById(candidateId).subscribe({
      next: (data) => {
        this.selectedCandidate = data;

        // Fetch dossier details for the candidate
        this.candidateService.getCandidateDossier(candidateId).subscribe({
          next: (dossier) => {
            this.selectedCandidate!.dossier = dossier;
          },
          error: (err) => console.error('Error fetching dossier:', err),
        });
      },
      error: (err) => console.error('Error loading candidate:', err),
    });
  }
    
    // Handle file input change
  onFileChange(event: any): void {
    const files = Array.from(event.target.files) as File[];
    files.forEach((file) => {
      this.uploadedFiles.push(file);
      this.fileTypes.push(''); // Initialize file type as empty
    });
  }

  // Remove a file from the list
  removeFile(index: number): void {
    this.uploadedFiles.splice(index, 1);
    this.fileTypes.splice(index, 1);
  }
  
  // Submit dossier
  updateDossier(): void {
    if (!this.selectedCandidate || this.uploadedFiles.length === 0) return;

    const formData = new FormData();
    this.uploadedFiles.forEach((file, index) => {
      formData.append('files', file);
      formData.append(`fileTypes[${index}]`, this.fileTypes[index]);
    });

    this.candidateService.updateCandidateDossier(this.selectedCandidate._id, formData).subscribe({
      next: (updatedCandidate) => {
        this.selectedCandidate = updatedCandidate;
        this.uploadedFiles = [];
        this.fileTypes = [];
        alert('Dossier updated successfully!');
      },
      error: (err) => console.error('Error updating dossier:', err),
    });
  }

  openFile(fileUrl: string): void {
    window.open(fileUrl, '_blank');
  }


  // file preview
  selectedFile: { filename: string; filepath: string; fileType: string } | null = null;

  previewFile(file: { filename: string; filepath: string; fileType: string }): void {
    console.log('Previewing file:', file);
    this.selectedFile = file;
  }

  

  closePreview(): void {
    this.selectedFile = null;
  }
}
