import { CommonModule } from '@angular/common';
import { Component, DestroyRef, HostListener, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationsHubService } from '../../../core/services/notifications-hub.service';
import { SocketService } from '../../../core/services/socket.service';
import { filter } from 'rxjs';

// Lucide icons — Apple/SF Symbols style
import {
  LucideUsers,
  LucideBriefcase,
  LucideLayoutGrid,
  LucideInfo,
  LucideGauge,
  LucideChevronRight,
  LucideChevronDown,
  LucideUserPlus,
  LucideList,
  LucideBot,
  LucideVideo,
  LucidePlaySquare,
  LucideNetwork,
  LucideTicket,
  LucidePlusCircle,
  LucideSparkles,
  LucideLogOut,
  LucideLogIn,
  LucideBell,
  LucideSettings,
  LucideX,
  LucideCalendar,
  LucideMic2,
} from '@lucide/angular';

@Component({
  selector: 'app-navbar',
  imports: [
    CommonModule, RouterLink, RouterLinkActive,
    LucideUsers, LucideBriefcase, LucideLayoutGrid, LucideInfo,
    LucideGauge, LucideChevronRight, LucideChevronDown, LucideUserPlus,
    LucideList, LucideBot, LucideVideo, LucidePlaySquare,
    LucideNetwork, LucideTicket, LucidePlusCircle, LucideSparkles,
    LucideLogOut, LucideLogIn, LucideBell, LucideSettings, LucideX,
    LucideCalendar, LucideMic2,
  ],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss'
})
export class NavbarComponent implements OnInit {
  readonly auth = inject(AuthService);
  readonly notifHub = inject(NotificationsHubService);
  private readonly socketSvc = inject(SocketService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  isSidebarOpen     = false;
  isUserDropdownOpen = false;
  isUserConnected = false;

  dropdowns: { [key: string]: boolean } = {
    candidate:   false,
    offer:       false,
    ticket:      false,
    recruitment: false,
    meetings:    false,
  };

  ngOnInit(): void {
    this.syncAuthState();
    if (this.isUserConnected) {
      this.notifHub.syncSocketFromAuth();
    }
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.syncAuthState());
  }

  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
    if (this.isSidebarOpen) {
      document.body.classList.add('sidebar-open');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      document.body.classList.remove('sidebar-open');
    }
  }

  navigateAndCloseSidebar(): void {
    this.isSidebarOpen = false;
    document.body.classList.remove('sidebar-open');
  }

  toggleDropdown(group: string): void {
    this.dropdowns[group] = !this.dropdowns[group];
  }

  toggleUserDropdown(): void {
    this.isUserDropdownOpen = !this.isUserDropdownOpen;
  }

  displayName(): string {
    const u = this.auth.user();
    if (!u) {
      return '';
    }
    const n = u.name?.trim();
    if (n) {
      return n;
    }
    return u.email?.split('@')[0] || 'Account';
  }

  userInitials(): string {
    const u = this.auth.user();
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
    const e = u.email;
    if (e && e.length >= 2) {
      return e.slice(0, 2).toUpperCase();
    }
    return '?';
  }

  roleLabel(): string {
    const r = this.auth.user()?.role;
    if (!r) {
      return '';
    }
    return r.charAt(0).toUpperCase() + r.slice(1);
  }

  toggleNotifications(ev: Event): void {
    ev.stopPropagation();
    this.notifHub.togglePanel();
    if (this.notifHub.panelOpen()) {
      this.notifHub.loadPage();
    }
  }

  logout(): void {
    this.auth.clearSession();
    this.socketSvc.disconnect();
    this.notifHub.closePanel();
    this.isUserConnected = false;
    this.isUserDropdownOpen = false;
    this.isSidebarOpen = false;
    document.body.classList.remove('sidebar-open');
    void this.router.navigateByUrl('/login');
  }

  private syncAuthState(): void {
    if (typeof localStorage === 'undefined') {
      this.isUserConnected = false;
      return;
    }
    const hasToken = Boolean(localStorage.getItem('authToken'));
    if (hasToken && !this.auth.user()) {
      this.auth.refreshFromStorage();
    }
    this.isUserConnected = Boolean(this.auth.user()) || hasToken;
    if (!this.isUserConnected) {
      this.isUserDropdownOpen = false;
    } else {
      this.notifHub.syncSocketFromAuth();
    }
  }

  /** Close profile dropdown when clicking outside of it */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.profile-wrap')) {
      this.isUserDropdownOpen = false;
    }
    if (!target.closest('.notif-panel-wrap')) {
      this.notifHub.closePanel();
    }
  }
}
