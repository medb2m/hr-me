import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { AuthService } from '../../../core/services/auth.service';
import { AuthVisualComponent } from '../auth-visual/auth-visual.component';

@Component({
  selector: 'app-register',
  imports: [CommonModule, ReactiveFormsModule, RouterLink, AuthVisualComponent],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css', '../auth-shared.scss'],
})
export class RegisterComponent {
  submitting = false;
  errorMsg = '';
  successMsg = '';
  showPassword = false;
  showConfirm = false;

  form = this.fb.nonNullable.group({
    name: [''],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirm: ['', Validators.required],
  });

  passwordMismatch(): boolean {
    const confirm = this.form.controls.confirm;
    return (
      confirm.touched &&
      confirm.value.length > 0 &&
      confirm.value !== this.form.controls.password.value
    );
  }

  constructor(
    private readonly fb: FormBuilder,
    private readonly auth: AuthService,
    private readonly router: Router,
  ) {}

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.form.controls.password.value !== this.form.controls.confirm.value) {
      this.errorMsg = 'Les mots de passe ne correspondent pas.';
      return;
    }
    this.submitting = true;
    this.errorMsg = '';
    this.successMsg = '';
    const v = this.form.getRawValue();
    this.auth
      .register({ name: v.name?.trim() || undefined, email: v.email.trim(), password: v.password })
      .pipe(finalize(() => (this.submitting = false)))
      .subscribe({
        next: (res) => {
          this.successMsg = res.message || 'Compte créé.';
        },
        error: (err: { error?: { message?: string }; message?: string }) => {
          this.errorMsg = err.error?.message || err.message || 'Inscription impossible.';
        },
      });
  }
}
