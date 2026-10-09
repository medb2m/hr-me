import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  LucideBadgeCheck,
  LucideCalendar,
  LucideCrown,
  LucideFileCheck,
  LucideMail,
  LucideSend,
  LucideShieldCheck,
  LucideUserCircle,
  LucideVideo,
} from '@lucide/angular';
import { AuthService } from '../../../../core/services/auth.service';
import { ToastService } from '../../../../core/services/toast.service';

/** Ce que le statut candidat débloque — affiché pour motiver la demande. */
const CANDIDATE_PERKS = [
  { label: 'Postuler aux offres internationales', desc: 'Candidature suivie directement par un agent.' },
  { label: 'Entretiens vidéo & IA', desc: 'Sessions d\'entretien en ligne depuis votre espace.' },
  { label: 'Génération de documents', desc: 'Contrats, attestations et dossier de placement.' },
  { label: 'Talent ID Passport', desc: 'Identité vérifiée reconnue par nos partenaires.' },
];

/** Profil client — la demande de qualification est statique pour l'instant (backend à venir). */
@Component({
  selector: 'app-espace-profile',
  imports: [
    CommonModule,
    RouterLink,
    LucideBadgeCheck,
    LucideCalendar,
    LucideCrown,
    LucideFileCheck,
    LucideMail,
    LucideSend,
    LucideShieldCheck,
    LucideUserCircle,
    LucideVideo,
  ],
  templateUrl: './espace-profile.component.html',
  styleUrl: './espace-profile.component.css',
})
export class EspaceProfileComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly perks = CANDIDATE_PERKS;

  /** Statique : persistance locale en attendant l'API de qualification. */
  requestSent = false;

  private storageKey(): string {
    return `qualification-requested:${this.auth.user()?.id ?? 'anon'}`;
  }

  ngOnInit(): void {
    if (typeof localStorage !== 'undefined') {
      this.requestSent = localStorage.getItem(this.storageKey()) === '1';
    }
  }

  sendQualificationRequest(): void {
    this.requestSent = true;
    localStorage.setItem(this.storageKey(), '1');
    this.toast.success(
      'Demande envoyée',
      'Un agent va examiner votre dossier et vous contacter pour la qualification.',
    );
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

  fmtDate(iso?: string): string {
    if (!iso) return '—';
    return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(new Date(iso));
  }
}
