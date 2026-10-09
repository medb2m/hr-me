import { Routes } from '@angular/router';
import { AdminDashboardComponent } from './pages/admin-dashboard/admin-dashboard.component';
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
];
