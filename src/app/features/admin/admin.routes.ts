import { Routes } from '@angular/router';
import { AdminApplicantComponent } from './pages/admin-applicant/admin-applicant.component';
import { AdminContactsComponent } from './pages/admin-contacts/admin-contacts.component';
import { AdminDashboardComponent } from './pages/admin-dashboard/admin-dashboard.component';
import { AdminOfferApplicationsComponent } from './pages/admin-offer-applications/admin-offer-applications.component';
import { AdminOfferFormComponent } from './pages/admin-offer-form/admin-offer-form.component';
import { AdminOffersComponent } from './pages/admin-offers/admin-offers.component';
import { AdminUsersComponent } from './pages/admin-users/admin-users.component';
import { adminRequiredGuard } from '../../core/guards/admin-required.guard';

/** Espace admin : login dédié sur `/adminlog` ; l'espace (`/admin/*`) utilise le chrome du site. */
export const ADMIN_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  { path: 'auth', redirectTo: '/adminlog' },
  {
    path: 'dashboard',
    component: AdminDashboardComponent,
    canActivate: [adminRequiredGuard],
  },
  {
    path: 'users',
    component: AdminUsersComponent,
    canActivate: [adminRequiredGuard],
  },
  {
    path: 'contacts',
    component: AdminContactsComponent,
    canActivate: [adminRequiredGuard],
  },
  {
    path: 'offers',
    component: AdminOffersComponent,
    canActivate: [adminRequiredGuard],
  },
  {
    path: 'offers/new',
    component: AdminOfferFormComponent,
    canActivate: [adminRequiredGuard],
  },
  {
    path: 'offers/:id/edit',
    component: AdminOfferFormComponent,
    canActivate: [adminRequiredGuard],
  },
  {
    path: 'offers/:id/applications',
    component: AdminOfferApplicationsComponent,
    canActivate: [adminRequiredGuard],
  },
  {
    path: 'applications/:id',
    component: AdminApplicantComponent,
    canActivate: [adminRequiredGuard],
  },
];
