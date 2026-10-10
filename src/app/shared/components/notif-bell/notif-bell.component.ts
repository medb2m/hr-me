import { CommonModule } from '@angular/common';
import { Component, HostListener, inject } from '@angular/core';
import {
  LucideBell,
  LucideBriefcase,
  LucideCalendar,
  LucideCheckCircle,
  LucideClock,
  LucideFileCheck,
  LucideFileWarning,
  LucideMail,
  LucideSend,
  LucideSparkles,
  LucideUserPlus,
  LucideXCircle,
} from '@lucide/angular';
import { NotificationsHubService } from '../../../core/services/notifications-hub.service';
import type { AppNotificationDto } from '../../../core/models/hr-me-realtime.models';

/**
 * Cloche de notification des espaces (candidat `/candidat`, client `/espace`).
 * Même rendu que le panneau du navbar public — bouton ghost pour header sombre.
 */
@Component({
  selector: 'app-notif-bell',
  standalone: true,
  imports: [
    CommonModule,
    LucideBell,
    LucideBriefcase,
    LucideCalendar,
    LucideCheckCircle,
    LucideClock,
    LucideFileCheck,
    LucideFileWarning,
    LucideMail,
    LucideSend,
    LucideSparkles,
    LucideUserPlus,
    LucideXCircle,
  ],
  templateUrl: './notif-bell.component.html',
  styleUrl: './notif-bell.component.css',
})
export class NotifBellComponent {
  readonly notifHub = inject(NotificationsHubService);

  togglePanel(ev: Event): void {
    ev.stopPropagation();
    this.notifHub.togglePanel();
    if (this.notifHub.panelOpen()) {
      this.notifHub.loadPage();
    }
  }

  /** « il y a 5 min / 2 h / 3 j » pour les items du panneau. */
  timeAgo(d?: string | Date): string {
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

  trackId(_: number, n: AppNotificationDto): string {
    return n.id;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(ev: MouseEvent): void {
    const el = ev.target as HTMLElement;
    if (!el.closest('.nb-wrap')) {
      this.notifHub.closePanel();
    }
  }
}
