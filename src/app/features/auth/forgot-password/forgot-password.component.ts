import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-forgot-password',
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.css', '../auth-shared.scss'],
})
export class ForgotPasswordComponent {
  submitting = false;
  msg = '';

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
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
    this.msg = '';
    this.auth
      .forgotPassword(this.form.controls.email.value.trim())
      .pipe(finalize(() => (this.submitting = false)))
      .subscribe({
        next: (r) => {
          this.msg = r.message;
        },
        error: (err: { error?: { message?: string }; message?: string }) => {
          this.msg = err.error?.message || err.message || 'Demande impossible.';
        },
      });
  }
}
