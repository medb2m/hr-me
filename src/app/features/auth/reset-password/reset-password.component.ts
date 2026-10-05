import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { AuthService } from '../../../core/services/auth.service';
import { AuthVisualComponent } from '../auth-visual/auth-visual.component';

@Component({
  selector: 'app-reset-password',
  imports: [CommonModule, ReactiveFormsModule, RouterLink, AuthVisualComponent],
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.css', '../auth-shared.scss'],
})
export class ResetPasswordComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  token = '';
  tokenMissing = false;
  submitting = false;
  errorMsg = '';
  successMsg = '';
  showPassword = false;
  showConfirm = false;

  form = this.fb.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirm: ['', Validators.required],
  });

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token')?.trim() || '';
    this.tokenMissing = !this.token;
  }

  passwordMismatch(): boolean {
    const confirm = this.form.controls.confirm;
    return (
      confirm.touched &&
      confirm.value.length > 0 &&
      confirm.value !== this.form.controls.password.value
    );
  }

  submit(): void {
    const p = this.form.controls.password.value;
    const c = this.form.controls.confirm.value;
    this.form.markAllAsTouched();
    if (p !== c) {
      this.errorMsg = 'Les mots de passe ne correspondent pas.';
      return;
    }
    if (this.form.invalid || !this.token) {
      return;
    }
    this.submitting = true;
    this.errorMsg = '';
    this.successMsg = '';
    this.auth
      .resetPassword({ token: this.token, password: p })
      .pipe(finalize(() => (this.submitting = false)))
      .subscribe({
        next: (r) => {
          this.successMsg = r.message;
          setTimeout(() => void this.router.navigateByUrl('/login'), 2000);
        },
        error: (err: { error?: { message?: string }; message?: string }) => {
          this.errorMsg = err.error?.message || err.message || 'Réinitialisation impossible.';
        },
      });
  }
}
