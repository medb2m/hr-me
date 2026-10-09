import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { BackButtonComponent } from '../../../shared/components/back-button/back-button.component';
import { finalize } from 'rxjs/operators';
import { AuthService } from '../../../core/services/auth.service';
import { AuthVisualComponent } from '../auth-visual/auth-visual.component';

@Component({
  selector: 'app-resend-verification',
  imports: [CommonModule, ReactiveFormsModule, AuthVisualComponent, BackButtonComponent],
  templateUrl: './resend-verification.component.html',
  styleUrls: ['./resend-verification.component.css', '../auth-shared.scss'],
})
export class ResendVerificationComponent {
  submitting = false;
  errorMsg = '';
  successMsg = '';
  showPassword = false;

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly auth: AuthService,
  ) {}

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting = true;
    this.errorMsg = '';
    this.successMsg = '';
    const v = this.form.getRawValue();
    this.auth
      .resendVerification({ email: v.email.trim(), password: v.password })
      .pipe(finalize(() => (this.submitting = false)))
      .subscribe({
        next: (r) => {
          this.successMsg = r.message;
        },
        error: (err: { error?: { message?: string }; message?: string }) => {
          this.errorMsg = err.error?.message || err.message || 'Envoi impossible.';
        },
      });
  }
}
