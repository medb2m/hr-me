import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { AuthService } from '../../../core/services/auth.service';
import { BackButtonComponent } from '../../../shared/components/back-button/back-button.component';
import { AuthVisualComponent } from '../auth-visual/auth-visual.component';
import { AccountApiService } from '../../account/services/account-api.service';

@Component({
  selector: 'app-confirm-email-change',
  imports: [CommonModule, RouterLink, AuthVisualComponent, BackButtonComponent],
  templateUrl: './confirm-email-change.component.html',
  styleUrls: ['./confirm-email-change.component.css', '../auth-shared.scss'],
})
export class ConfirmEmailChangeComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(AccountApiService);
  private readonly auth = inject(AuthService);

  loading = false;
  errorMsg = '';
  successMsg = '';
  missingToken = false;

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token')?.trim() || '';
    if (!token) {
      this.missingToken = true;
      return;
    }
    this.loading = true;
    this.api
      .confirmEmailChange(token)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: ({ user, message }) => {
          this.successMsg = `${message} Nouvelle adresse : ${user.email}.`;
          this.auth.updateStoredUser({ email: user.email });
        },
        error: (err: { error?: { message?: string }; message?: string }) => {
          this.errorMsg = err.error?.message || err.message || 'Confirmation impossible.';
        },
      });
  }
}
