import { Component, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { BackButtonComponent } from '../../../shared/components/back-button/back-button.component';
import { CommonModule } from '@angular/common';
import { finalize } from 'rxjs/operators';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationsHubService } from '../../../core/services/notifications-hub.service';
import { AuthVisualComponent } from '../auth-visual/auth-visual.component';

@Component({
  selector: 'app-login',
  imports: [CommonModule, ReactiveFormsModule, RouterLink, AuthVisualComponent, BackButtonComponent],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css', '../auth-shared.scss'],
})
export class LoginComponent implements OnInit {
  submitting = false;
  errorMsg = '';
  showPassword = false;
  needsVerification = false;

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router,
    private notifHub: NotificationsHubService,
  ) {}

  ngOnInit(): void {
    this.auth.refreshFromStorage();
    if (this.auth.isLoggedIn()) {
      void this.router.navigateByUrl(this.auth.postLoginRedirectPath());
    }
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting = true;
    this.errorMsg = '';
    this.needsVerification = false;
    this.auth
      .login(this.form.getRawValue())
      .pipe(finalize(() => (this.submitting = false)))
      .subscribe({
        next: (res) => {
          const token = res.token || res.accessToken || '';
          if (!token) {
            this.errorMsg = 'Sign in succeeded but no session token was returned. Please try again.';
            return;
          }
          const email = this.form.controls.email.value?.trim().toLowerCase() || '';
          this.auth.setSession(token, res.user, email);
          this.notifHub.syncSocketFromAuth();
          if (!this.auth.isLoggedIn()) {
            this.errorMsg = 'Could not start your session. Please sign in again.';
            return;
          }
          void this.router.navigateByUrl(this.auth.postLoginRedirectPath());
        },
        error: (err: { status?: number; error?: { message?: string }; message?: string }) => {
          this.needsVerification = err.status === 403;
          this.errorMsg =
            err.error?.message || err.message || 'Sign in failed. Try again.';
        },
      });
  }

}
