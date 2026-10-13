import { Routes } from '@angular/router';
import { authRequiredGuard } from '../../core/guards/auth-required.guard';

const routes: Routes = [
  {
    path: '',
    canActivate: [authRequiredGuard],
    loadComponent: () => import('./pages/meetings-hub/meetings-hub.component').then((m) => m.MeetingsHubComponent),
  },
  {
    path: 'new',
    canActivate: [authRequiredGuard],
    loadComponent: () => import('./pages/meeting-new/meeting-new.component').then((m) => m.MeetingNewComponent),
  },
  {
    // Invité sans compte : page publique (nom + PIN → entrée ou salle d'attente)
    path: ':id/invite',
    loadComponent: () => import('./pages/meeting-guest/meeting-guest.component').then((m) => m.MeetingGuestComponent),
  },
  {
    path: ':id/lobby',
    canActivate: [authRequiredGuard],
    loadComponent: () => import('./pages/meeting-lobby/meeting-lobby.component').then((m) => m.MeetingLobbyComponent),
  },
  {
    // Accès vérifié dans le composant : compte connecté OU session invité approuvée
    path: ':id/room',
    loadComponent: () => import('./pages/meeting-room/meeting-room.component').then((m) => m.MeetingRoomComponent),
  },
];

export default routes;
