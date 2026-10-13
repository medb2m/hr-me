import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import {
  LucideAward,
  LucideCalendarDays,
  LucideFileText,
  LucideFolderOpen,
  LucideGlobe2,
  LucideIdCard,
  LucideLayoutDashboard,
  LucidePenLine,
  LucideSend,
  LucideSettings,
} from '@lucide/angular';
import { AuthService } from '../../../../core/services/auth.service';
import { ClientProfileStateService } from '../../services/client-profile-state.service';
import { ClientProfileApiService } from '../../services/client-profile-api.service';

@Component({
  selector: 'app-client-sidebar',
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    LucideAward,
    LucideCalendarDays,
    LucideFileText,
    LucideFolderOpen,
    LucideGlobe2,
    LucideIdCard,
    LucideLayoutDashboard,
    LucidePenLine,
    LucideSend,
    LucideSettings,
  ],
  templateUrl: './client-sidebar.component.html',
  styleUrl: './client-sidebar.component.css',
})
export class ClientSidebarComponent {
  private readonly auth = inject(AuthService);
  private readonly clientApi = inject(ClientProfileApiService);
  readonly profileState = inject(ClientProfileStateService);

  readonly photoSrc = computed(() => this.clientApi.resolveMediaUrl(this.profileState.profilePhotoUrl()));

  readonly user = this.auth.user;

  /** Nom affiché : préférence `name` auth, sinon extrait email. */
  readonly displayName = computed(() => {
    const u = this.user();
    const n = u?.name?.trim();
    if (n) return n;
    const email = u?.email?.trim();
    if (email && email.includes('@')) {
      return email.split('@')[0];
    }
    return null;
  });

  readonly hasDisplayName = computed(() => Boolean(this.user()?.name?.trim()));

  /** Affiche JJ/MM/AAAA à partir d’une date ISO `YYYY-MM-DD`. */
  formatBirthDisplay(iso: string): string {
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) {
      return iso;
    }
    return `${m[3]}/${m[2]}/${m[1]}`;
  }

  readonly nav = [
    { path: '/candidat/overview', label: 'Tableau de bord', icon: 'dashboard' },
    { path: '/candidat/profile', label: 'Identité & profil', icon: 'id' },
    { path: '/candidat/editor/cv', label: 'Éditeur CV', icon: 'cv' },
    { path: '/candidat/editor/cl', label: 'Lettre de motivation', icon: 'letter' },
    { path: '/candidat/library', label: 'Documents & diplômes', icon: 'docs' },
    { path: '/candidat/skills', label: 'Compétences & langues', icon: 'skills' },
    { path: '/candidat/offres', label: 'Offres internationales', icon: 'offers' },
    { path: '/candidat/candidatures', label: 'Mes candidatures', icon: 'applications' },
    { path: '/candidat/calendrier', label: 'Calendrier', icon: 'calendar' },
    { path: '/candidat/settings', label: 'Mon compte', icon: 'settings' },
  ] as const;
}
