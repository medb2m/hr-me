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
import * as XLSX from 'xlsx';

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
  offerCandidates : any
  filteredCandidates: Candidate[] = [];
  UnassignedCandidates: Candidate[] = [];

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
      this.UnassignedCandidates = [...this.candidates]; // Initialize filtered candidates
      this.filterUnassignedCandidates(); // Ensure only unassigned candidates are shown
    });
  }

  loadOfferData(offerId: string): void {
    this.offerService.getOfferById(offerId).subscribe((offer) => {
      this.offer = offer;
    });
  }


  applications : Application[] = []
  offerCandidatesList: Candidate[] = []
  loadAssignedCandidates(offerId: string): void {
    this.applicationService.getAssignedCandidates(offerId).subscribe(
      (candidates) => {
        console.log('before candiate load assign')
        console.log(candidates)
        this.offerCandidatesList = candidates.map(item => item.candidate)
        this.offerCandidates = candidates; // Assigned candidates
        //this.filterUnassignedCandidates(); // Filter out already assigned candidates
      },
      (error) => {
        console.error('Error fetching assigned candidates:', error);
      }
    ); 
  }

  filterUnassignedCandidates(): void {
    //const candidates = this.offerCandidates.map((item) => item.candidate)
    this.UnassignedCandidates = this.candidates.filter(
      (candidate) =>
        !this.offerCandidatesList.some(
          (assignedCandidate : any) => assignedCandidate._id === candidate._id
        )
    );
    console.log('filtered assigned')
    console.log(this.UnassignedCandidates)
  }
    
  filterCandidates() {
    console.log('hello')
    const query = this.searchQuery.toLowerCase();
    console.log(this.UnassignedCandidates)
    this.filteredCandidates = this.UnassignedCandidates.filter((candidate) =>
      [candidate.name, candidate.email, candidate.passportNumber, candidate.cin]
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
    console.log('after')
    console.log(this.UnassignedCandidates)
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
      this.filteredCandidates = [] // empty the suggestions
    },
    (error) => {
      alert('Error assigning candidate: ' + error.message);
      console.error(error);
    }
  );
  }

  exportCandidates(): void {
    if (!this.offerCandidates || this.offerCandidates.length === 0) {
      alert('No assigned candidates to export.');
      return;
    }

    const data = this.offerCandidates.map((candidate: any) => ({
      Name: candidate.candidate.name,
      Email: candidate.candidate.email,
      Passport: candidate.candidate.passportNumber,
      Position: candidate.position || 'N/A',
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Candidates');

    XLSX.writeFile(workbook, `Offer_${this.offer?.name}_Candidates.xlsx`);
  }

  getProgressPercentage(pos: any): number {
    if (!pos || pos.candidatesNeeded === 0) return 0;
    const progress = (pos.candidatesAchieved / pos.candidatesNeeded) * 100;
    return Math.min(Math.round(progress), 100); // Ensure progress doesn't exceed 100%
  }
}