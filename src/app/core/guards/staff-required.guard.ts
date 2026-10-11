import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

const STAFF_ROLES = new Set(['admin', 'agent', 'director', 'recruiter']);

/** Accès réservé à l'équipe interne (admins, agents, directeurs, recruteurs). */
export const staffRequiredGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  auth.refreshFromStorage();
  const ok =
    typeof localStorage !== 'undefined' &&
    Boolean(localStorage.getItem('authToken')) &&
    auth.isLoggedIn() &&
    STAFF_ROLES.has(auth.user()?.role || '');
  if (!ok) {
    void router.navigateByUrl('/adminlog');
    return false;
  }
  return true;
};
