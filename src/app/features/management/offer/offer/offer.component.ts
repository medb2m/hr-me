import { Component } from '@angular/core';
import { Offer } from '../../../../models/offer';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { OfferService } from '../../../../services/offer.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApplicationService } from '../../../../services/application.service';
import { CandidateService } from '../../../../services/candidate.service';
import { Candidate } from '../../../../models/candidate';
import { Application } from '../../../../models/application';

@Component({
  selector: 'app-offer',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink
  ],
  templateUrl: './offer.component.html',
  styleUrl: './offer.component.css'
})
export class OfferComponent {
  offer?: Offer;
  offerId!: string;

  candidates : Candidate[] = []
  offerCandidates : Candidate[] = []
  filteredCandidates: Candidate[] = [];

  searchQuery: string = '';


  constructor(
    private route: ActivatedRoute,
    private offerService: OfferService,
    private applicationService: ApplicationService,
    private candidateService: CandidateService
  ) {}

  ngOnInit(): void {
    this.offerId = this.route.snapshot.paramMap.get('id')!;
    if (this.offerId) {
      this.loadOfferData(this.offerId);
      this.loadAssignedCandidates(this.offerId);
    }

    this.candidateService.getCandidates().subscribe((candidates) => {
      this.candidates = candidates.map((candidate) => ({
        ...candidate,
      }));
      this.filteredCandidates = [...this.candidates]; // Initialize filtered candidates
      this.filterUnassignedCandidates(); // Ensure only unassigned candidates are shown
    });
  }

  loadOfferData(offerId: string): void {
    this.offerService.getOfferById(offerId).subscribe((offer) => {
      this.offer = offer;
    });
  }


  applications : Application[] = []
  loadAssignedCandidates(offerId: string): void {
    this.applicationService.getAssignedCandidates(offerId).subscribe(
      (candidates) => {
        this.offerCandidates = candidates; // Assigned candidates
        this.filterUnassignedCandidates(); // Filter out already assigned candidates
      },
      (error) => {
        console.error('Error fetching assigned candidates:', error);
      }
    ); 
  }

  filterUnassignedCandidates(): void {
    this.filteredCandidates = this.candidates.filter(
      (candidate) =>
        !this.offerCandidates.some(
          (assignedCandidate) => assignedCandidate._id === candidate._id
        )
    );
  }
    
  filterCandidates() {
    const query = this.searchQuery.toLowerCase();
    this.filteredCandidates = this.candidates.filter((candidate) =>
      [candidate.name, candidate.email, candidate.passportNumber, candidate.cin]
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
    this.filterUnassignedCandidates();
  }


  assignCandidate(candidate: any) {
    if (!candidate.selectedPositionId) {
      alert('Please select a position for the candidate');
      return;
    }
    const positionId = candidate.selectedPositionId;
    const offerId = this.offer?._id;

    if (!offerId) {
      alert('Offer ID is missing.');
      return;
    }

    // Use the application service to add the application
  this.applicationService
  .addApplication(candidate._id, offerId, positionId, 'applied')
  .subscribe(
    (application) => {
      alert('Candidate assigned successfully');
      // Refresh the offer to reflect updated data
      this.offerService.getOfferById(offerId).subscribe((offer) => {
        this.offer = offer;
      });
      // Refresh the assigned candidates and filtered candidates
      this.loadAssignedCandidates(offerId); // Update the assigned candidates list
      this.filterUnassignedCandidates(); // Refresh the suggestions
    },
    (error) => {
      alert('Error assigning candidate: ' + error.message);
      console.error(error);
    }
  );
  }
}