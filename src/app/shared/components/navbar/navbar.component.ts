import { CommonModule } from '@angular/common';
import { Component, DestroyRef, ElementRef, HostListener, OnInit, ViewChild, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
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
  LucideShield,
  LucideUserCog,
  LucideUserCircle,
  LucideInbox,
  LucideSearch,
  LucideSend,
  LucideCheckCircle,
  LucideXCircle,
  LucideFileCheck,
  LucideFileWarning,
  LucideMail,
  LucideClock,
} from '@lucide/angular';

@Component({
  selector: 'app-navbar',
  imports: [
    CommonModule, RouterLink, RouterLinkActive,
    LucideUsers, LucideBriefcase, LucideLayoutGrid, LucideInfo,
    LucideGauge, LucideChevronRight, LucideChevronDown, LucideUserPlus,
    LucideList, LucideBot, LucideVideo, LucidePlaySquare,
    LucideTicket, LucidePlusCircle, LucideSparkles,
    LucideLogOut, LucideLogIn, LucideBell, LucideSettings, LucideX,
    LucideCalendar, LucideMic2, LucideShield, LucideUserCog, LucideUserCircle,
    LucideInbox, LucideSearch, FormsModule,
    LucideSend, LucideCheckCircle, LucideXCircle, LucideFileCheck,
    LucideFileWarning, LucideMail, LucideClock,
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
    recruitment: false,
    meetings:    false,
  };

  /** Barre de recherche « fonctionnalités » (admin) — style Spotlight/iOS Settings. */
  @ViewChild('cmdInput') cmdInput?: ElementRef<HTMLInputElement>;
  searchQuery = '';
  searchOpen = false;
  searchActive = 0;

  get isAdmin(): boolean {
    return this.auth.user()?.role === 'admin';
  }

  /** Équipe interne : admin, agent, directeur, recruteur. */
  get isStaff(): boolean {
    return ['admin', 'agent', 'director', 'recruiter'].includes(this.auth.user()?.role || '');
  }

  /** Index des fonctionnalités — crumbs = chemin affiché (Settings > …). */
  private readonly searchIndex: {
    icon: string;
    label: string;
    crumbs: string[];
    link: string;
    kw: string;
  }[] = [
    { icon: 'gauge', label: 'Dashboard', crumbs: ['Overview'], link: '/dashboard', kw: 'dashboard vue ensemble overview stats accueil' },
    { icon: 'shield', label: 'Console admin', crumbs: ['Administration'], link: '/admin/dashboard', kw: 'admin console dashboard tableau bord stats' },
    { icon: 'usercog', label: 'Utilisateurs', crumbs: ['Administration'], link: '/admin/users', kw: 'users comptes roles gestion create' },
    { icon: 'inbox', label: 'Contacts', crumbs: ['Administration'], link: '/admin/contacts', kw: 'messages contact formulaire demandes inbox' },
    { icon: 'briefcase', label: 'Offres d\u2019emploi', crumbs: ['Administration'], link: '/admin/offers', kw: 'offers list jobs emplois gestion offre' },
    { icon: 'pluscircle', label: 'Publier une offre', crumbs: ['Administration', 'Offres'], link: '/admin/offers/new', kw: 'offer add job emploi nouvelle create publier' },
    { icon: 'ticket', label: 'Tickets', crumbs: ['Administration'], link: '/admin/tickets', kw: 'tickets kanban support board demandes' },
    { icon: 'bot', label: 'Entretiens IA', crumbs: ['Administration', 'AI Recruitment'], link: '/recruitment/interview', kw: 'interview entretien ia ai video hub sessions' },
    { icon: 'video', label: 'Créer un entretien IA', crumbs: ['Administration', 'AI Recruitment'], link: '/recruitment/interview?tab=create', kw: 'interview entretien ia creer assigner' },
    { icon: 'video', label: 'Templates d\u2019entretien', crumbs: ['Administration', 'AI Recruitment'], link: '/recruitment/interview?tab=templates', kw: 'interview template modele entretien ia' },
    { icon: 'video', label: 'Réunions', crumbs: ['Administration', 'Gestion de réunions'], link: '/meetings', kw: 'meetings reunion visio call video' },
    { icon: 'pluscircle', label: 'Planifier une réunion', crumbs: ['Administration', 'Gestion de réunions'], link: '/meetings/new', kw: 'meeting reunion planifier create new' },
    { icon: 'calendar', label: 'Calendrier', crumbs: ['Administration', 'Gestion de réunions'], link: '/calendar', kw: 'calendar rdv rendez-vous agenda' },
    { icon: 'usercircle', label: 'Espace candidat', crumbs: ['Espaces'], link: '/candidat/overview', kw: 'candidat espace overview profil' },
    { icon: 'settings', label: 'Paramètres', crumbs: ['Compte'], link: '/settings', kw: 'settings parametres compte profil' },
  ];

  private static normalize(s: string): string {
    return s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');
  }

  searchResults() {
    const q = NavbarComponent.normalize(this.searchQuery.trim());
    const items = this.searchIndex;
    if (!q) {
      return items.slice(0, 8);
    }
    return items
      .filter((it) => {
        const hay = NavbarComponent.normalize(
          `${it.label} ${it.crumbs.join(' ')} ${it.kw}`,
        );
        return q.split(/\s+/).every((tok) => hay.includes(tok));
      })
      .slice(0, 8);
  }

  onSearchInput(): void {
    this.searchActive = 0;
    this.searchOpen = true;
  }

  openSearch(): void {
    this.searchOpen = true;
    this.searchActive = 0;
  }

  closeSearch(): void {
    this.searchOpen = false;
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.searchActive = 0;
    this.cmdInput?.nativeElement.focus();
  }

  onSearchKey(ev: KeyboardEvent): void {
    const results = this.searchResults();
    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      if (results.length) this.searchActive = (this.searchActive + 1) % results.length;
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      if (results.length) this.searchActive = (this.searchActive - 1 + results.length) % results.length;
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      const it = results[this.searchActive];
      if (it) this.pickResult(it);
    } else if (ev.key === 'Escape') {
      this.closeSearch();
      this.cmdInput?.nativeElement.blur();
    }
  }

  pickResult(it: { link: string }): void {
    this.closeSearch();
    this.searchQuery = '';
    void this.router.navigateByUrl(it.link);
  }

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

  /** « il y a 5 min / 2 h / 3 j » pour les items du panneau. */
  notifTimeAgo(d?: string | Date): string {
    if (!d) return '';
    const dt = new Date(d).getTime();
    if (Number.isNaN(dt)) return '';
    const s = Math.max(0, Math.floor((Date.now() - dt) / 1000));
    if (s < 60) return 'à l’instant';
    const m = Math.floor(s / 60);
    if (m < 60) return `il y a ${m} min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `il y a ${h} h`;
    const j = Math.floor(h / 24);
    if (j < 7) return `il y a ${j} j`;
    return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
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
    if (!target.closest('.cmdbar')) {
      this.closeSearch();
    }
  }

  /** Ctrl/Cmd+K ouvre la recherche (admin). */
  @HostListener('document:keydown', ['$event'])
  onGlobalKeydown(ev: KeyboardEvent): void {
    if (this.isAdmin && (ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k') {
      ev.preventDefault();
      this.cmdInput?.nativeElement.focus();
      this.cmdInput?.nativeElement.select();
      this.openSearch();
    }
  }
}
