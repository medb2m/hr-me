import { Routes } from '@angular/router';
import { AddCandidateComponent } from './features/candidate/add-candidate/add-candidate.component';
import { ListCandidateComponent } from './features/candidate/list-candidate/list-candidate.component';
import { DetailsCandidateComponent } from './features/candidate/details-candidate/details-candidate.component';
import { AddOfferComponent } from './features/management/offer/add-offer/add-offer.component';
import { ListOfferComponent } from './features/management/offer/list-offer/list-offer.component';
import { OfferComponent } from './features/management/offer/offer/offer.component';
import { PositionComponent } from './features/management/position/position/position.component';

export const routes: Routes = [
    // Candidate Routes
    { path: 'add-candidate', component: AddCandidateComponent},
    { path: 'list-candidates', component: ListCandidateComponent},
    { path: 'candidate/:id', component: DetailsCandidateComponent},

    // Management => Offer
    { path: 'add-offer', component: AddOfferComponent },
    { path: 'list-offers', component: ListOfferComponent },
    { path: 'offer/:id', component: OfferComponent },

    // Management => Offer
    { path: 'position', component: PositionComponent },

];
