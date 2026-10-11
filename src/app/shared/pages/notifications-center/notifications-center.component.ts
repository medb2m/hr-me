import { Component, OnInit, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  LucideBell,
  LucideBellOff,
  LucideBriefcase,
  LucideCalendar,
  LucideCheck,
  LucideCheckCheck,
  LucideCheckCircle,
  LucideClock,
  LucideExternalLink,
  LucideFileCheck,
  LucideFileWarning,
  LucideLoaderCircle,
  LucideMail,
  LucideRefreshCw,
  LucideSearch,
  LucideSend,
  LucideSparkles,
  LucideTicket,
  LucideTrash2,
  LucideUserPlus,
  LucideXCircle,
} from '@lucide/angular';
import { NotificationsApiService } from '../../../core/services/notifications-api.service';
import { NotificationsHubService } from '../../../core/services/notifications-hub.service';
import type { AppNotificationDto } from '../../../core/models/hr-me-realtime.models';

type ReadFilter = 'all' | 'unread' | 'read';

interface NotifGroup {
  label: string;
  items: AppNotificationDto[];
}

const DAY = 86400000;

/** Centre de notifications — vue complète : filtres, groupes par jour, actions. */
@Component({
  selector: 'app-notifications-center',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LucideBell,
    LucideBellOff,
    LucideBriefcase,
    LucideCalendar,
    LucideCheck,
    LucideCheckCheck,
    LucideCheckCircle,
    LucideClock,
    LucideExternalLink,
    LucideFileCheck,
    LucideFileWarning,
    LucideLoaderCircle,
    LucideMail,
    LucideRefreshCw,
    LucideSearch,
    LucideSend,
    LucideSparkles,
    LucideTicket,
    LucideTrash2,
    LucideUserPlus,
    LucideXCircle,
  ],
  templateUrl: './notifications-center.component.html',
  styleUrl: './notifications-center.component.css',
})
export class NotificationsCenterComponent implements OnInit {
  private readonly api = inject(NotificationsApiService);
  readonly hub = inject(NotificationsHubService);
  private readonly router = inject(Router);

  readonly items = signal<AppNotificationDto[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly loading = signal(true);
  readonly loadingMore = signal(false);
  readonly clearing = signal(false);

  filterRead: ReadFilter = 'all';
  filterCategory = '';
  filterQ = '';

  readonly hasMore = computed(() => this.items().length < this.total());
  readonly hasRead = computed(() => this.items().some((n) => n.read));

  readonly categories = [
    { value: '', label: 'Toutes' },
    { value: 'CANDIDATE', label: 'Candidatures' },
    { value: 'OFFER', label: 'Offres' },
    { value: 'DOCUMENT', label: 'Documents' },
    { value: 'TICKET', label: 'Tickets' },
    { value: 'MESSAGE', label: 'Messages' },
    { value: 'MEETING', label: 'Entretiens' },
    { value: 'CALENDAR', label: 'Calendrier' },
    { value: 'SYSTEM', label: 'Système' },
  ];

  /** Recherche côté client sur les items chargés (titre + corps). */
  readonly visibleItems = computed(() => {
    const q = this.filterQ.trim().toLowerCase();
    const list = this.items();
    if (!q) return list;
    return list.filter(
      (n) =>
        (n.title || '').toLowerCase().includes(q) ||
        (n.body || '').toLowerCase().includes(q),
    );
  });

  /** Regroupement par jour : Aujourd'hui / Hier / Cette semaine / Plus tôt. */
  readonly groups = computed<NotifGroup[]>(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const buckets: NotifGroup[] = [
      { label: 'Aujourd’hui', items: [] },
      { label: 'Hier', items: [] },
      { label: 'Cette semaine', items: [] },
      { label: 'Plus tôt', items: [] },
    ];
    for (const n of this.visibleItems()) {
      const t = n.createdAt ? new Date(n.createdAt).getTime() : 0;
      if (t >= todayStart) buckets[0].items.push(n);
      else if (t >= todayStart - DAY) buckets[1].items.push(n);
      else if (t >= todayStart - 6 * DAY) buckets[2].items.push(n);
      else buckets[3].items.push(n);
    }
    return buckets.filter((b) => b.items.length);
  });

