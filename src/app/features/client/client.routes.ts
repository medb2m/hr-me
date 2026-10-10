import { Routes } from '@angular/router';
import { ClientShellComponent } from './layouts/client-shell/client-shell.component';

export const CLIENT_ROUTES: Routes = [
  {
    path: '',
    component: ClientShellComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'overview' },
      {
        path: 'overview',
        loadComponent: () =>
          import('./pages/client-overview/client-overview.component').then((m) => m.ClientOverviewComponent),
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./pages/client-profile-page/client-profile-page.component').then(
            (m) => m.ClientProfilePageComponent,
          ),
      },
      {
        path: 'editor/cv',
        loadComponent: () =>
          import('./pages/client-cv-hub/client-cv-hub.component').then((m) => m.ClientCvHubComponent),
      },
      {
        path: 'editor/cv/:cvId',
        loadComponent: () =>
          import('./pages/client-cv-editor/client-cv-editor.component').then(
            (m) => m.ClientCvEditorComponent,
          ),
      },
      {
        path: 'editor/cl',
        loadComponent: () =>
          import('./pages/client-cl-editor-page/client-cl-editor-page.component').then(
            (m) => m.ClientClEditorPageComponent,
          ),
      },
      {
        path: 'library',
        loadComponent: () =>
          import('./pages/client-library-page/client-library-page.component').then(
            (m) => m.ClientLibraryPageComponent,
          ),
      },
      {
        path: 'skills',
        loadComponent: () =>
          import('./pages/client-skills-page/client-skills-page.component').then(
            (m) => m.ClientSkillsPageComponent,
          ),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('../account/settings/settings-page.component').then((m) => m.SettingsPageComponent),
      },
      {
        path: 'offres',
        loadComponent: () =>
          import('./pages/client-offers/client-offers.component').then(
            (m) => m.ClientOffersComponent,
          ),
      },
      {
        path: 'offres/:id',
        loadComponent: () =>
          import('./pages/client-offer-detail/client-offer-detail.component').then(
            (m) => m.ClientOfferDetailComponent,
          ),
      },
      {
        path: 'candidatures',
        loadComponent: () =>
          import('../espace/pages/espace-applications/espace-applications.component').then(
            (m) => m.EspaceApplicationsComponent,
          ),
      },
      { path: 'explore', redirectTo: 'offres' },
    ],
  },
];
