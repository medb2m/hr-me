import { Routes } from '@angular/router';
import { NotFoundComponent } from './shared/components/not-found/not-found.component';
import { HomeComponent } from './shared/components/home/home.component';
import { InterviewHubComponent } from './features/recruitment/interview/interview-hub.component';
import { InterviewRoomComponent } from './features/recruitment/interview/interview-room.component';
import { InterviewSessionDetailComponent } from './features/recruitment/interview/interview-session-detail.component';
import { InterviewPassComponent } from './features/recruitment/interview/interview-pass.component';
import { AboutPageComponent } from './shared/components/public/about-page/about-page.component';
import { ContactPageComponent } from './shared/components/public/contact-page/contact-page.component';
import { LegalPageComponent } from './shared/components/public/legal-page/legal-page.component';
import { JobsPageComponent } from './shared/components/public/jobs-page/jobs-page.component';
import { ServicesPageComponent } from './shared/components/public/services-page/services-page.component';
import { LoginComponent } from './features/auth/login/login.component';
import { RegisterComponent } from './features/auth/register/register.component';
import { ForgotPasswordComponent } from './features/auth/forgot-password/forgot-password.component';
import { ResetPasswordComponent } from './features/auth/reset-password/reset-password.component';
import { VerifyEmailComponent } from './features/auth/verify-email/verify-email.component';
import { ResendVerificationComponent } from './features/auth/resend-verification/resend-verification.component';
import { ConfirmEmailChangeComponent } from './features/auth/confirm-email-change/confirm-email-change.component';
import { SettingsPageComponent } from './features/account/settings/settings-page.component';
import { AdminAuthPageComponent } from './features/admin/pages/admin-auth-page/admin-auth-page.component';
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

    // Pages légales (publiques)
    {
      path: 'mentions-legales',
      component: LegalPageComponent,
      data: { legal: 'mentions-legales' },
    },
    {
      path: 'politique-confidentialite',
      component: LegalPageComponent,
      data: { legal: 'politique-confidentialite' },
    },
    {
      path: 'cgu',
      component: LegalPageComponent,
      data: { legal: 'cgu' },
    },
    { path: 'contact', component: ContactPageComponent },
    { path: 'login', component: LoginComponent, canActivate: [guestOnlyGuard] },
    { path: 'register', component: RegisterComponent, canActivate: [guestOnlyGuard] },
    { path: 'forgot-password', component: ForgotPasswordComponent },
    { path: 'reset-password', component: ResetPasswordComponent },
    { path: 'verify-email', component: VerifyEmailComponent },
    { path: 'resend-verification', component: ResendVerificationComponent },
    { path: 'confirm-email-change', component: ConfirmEmailChangeComponent },

    /** Connexion administrateur — page dédiée hors espace /admin. */
    { path: 'adminlog', component: AdminAuthPageComponent },

    /** Account settings — every authenticated role (client, admin, candidate, recruiter). */
    {
      path: 'settings',
      component: SettingsPageComponent,
      canActivate: [authRequiredGuard],
    },

    /** Centre de notifications — tous les rôles connectés. */
    {
      path: 'notifications',
      canActivate: [authRequiredGuard],
      loadComponent: () =>
        import('./shared/pages/notifications-center/notifications-center.component').then(
          (m) => m.NotificationsCenterComponent,
        ),
    },

    /** Espace admin (login sur `/adminlog`) — dashboard, gestion des utilisateurs, etc. */
    {
      path: 'admin',
      loadChildren: () => import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
    },

    /** Espace candidat (layout ) : `/candidat/overview`, `/candidat/profile`, etc. */
    {
      path: 'candidat',
      canActivate: [authRequiredGuard],
      loadChildren: () => import('./features/client/client.routes').then((m) => m.CLIENT_ROUTES),
    },
    /** Alias historique `/client/*` — le garde-fou de rôle réécrit vers `/candidat/*`. */
    {
      path: 'client',
      canActivate: [authRequiredGuard],
      loadChildren: () => import('./features/client/client.routes').then((m) => m.CLIENT_ROUTES),
    },

    /** Espace client (compte public) : accueil, offres statiques, profil + demande de qualification. */
    {
      path: 'espace',
      canActivate: [authRequiredGuard],
      loadChildren: () => import('./features/espace/espace.routes').then((m) => m.ESPACE_ROUTES),
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

    /** Vue d'ensemble personnelle — distincte de la console admin. */
    {
      path: 'dashboard',
      canActivate: [authRequiredGuard],
      loadComponent: () =>
        import('./features/dashboard/dashboard-page.component').then(
          (m) => m.DashboardPageComponent,
        ),
    },

    // Recruitment => AI interview (staff : hub onglets, salle démo, transcript)
    {
      path: 'recruitment/interview',
      component: InterviewHubComponent,
      canActivate: [authRequiredGuard],
    },
    {
      path: 'recruitment/interview/room/:sessionId',
      component: InterviewRoomComponent,
      canActivate: [authRequiredGuard],
    },
    {
      path: 'recruitment/interview/sessions',
      redirectTo: '/recruitment/interview',
      pathMatch: 'full',
    },
    {
      path: 'recruitment/interview/sessions/:sessionId',
      component: InterviewSessionDetailComponent,
      canActivate: [authRequiredGuard],
    },

    // Entretien IA côté personne affectée (lien tokenisé, sans compte)
    { path: 'interview/pass/:token', component: InterviewPassComponent },

    // 404
    { path: '**', component: NotFoundComponent}
];
