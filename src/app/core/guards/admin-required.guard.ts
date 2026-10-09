import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** Accès réservé aux utilisateurs connectés avec le rôle `admin`. */
export const adminRequiredGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  auth.refreshFromStorage();
  const ok =
    typeof localStorage !== 'undefined' &&
    Boolean(localStorage.getItem('authToken')) &&
    auth.isLoggedIn() &&
    auth.user()?.role === 'admin';
  if (!ok) {
    void router.navigateByUrl('/adminlog');
    return false;
  }
  return true;
};
