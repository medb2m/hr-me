import { CommonModule } from '@angular/common';
import { Component, HostListener, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import {
  LucideBriefcase,
  LucideChevronDown,
  LucideCrown,
  LucideHome,
  LucideLogOut,
  LucideMenu,
  LucideSettings,
  LucideUserCircle,
  LucideX,
} from '@lucide/angular';
import { AuthService } from '../../../../core/services/auth.service';
import { NotificationsHubService } from '../../../../core/services/notifications-hub.service';

/** Shell de l'espace client : topbar anthracite + dropdown utilisateur. */
@Component({
  selector: 'app-espace-shell',
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    LucideBriefcase,
    LucideChevronDown,
    LucideCrown,
    LucideHome,
    LucideLogOut,
    LucideMenu,
    LucideSettings,
    LucideUserCircle,
    LucideX,
  ],
  templateUrl: './espace-shell.component.html',
  styleUrl: './espace-shell.component.css',
})
export class EspaceShellComponent {
  readonly auth = inject(AuthService);
  private readonly notifHub = inject(NotificationsHubService);
  private readonly router = inject(Router);

  dropdownOpen = false;
  mobileOpen = false;

  @HostListener('document:click', ['$event'])
  onDocClick(ev: Event): void {
    if (!(ev.target as HTMLElement).closest('.user-area')) {
      this.dropdownOpen = false;
    }
  }

  initials(): string {
    const u = this.auth.user();
    const src = (u?.name || u?.email || '').trim();
    return src
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('');
  }

  displayName(): string {
    const u = this.auth.user();
    return u?.name || u?.email?.split('@')[0] || 'Client';
  }

  logout(): void {
    this.auth.clearSession();
    this.notifHub.syncSocketFromAuth();
    void this.router.navigateByUrl('/login');
  }
}
