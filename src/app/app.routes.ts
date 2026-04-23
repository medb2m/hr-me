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
import { NotFoundComponent } from './shared/components/not-found/not-found.component';
import { HomeComponent } from './shared/components/home/home.component';
import { TestComponent } from './shared/components/test/test.component';
import { DossierComponent } from './features/candidate/dossier/dossier.component';
import { CandidatesListComponent } from './features/candidate/candidates-list/candidates-list.component';
import { FilePreviewComponent } from './features/candidate/file-preview/file-preview.component';
import { InterviewHubComponent } from './features/recruitment/interview/interview-hub.component';
import { InterviewRoomComponent } from './features/recruitment/interview/interview-room.component';
import { InterviewSessionsListComponent } from './features/recruitment/interview/interview-sessions-list.component';
import { InterviewSessionDetailComponent } from './features/recruitment/interview/interview-session-detail.component';
import { AboutPageComponent } from './shared/components/public/about-page/about-page.component';
import { JobsPageComponent } from './shared/components/public/jobs-page/jobs-page.component';
import { ServicesPageComponent } from './shared/components/public/services-page/services-page.component';
import { LoginComponent } from './features/auth/login/login.component';
import { RegisterComponent } from './features/auth/register/register.component';
import { ForgotPasswordComponent } from './features/auth/forgot-password/forgot-password.component';
import { ResetPasswordComponent } from './features/auth/reset-password/reset-password.component';
import { VerifyEmailComponent } from './features/auth/verify-email/verify-email.component';
import { ResendVerificationComponent } from './features/auth/resend-verification/resend-verification.component';
import { guestOnlyGuard } from './core/guards/guest-only.guard';
import { authRequiredGuard } from './core/guards/auth-required.guard';

export const routes: Routes = [
    // home
    { path: '', redirectTo: '/home', pathMatch: 'full' },
    { path: 'home', component: HomeComponent},

    // Public marketing (no sign-in required)
    { path: 'about', component: AboutPageComponent },
    { path: 'jobs', component: JobsPageComponent },
    { path: 'services', component: ServicesPageComponent },
    { path: 'login', component: LoginComponent, canActivate: [guestOnlyGuard] },
    { path: 'register', component: RegisterComponent, canActivate: [guestOnlyGuard] },
    { path: 'forgot-password', component: ForgotPasswordComponent },
    { path: 'reset-password', component: ResetPasswordComponent },
    { path: 'verify-email', component: VerifyEmailComponent },
    { path: 'resend-verification', component: ResendVerificationComponent },

    /** Admin area: own layout (loadChildren). Auth at `/admin/auth`, app at `/admin/dashboard`, etc. */
    {
      path: 'admin',
      loadChildren: () => import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
    },

    {
      path: 'meetings',
      loadChildren: () => import('./features/meetings/meetings.routes').then((m) => m.default),
    },
    {
      path: 'calendar',
      canActivate: [authRequiredGuard],
      loadComponent: () =>
        import('./features/calendar/calendar-page.component').then((m) => m.CalendarPageComponent),
    },
    
    // Candidate Routes
    { path: 'add-candidate', component: AddCandidateComponent},
    { path: 'list-candidate', component: ListCandidateComponent},
    { path: 'candidate/:id', component: DetailsCandidateComponent},
    { path: 'update-candidate/:id', component: UpdateCandidateComponent},
    { path: 'candidate-dossier/:id', component: DossierComponent},
    { path: 'list', component: CandidatesListComponent},

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

    // Recruitment => AI interview
    { path: 'recruitment/interview', component: InterviewHubComponent },
    { path: 'recruitment/interview/room/:sessionId', component: InterviewRoomComponent },
    { path: 'recruitment/interview/sessions', component: InterviewSessionsListComponent },
    { path: 'recruitment/interview/sessions/:sessionId', component: InterviewSessionDetailComponent },

    // TEST
    { path: 'test', component: TestComponent },

    // pdf 
    { path: 'pdf', component: FilePreviewComponent },
    

    // 404
    { path: '**', component: NotFoundComponent}
];
