import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** Empêche les invités connectés d’accéder au login / register. */
export const guestOnlyGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  auth.refreshFromStorage();
  const token =
    typeof localStorage !== 'undefined' ? localStorage.getItem('authToken') : null;
  if (token && auth.isLoggedIn()) {
    void router.navigateByUrl(auth.postLoginRedirectPath());
    return false;
  }
  return true;
};
