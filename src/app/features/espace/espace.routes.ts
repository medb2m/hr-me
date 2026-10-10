import { Routes } from '@angular/router';
import { EspaceShellComponent } from './layouts/espace-shell/espace-shell.component';

/** Espace client — compte public non qualifié (le rôle `candidate` utilise /client). */
export const ESPACE_ROUTES: Routes = [
  {
    path: '',
    component: EspaceShellComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'accueil' },
      {
        path: 'accueil',
        loadComponent: () =>
          import('./pages/espace-home/espace-home.component').then((m) => m.EspaceHomeComponent),
      },
      {
        path: 'offres',
        loadComponent: () =>
          import('./pages/espace-offers/espace-offers.component').then(
            (m) => m.EspaceOffersComponent,
          ),
      },
      {
        path: 'offres/:id',
        loadComponent: () =>
          import('./pages/espace-offer-detail/espace-offer-detail.component').then(
            (m) => m.EspaceOfferDetailComponent,
          ),
      },
      {
        path: 'candidatures',
        loadComponent: () =>
          import('./pages/espace-applications/espace-applications.component').then(
            (m) => m.EspaceApplicationsComponent,
          ),
      },
      {
        path: 'profil',
        loadComponent: () =>
          import('./pages/espace-profile/espace-profile.component').then(
            (m) => m.EspaceProfileComponent,
          ),
      },
    ],
  },
];
