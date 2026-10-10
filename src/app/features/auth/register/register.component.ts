import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { BackButtonComponent } from '../../../shared/components/back-button/back-button.component';
import { finalize } from 'rxjs/operators';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { AuthVisualComponent } from '../auth-visual/auth-visual.component';
import { isValidPersonName, normalizePersonName } from '../../../shared/utils/person-name';

@Component({
  selector: 'app-register',
  imports: [CommonModule, ReactiveFormsModule, RouterLink, AuthVisualComponent, BackButtonComponent],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css', '../auth-shared.scss'],
})
export class RegisterComponent {
  submitting = false;
  errorMsg = '';
  successMsg = '';
  showPassword = false;
  showConfirm = false;
  /** Suggestion douce — ex. un seul mot saisi ou caractères invalides. */
  nameHint = '';

  form = this.fb.nonNullable.group({
    name: [''],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirm: ['', Validators.required],
  });

  /** Au blur : normalise la casse (« mohamed ben mohamed » → « Mohamed ben Mohamed »). */
  onNameBlur(): void {
    const ctrl = this.form.controls.name;
    const raw = ctrl.value;
    if (!raw.trim()) {
      this.nameHint = '';
      return;
    }
    const normalized = normalizePersonName(raw);
    if (normalized !== raw.trim()) {
      ctrl.setValue(normalized);
    }
    this.updateNameHint();
  }

  /** Indice non bloquant — caractères invalides ou prénom probablement manquant. */
  private updateNameHint(): void {
    const raw = this.form.controls.name.value.trim();
    if (!raw) {
      this.nameHint = '';
      return;
    }
    if (!isValidPersonName(raw)) {
      this.nameHint = 'Le nom ne doit contenir que des lettres, espaces, tirets et apostrophes.';
      return;
    }
    this.nameHint =
      raw.split(/\s+/).length < 2
        ? 'Pensez à indiquer votre prénom puis votre nom — ex. « Mohamed Ben Mohamed ».'
        : '';
  }

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
    private readonly toast: ToastService,
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
    // Nom : bloquant seulement si des caractères invalides ont été saisis.
    const normalizedName = normalizePersonName(this.form.controls.name.value);
    if (normalizedName && !isValidPersonName(normalizedName)) {
      this.errorMsg =
        'Le nom ne peut contenir que des lettres, espaces, tirets et apostrophes.';
      this.form.controls.name.markAsTouched();
      return;
    }
    this.submitting = true;
    this.errorMsg = '';
    this.successMsg = '';
    const v = this.form.getRawValue();
    this.auth
      .register({ name: normalizedName || undefined, email: v.email.trim(), password: v.password })
      .pipe(finalize(() => (this.submitting = false)))
      .subscribe({
        next: () => {
          this.toast.success(
            'Compte créé',
            'Vérifiez votre e-mail — un lien et un code à 6 chiffres vous ont été envoyés.',
          );
          void this.router.navigate(['/verify-email'], {
            queryParams: { sent: '1', email: this.form.controls.email.value.trim() },
          });
        },
        error: (err: { error?: { message?: string }; message?: string }) => {
          this.errorMsg = err.error?.message || err.message || 'Inscription impossible.';
        },
      });
  }
}
