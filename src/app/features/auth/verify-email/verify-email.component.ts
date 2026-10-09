import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { BackButtonComponent } from '../../../shared/components/back-button/back-button.component';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { AuthVisualComponent } from '../auth-visual/auth-visual.component';

type VerifyView = 'form' | 'loading' | 'done';

@Component({
  selector: 'app-verify-email',
  imports: [CommonModule, FormsModule, RouterLink, AuthVisualComponent, BackButtonComponent],
  templateUrl: './verify-email.component.html',
  styleUrls: ['./verify-email.component.css', '../auth-shared.scss'],
})
export class VerifyEmailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  view: VerifyView = 'form';
  errorMsg = '';
  email = '';
  code = '';
  /** True quand on arrive depuis /register (e-mail envoyé). */
  justSent = false;

  ngOnInit(): void {
    const q = this.route.snapshot.queryParamMap;
    const token = q.get('token')?.trim() || '';
    this.email = q.get('email')?.trim() || '';
    this.justSent = q.get('sent') === '1';
    if (token) {
      this.verifyByToken(token);
    }
  }

  private verifyByToken(token: string): void {
    this.view = 'loading';
    this.errorMsg = '';
    this.auth
      .verifyEmail({ token, email: this.email || undefined })
      .subscribe({
        next: (r) => this.onVerified(r.message),
        error: (err) => this.onError(err),
      });
  }

  get digitsOnly(): string {
    return this.code.replace(/\D/g, '');
  }

  submitCode(): void {
    const code = this.digitsOnly;
    if (!this.email.trim() || code.length !== 6) {
      this.errorMsg = 'Saisissez votre e-mail et le code à 6 chiffres.';
      return;
    }
    this.view = 'loading';
    this.errorMsg = '';
    this.auth
      .verifyEmail({ email: this.email.trim(), code })
      .subscribe({
        next: (r) => this.onVerified(r.message),
        error: (err) => this.onError(err),
      });
  }

  private onVerified(message: string): void {
    this.view = 'done';
    this.toast.success('E-mail vérifié', message);
    setTimeout(() => void this.router.navigateByUrl('/login'), 1200);
  }

  private onError(err: { error?: { message?: string }; message?: string }): void {
    this.view = 'form';
    this.errorMsg = err.error?.message || err.message || 'Vérification impossible.';
  }
}
