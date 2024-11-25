import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CandidateService } from '../../../services/candidate.service';
import { Offer } from '../../../models/offer';

@Component({
  selector: 'app-details-candidate',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './details-candidate.component.html',
  styleUrl: './details-candidate.component.css'
})
export class DetailsCandidateComponent {
  candidate: any;
  offers: Offer[] = [];
  candidateId!: string;

  constructor(
    private route: ActivatedRoute,
    private candidateService: CandidateService
  ) {}

  ngOnInit() {
    this.candidateId = this.route.snapshot.paramMap.get('id')!;
    console.log('the id ' + this.candidateId)
    
    if (this.candidateId) {
      this.candidateService.getCandidateById(this.candidateId).subscribe(data => {
        this.candidate = data;
        this.offers = data.offers
        console.log(data)
      });
    }
  }
}
