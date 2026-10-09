import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { ClientProfileStateService } from '../../services/client-profile-state.service';
import { ClientProfileApiService } from '../../services/client-profile-api.service';

@Component({
  selector: 'app-client-sidebar',
  imports: [CommonModule, RouterLink, RouterLinkActive],
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
    { path: '/candidat/overview', label: 'Tableau de bord', icon: '◆' },
    { path: '/candidat/profile', label: 'Identité & profil', icon: '◇' },
    { path: '/candidat/editor/cv', label: 'Éditeur CV', icon: '▣' },
    { path: '/candidat/editor/cl', label: 'Lettre de motivation', icon: '▤' },
    { path: '/candidat/library', label: 'Documents & diplômes', icon: '▦' },
    { path: '/candidat/skills', label: 'Compétences & langues', icon: '○' },
    { path: '/candidat/explore', label: 'Offres & formations', icon: '▸' },
    { path: '/settings', label: 'Mon compte', icon: '⚙' },
  ] as const;
}
