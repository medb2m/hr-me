import { Component } from '@angular/core';
import { CandidateService } from '../../../services/candidate.service';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-list-candidate',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './list-candidate.component.html',
  styleUrl: './list-candidate.component.css'
})
export class ListCandidateComponent {
  candidates : any

  constructor(private candidateService : CandidateService){}

  ngOnInit(){
    console.log('hello')
    this.candidateService.getCandidates().subscribe(data => {
      this.candidates = data
    })
    console.log(this.candidates)
  }
}
