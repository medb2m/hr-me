import { Component, DestroyRef, inject, OnInit } from '@angular/core';
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

  ngOnInit(): void {
    this.auth.refreshFromStorage();
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
}
