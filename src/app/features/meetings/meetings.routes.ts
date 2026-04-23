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
    path: ':id/lobby',
    canActivate: [authRequiredGuard],
    loadComponent: () => import('./pages/meeting-lobby/meeting-lobby.component').then((m) => m.MeetingLobbyComponent),
  },
  {
    path: ':id/room',
    canActivate: [authRequiredGuard],
    loadComponent: () => import('./pages/meeting-room/meeting-room.component').then((m) => m.MeetingRoomComponent),
  },
];

export default routes;
