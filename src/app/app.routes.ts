import { Routes } from '@angular/router';
import { AddCandidateComponent } from './features/candidate/add-candidate/add-candidate.component';
import { ListCandidateComponent } from './features/candidate/list-candidate/list-candidate.component';
import { DetailsCandidateComponent } from './features/candidate/details-candidate/details-candidate.component';
import { AddOfferComponent } from './features/management/offer/add-offer/add-offer.component';
import { ListOfferComponent } from './features/management/offer/list-offer/list-offer.component';
import { OfferComponent } from './features/management/offer/offer/offer.component';
import { PositionComponent } from './features/management/position/position/position.component';
import { UpdateCandidateComponent } from './features/candidate/update-candidate/update-candidate.component';
import { UpdateOfferComponent } from './features/management/offer/update-offer/update-offer.component';
import { AddTicketComponent } from './features/management/ticket/add-ticket/add-ticket.component';
import { ListTicketComponent } from './features/management/ticket/list-ticket/list-ticket.component';
import { TicketComponent } from './features/management/ticket/ticket/ticket.component';
import { UpdateTicketComponent } from './features/management/ticket/update-ticket/update-ticket.component';
import { SkillComponent } from './features/management/skill/skill.component';

export const routes: Routes = [
    // Candidate Routes
    { path: 'add-candidate', component: AddCandidateComponent},
    { path: 'list-candidates', component: ListCandidateComponent},
    { path: 'candidate/:id', component: DetailsCandidateComponent},
    { path: 'update-candidate/:id', component: UpdateCandidateComponent},

    // Management => Offer
    { path: 'add-offer', component: AddOfferComponent },
    { path: 'list-offers', component: ListOfferComponent },
    { path: 'offer/:id', component: OfferComponent },
    { path: 'update-offer/:id', component: UpdateOfferComponent },

    // Management => Position
    { path: 'position', component: PositionComponent },

    // Management => Ticket
    { path: 'add-ticket', component: AddTicketComponent },
    { path: 'list-ticket', component: ListTicketComponent },
    { path: 'ticket/:id', component: TicketComponent },
    { path: 'update-ticket/:id', component: UpdateTicketComponent },

    // Management => skill
    { path: 'skill', component: SkillComponent },
];
