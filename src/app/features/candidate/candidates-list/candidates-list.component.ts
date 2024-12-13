import { Component } from '@angular/core';
import { Candidate } from '../../../models/candidate';
import { CandidateService } from '../../../services/candidate.service';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';


@Component({
  selector: 'app-candidates-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './candidates-list.component.html',
  styleUrl: './candidates-list.component.css'
})
export class CandidatesListComponent {
  candidates: Candidate[] = [];
  filteredCandidates: Candidate[] = [];
  searchTerm: string = '';

  constructor(private candidateService: CandidateService, private router: Router) {}

  ngOnInit(): void {
    this.loadCandidates();
  }

  loadCandidates(): void {
    this.candidateService.getCandidates().subscribe({
      next: (data) => {
        this.candidates = data;
        this.filteredCandidates = data; // Initialize filtered candidates
      },
      error: (err) => console.error(err),
    });
  }

  filterCandidates(): void {
    const term = this.searchTerm.toLowerCase();
    this.filteredCandidates = this.candidates.filter(
      (candidate) =>
        candidate.name.toLowerCase().includes(term) ||
        candidate.phone.includes(term) ||
        candidate.passportNumber.toLowerCase().includes(term)
    );
  }

  viewCandidate(candidate: Candidate): void {
    this.router.navigate(['/candidate-dossier', candidate._id]);
  }
}
