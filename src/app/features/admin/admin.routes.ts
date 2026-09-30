import { Routes } from '@angular/router';
import { AdminAuthPageComponent } from './pages/admin-auth-page/admin-auth-page.component';
import { AdminDashboardComponent } from './pages/admin-dashboard/admin-dashboard.component';
import { adminRequiredGuard } from '../../core/guards/admin-required.guard';

/** Auth dédiée `/admin/auth` ; espace admin (hors `/home` marketing) sur `/admin/dashboard`. */
export const ADMIN_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'auth' },
  { path: 'auth', component: AdminAuthPageComponent },
  {
    path: 'dashboard',
    component: AdminDashboardComponent,
    canActivate: [adminRequiredGuard],
  },
];
