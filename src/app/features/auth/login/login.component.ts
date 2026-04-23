import { Component, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { finalize } from 'rxjs/operators';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationsHubService } from '../../../core/services/notifications-hub.service';

@Component({
  selector: 'app-login',
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css', '../auth-shared.scss'],
})
export class LoginComponent implements OnInit {
  submitting = false;
  errorMsg = '';

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
    if (this.auth.isLoggedIn()) {
      void this.router.navigateByUrl(this.resolveRedirect());
    }
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting = true;
    this.errorMsg = '';
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
          void this.router.navigateByUrl(this.resolveRedirect());
        },
        error: (err: { error?: { message?: string }; message?: string }) => {
          this.errorMsg =
            err.error?.message || err.message || 'Sign in failed. Try again.';
        },
      });
  }

  /** Admins go to the admin panel; everyone else goes to the public home. */
  private resolveRedirect(): string {
    return this.auth.user()?.role === 'admin' ? '/admin/dashboard' : '/home';
  }
}
