import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** Exige un JWT (session) pour accéder aux routes meetings / calendar. */
export const authRequiredGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  auth.refreshFromStorage();
  const has =
    typeof localStorage !== 'undefined' &&
    Boolean(localStorage.getItem('authToken')) &&
    auth.isLoggedIn();
  if (!has) {
    void router.navigateByUrl('/login');
    return false;
  }
  return true;
};
