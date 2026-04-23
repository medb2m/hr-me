import { Component, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize, take } from 'rxjs';
import { AuthService } from '../../../../core/services/auth.service';
import { NotificationsHubService } from '../../../../core/services/notifications-hub.service';

type AuthView = 'loading' | 'bootstrap' | 'login';

@Component({
  selector: 'app-admin-auth-page',
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './admin-auth-page.component.html',
  styleUrls: ['./admin-auth-page.component.css', '../../../auth/auth-shared.scss'],
})
export class AdminAuthPageComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly notifHub = inject(NotificationsHubService);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);

  view: AuthView = 'loading';
  errorMsg = '';
  bootstrapError = '';
  loginError = '';
  submittingBootstrap = false;
  submittingLogin = false;

  bootstrapForm = this.fb.nonNullable.group({
    name: [''],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', Validators.required],
    bootstrapSecret: [''],
  });

  loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      this.view = 'loading';
      return;
    }
    this.auth.refreshFromStorage();
    if (this.auth.user()?.role === 'admin') {
      void this.router.navigateByUrl('/admin/dashboard');
      return;
    }
    this.loadStatus();
  }

  private loadStatus(): void {
    this.view = 'loading';
    this.errorMsg = '';
    this.auth
      .getAdminStatus()
      .pipe(take(1))
      .subscribe({
        next: (s) => {
          this.view = s.needsBootstrap ? 'bootstrap' : 'login';
        },
        error: (err: { error?: { message?: string }; message?: string }) => {
          this.errorMsg = err.error?.message || err.message || 'Could not reach server.';
          this.view = 'login';
        },
      });
  }

  submitBootstrap(): void {
    this.bootstrapError = '';
    const raw = this.bootstrapForm.getRawValue();
    if (this.bootstrapForm.invalid) {
      this.bootstrapForm.markAllAsTouched();
      return;
    }
    if (raw.password !== raw.confirmPassword) {
      this.bootstrapError = 'Passwords do not match.';
      return;
    }
    this.submittingBootstrap = true;
    const secret = raw.bootstrapSecret?.trim() || undefined;
    this.auth
      .bootstrapAdmin(
        {
          name: raw.name?.trim() || undefined,
          email: raw.email.trim(),
          password: raw.password,
        },
        secret
      )
      .pipe(finalize(() => (this.submittingBootstrap = false)))
      .subscribe({
        next: (res) => {
          const token = res.token || '';
          if (!token || !res.user) {
            this.bootstrapError = 'Invalid response from server.';
            return;
          }
          this.auth.setSession(token, res.user, res.user.email);
          this.notifHub.syncSocketFromAuth();
          void this.router.navigateByUrl('/admin/dashboard');
        },
        error: (err: { error?: { message?: string; code?: string }; message?: string }) => {
          this.bootstrapError =
            err.error?.message || err.message || 'Could not create administrator.';
        },
      });
  }

  submitLogin(): void {
    this.loginError = '';
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }
    this.submittingLogin = true;
    this.auth
      .adminLogin(this.loginForm.getRawValue())
      .pipe(finalize(() => (this.submittingLogin = false)))
      .subscribe({
        next: (res) => {
          const token = res.token || '';
          if (!token || !res.user) {
            this.loginError = 'Invalid response from server.';
            return;
          }
          this.auth.setSession(token, res.user, res.user.email);
          this.notifHub.syncSocketFromAuth();
          void this.router.navigateByUrl('/admin/dashboard');
        },
        error: (err: { error?: { message?: string; code?: string }; message?: string }) => {
          this.loginError = err.error?.message || err.message || 'Sign in failed.';
        },
      });
  }
}
