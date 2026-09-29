import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-reset-password',
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.css', '../auth-shared.scss'],
})
export class ResetPasswordComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  token = '';
  submitting = false;
  errorMsg = '';
  successMsg = '';

  form = this.fb.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirm: ['', Validators.required],
  });

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token')?.trim() || '';
  }

  submit(): void {
    const p = this.form.controls.password.value;
    const c = this.form.controls.confirm.value;
    if (p !== c) {
      this.errorMsg = 'Les mots de passe ne correspondent pas.';
      return;
    }
    if (this.form.invalid || !this.token) {
      this.form.markAllAsTouched();
      if (!this.token) {
        this.errorMsg = 'Lien invalide (token manquant).';
      }
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
