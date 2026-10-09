import { Component, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import {
  LucideChevronDown,
  LucideLayoutGrid,
  LucideLogOut,
  LucideSettings,
  LucideUserRound,
} from '@lucide/angular';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-client-header',
  imports: [
    CommonModule,
    RouterLink,
    LucideChevronDown,
    LucideLayoutGrid,
    LucideLogOut,
    LucideSettings,
    LucideUserRound,
  ],
  templateUrl: './client-header.component.html',
  styleUrl: './client-header.component.css',
})
export class ClientHeaderComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly user = this.auth.user;
  menuOpen = false;

  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
  }

  closeMenu(): void {
    this.menuOpen = false;
  }

  initials(): string {
    const u = this.user();
    if (!u) {
      return '?';
    }
    const n = u.name?.trim();
    if (n) {
      const parts = n.split(/\s+/).filter(Boolean);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return n.slice(0, 2).toUpperCase();
    }
    return u.email.slice(0, 2).toUpperCase();
  }

  displayName(): string {
    const u = this.user();
    if (!u) {
      return '';
    }
    return u.name?.trim() || u.email.split('@')[0];
  }

  logout(): void {
    this.closeMenu();
    this.auth.clearSession();
    void this.router.navigateByUrl('/login');
  }

  /** Ferme le menu quand on clique en dehors. */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.ch-user')) {
      this.menuOpen = false;
    }
  }
}