  constructor() {
    // Live : une notif socket arrive → on la prépend si elle passe les filtres serveur.
    effect(() => {
      const latest = this.hub.items()[0];
      if (!latest || this.loading()) return;
      if (this.items().some((x) => x.id === latest.id)) return;
      if (this.filterCategory && latest.category !== this.filterCategory) return;
      if (this.filterRead === 'unread' && latest.read) return;
      if (this.filterRead === 'read' && !latest.read) return;
      this.items.update((l) => [latest, ...l]);
      this.total.update((t) => t + 1);
    });
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.page.set(1);
    this.fetch(1);
  }

  loadMore(): void {
    const next = this.page() + 1;
    this.page.set(next);
    this.loadingMore.set(true);
    this.fetch(next);
  }

  private fetch(page: number): void {
    const read = this.filterRead === 'all' ? undefined : this.filterRead === 'read';
    this.api
      .list(page, 20, { category: this.filterCategory || undefined, read })
      .subscribe({
        next: (r) => {
          if (page === 1) {
            this.items.set(r.items);
          } else {
            const known = new Set(this.items().map((x) => x.id));
            this.items.update((l) => [...l, ...r.items.filter((x) => !known.has(x.id))]);
          }
          this.total.set(r.total);
          this.loading.set(false);
          this.loadingMore.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.loadingMore.set(false);
        },
      });
  }

  setReadFilter(v: ReadFilter): void {
    if (this.filterRead === v) return;
    this.filterRead = v;
    this.load();
  }

  setCategory(v: string): void {
    if (this.filterCategory === v) return;
    this.filterCategory = v;
    this.load();
  }

  open(n: AppNotificationDto): void {
    if (!n.read) {
      this.api.markRead(n.id).subscribe({ error: () => {} });
      this.items.update((l) => l.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      this.hub.refreshUnread();
    }
    if (n.actionUrl) void this.router.navigateByUrl(n.actionUrl);
  }

  markRead(n: AppNotificationDto, ev: Event): void {
    ev.stopPropagation();
    if (n.read) return;
    this.api.markRead(n.id).subscribe({ error: () => {} });
    this.items.update((l) => l.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    this.hub.refreshUnread();
  }

  remove(n: AppNotificationDto, ev: Event): void {
    ev.stopPropagation();
    this.api.dismiss(n.id).subscribe({
      next: () => {
        this.items.update((l) => l.filter((x) => x.id !== n.id));
        this.total.update((t) => Math.max(0, t - 1));
        this.hub.refreshUnread();
      },
    });
  }

  markAllRead(): void {
    this.api.markAllRead().subscribe({
      next: () => {
        this.items.update((l) => l.map((x) => ({ ...x, read: true })));
        this.hub.refreshUnread();
      },
    });
  }

  /** Supprime toutes les notifications lues actuellement chargées. */
  clearRead(): void {
    const readItems = this.items().filter((n) => n.read);
    if (!readItems.length) return;
    this.clearing.set(true);
    let done = 0;
    for (const n of readItems) {
      this.api.dismiss(n.id).subscribe({
        next: () => {
          this.items.update((l) => l.filter((x) => x.id !== n.id));
          this.total.update((t) => Math.max(0, t - 1));
          if (++done === readItems.length) this.clearing.set(false);
        },
        error: () => {
          if (++done === readItems.length) this.clearing.set(false);
        },
      });
    }
    this.hub.refreshUnread();
  }

  trackId(_: number, n: AppNotificationDto): string {
    return n.id;
  }

  categoryLabel(c: string): string {
    return this.categories.find((x) => x.value === c)?.label || c;
  }

  timeAgo(iso?: string): string {
    if (!iso) return '';
    const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return 'à l’instant';
    if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
    if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }
}
