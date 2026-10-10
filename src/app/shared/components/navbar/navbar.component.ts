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
  LucideShield,
  LucideUserCog,
  LucideUserCircle,
  LucideInbox,
  LucideSearch,
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
    LucideCalendar, LucideMic2, LucideShield, LucideUserCog, LucideUserCircle,
    LucideInbox, LucideSearch, FormsModule,
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

  /** Barre de recherche « fonctionnalités » (admin) — style Spotlight/iOS Settings. */
  @ViewChild('cmdInput') cmdInput?: ElementRef<HTMLInputElement>;
  searchQuery = '';
  searchOpen = false;
  searchActive = 0;

  get isAdmin(): boolean {
    return this.auth.user()?.role === 'admin';
  }

  /** Index des fonctionnalités — crumbs = chemin affiché (Settings > …). */
  private readonly searchIndex: {
    icon: string;
    label: string;
    crumbs: string[];
    link: string;
    kw: string;
  }[] = [
    { icon: 'shield', label: 'Console admin', crumbs: ['Administration'], link: '/admin/dashboard', kw: 'admin console dashboard tableau bord stats' },
    { icon: 'usercog', label: 'Utilisateurs', crumbs: ['Administration'], link: '/admin/users', kw: 'users comptes roles gestion create' },
    { icon: 'inbox', label: 'Contacts', crumbs: ['Administration'], link: '/admin/contacts', kw: 'messages contact formulaire demandes inbox' },
    { icon: 'userplus', label: 'Ajouter un candidat', crumbs: ['Recrutement', 'Candidats'], link: '/add-candidate', kw: 'candidate add nouveau create inscription' },
    { icon: 'users', label: 'Tous les candidats', crumbs: ['Recrutement', 'Candidats'], link: '/list-candidate', kw: 'candidates list liste dossiers' },
    { icon: 'list', label: 'Liste (vue simple)', crumbs: ['Recrutement', 'Candidats'], link: '/list', kw: 'candidates liste simple' },
    { icon: 'pluscircle', label: 'Publier une offre', crumbs: ['Recrutement', 'Offres'], link: '/add-offer', kw: 'offer add job emploi nouvelle create' },
    { icon: 'briefcase', label: 'Toutes les offres', crumbs: ['Recrutement', 'Offres'], link: '/list-offers', kw: 'offers list jobs emplois' },
    { icon: 'network', label: 'Postes', crumbs: ['Recrutement'], link: '/position', kw: 'position poste job title' },
    { icon: 'bot', label: 'Entretiens IA', crumbs: ['Recrutement', 'Entretiens'], link: '/recruitment/interview', kw: 'interview entretien ia ai video hub' },
    { icon: 'video', label: 'Sessions d\u2019entretien', crumbs: ['Recrutement', 'Entretiens'], link: '/recruitment/interview/sessions', kw: 'interview sessions entretien' },
    { icon: 'pluscircle', label: 'Créer un ticket', crumbs: ['Recrutement', 'Tickets'], link: '/add-ticket', kw: 'ticket add support nouveau create demande' },
    { icon: 'ticket', label: 'Liste des tickets', crumbs: ['Recrutement', 'Tickets'], link: '/list-ticket', kw: 'tickets support list liste demandes' },
    { icon: 'sparkles', label: 'Compétences', crumbs: ['Recrutement'], link: '/skill', kw: 'skills competences skill' },
    { icon: 'video', label: 'Réunions', crumbs: ['Outils'], link: '/meetings', kw: 'meetings reunion visio call video' },
    { icon: 'calendar', label: 'Calendrier', crumbs: ['Outils'], link: '/calendar', kw: 'calendar rdv rendez-vous agenda' },
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
