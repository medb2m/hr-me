import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CandidateService } from '../../../services/candidate.service';

@Component({
  selector: 'app-details-candidate',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './details-candidate.component.html',
  styleUrl: './details-candidate.component.css'
})
export class DetailsCandidateComponent {
  candidate: any;

  constructor(
    private route: ActivatedRoute,
    private candidateService: CandidateService
  ) {}

  ngOnInit() {
    const candidateId = this.route.snapshot.paramMap.get('id');
    console.log('the id ' + candidateId)
    if (candidateId) {
      this.candidateService.getCandidateById(candidateId).subscribe(data => {
        this.candidate = data;
      });
    }
  }
}
