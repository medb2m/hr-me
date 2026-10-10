import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { ClientHeaderComponent } from '../../components/client-header/client-header.component';
import { ClientSidebarComponent } from '../../components/client-sidebar/client-sidebar.component';
import { ClientProfileStateService } from '../../services/client-profile-state.service';
import { ClientProfileApiService } from '../../services/client-profile-api.service';

@Component({
  selector: 'app-client-shell',
  imports: [CommonModule, RouterOutlet, ClientHeaderComponent, ClientSidebarComponent],
  templateUrl: './client-shell.component.html',
  styleUrl: './client-shell.component.css',
})
export class ClientShellComponent implements OnInit {
  readonly profileState = inject(ClientProfileStateService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly clientProfileApi = inject(ClientProfileApiService);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * % de complétion au moment où l'utilisateur a fermé la bannière.
   * Elle réapparaît si la progression augmente ensuite.
   */
  readonly alertDismissedAt = signal(-1);
  private static readonly ALERT_KEY = 'aw-profile-alert-dismissed-at';

  ngOnInit(): void {
    this.auth.refreshFromStorage();
    try {
      this.alertDismissedAt.set(Number(localStorage.getItem(ClientShellComponent.ALERT_KEY)) || 0);
    } catch {
      /* SSR / stockage indisponible */
    }
    this.clientProfileApi
      .getProfile()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ profile }) => this.profileState.applyFromServerProfile(profile),
        error: () => {},
      });
  }

  goToProfile(): void {
    void this.router.navigateByUrl('/candidat/profile');
  }

  showAlert(): boolean {
    const pct = this.profileState.completionPercent();
    return !this.profileState.isProfileComplete() && pct > this.alertDismissedAt();
  }

  dismissAlert(): void {
    const pct = this.profileState.completionPercent();
    this.alertDismissedAt.set(pct);
    try {
      localStorage.setItem(ClientShellComponent.ALERT_KEY, String(pct));
    } catch {
      /* SSR / stockage indisponible */
    }
  }
}
