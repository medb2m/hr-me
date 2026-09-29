import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-verify-email',
  imports: [CommonModule, RouterLink],
  templateUrl: './verify-email.component.html',
  styleUrls: ['./verify-email.component.css', '../auth-shared.scss'],
})
export class VerifyEmailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);

  loading = false;
  errorMsg = '';
  successMsg = '';
  private token = '';
  private emailHint = '';

  ngOnInit(): void {
    const q = this.route.snapshot.queryParamMap;
    this.token = q.get('token')?.trim() || '';
    this.emailHint = q.get('email')?.trim() || '';
    if (this.token) {
      this.verify();
    }
  }

  verify(): void {
    if (!this.token) {
      this.errorMsg = 'Lien de vérification invalide.';
      return;
    }
    this.loading = true;
    this.errorMsg = '';
    this.successMsg = '';
    this.auth
      .verifyEmail({ token: this.token, email: this.emailHint || undefined })
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (r) => {
          this.successMsg = r.message;
        },
        error: (err: { error?: { message?: string }; message?: string }) => {
          this.errorMsg = err.error?.message || err.message || 'Vérification impossible.';
        },
      });
  }
}
