import { Routes } from '@angular/router';
import { AddCandidateComponent } from './features/candidate/add-candidate/add-candidate.component';
import { ListCandidateComponent } from './features/candidate/list-candidate/list-candidate.component';
import { DetailsCandidateComponent } from './features/candidate/details-candidate/details-candidate.component';

export const routes: Routes = [
    // Candidate Routes
    { path: 'add-candidate', component: AddCandidateComponent},
    { path: 'list-candidates', component: ListCandidateComponent},
    { path: 'candidate/:id', component: DetailsCandidateComponent}
];
