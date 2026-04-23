import { afterNextRender, Injectable, computed, signal, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { SocketService } from './socket.service';
import { NotificationsApiService } from './notifications-api.service';
import type { AppNotificationDto } from '../models/hr-me-realtime.models';

@Injectable({ providedIn: 'root' })
export class NotificationsHubService {
  private readonly auth = inject(AuthService);
  private readonly socketSvc = inject(SocketService);
  private readonly api = inject(NotificationsApiService);
  private readonly router = inject(Router);

  readonly items = signal<AppNotificationDto[]>([]);
  readonly unreadTotal = signal(0);
  readonly panelOpen = signal(false);
  readonly socketStatus = this.socketSvc.status;

  readonly unreadLabel = computed(() => {
    const n = this.unreadTotal();
    if (n <= 0) {
      return '';
    }
    return n > 99 ? '99+' : String(n);
  });

  constructor() {
    afterNextRender(() => this.syncSocketFromAuth());
  }

  togglePanel(): void {
    this.panelOpen.update((v) => !v);
  }

  closePanel(): void {
    this.panelOpen.set(false);
  }

  refreshUnread(): void {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('authToken') : null;
    if (!token) {
      return;
    }
    this.api.unreadCount().subscribe({
      next: (r) => this.unreadTotal.set(r.count),
      error: () => {},
    });
  }

  /** Rebrancher le socket après login / au chargement. */
  syncSocketFromAuth(): void {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('authToken') : null;
    if (!token) {
      this.socketSvc.disconnect();
      this.items.set([]);
      this.unreadTotal.set(0);
      return;
    }
    const s = this.socketSvc.connect(token);
    s.off('notification:new');
    s.off('notification:batch');
    s.off('notification:count');
    s.off('notification:updated');
    s.on('notification:new', (payload: { notification: AppNotificationDto }) => {
      if (payload?.notification) {
        this.items.update((list) => [payload.notification, ...list].slice(0, 50));
        this.unreadTotal.update((c) => c + (payload.notification.read ? 0 : 1));
      }
    });
    s.on('notification:batch', (payload: { notifications: AppNotificationDto[] }) => {
      if (Array.isArray(payload?.notifications)) {
        this.items.set(payload.notifications);
      }
    });
    s.on('notification:count', (payload: { total?: number }) => {
      if (typeof payload?.total === 'number') {
        this.unreadTotal.set(payload.total);
      }
    });
    s.on('notification:updated', () => {
      this.refreshUnread();
    });
    this.refreshUnread();
  }

  markReadAndGo(n: AppNotificationDto): void {
    if (!n.read) {
      this.api.markRead(n.id).subscribe({ error: () => {} });
    }
    this.items.update((list) => list.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    this.unreadTotal.update((c) => Math.max(0, c - (n.read ? 0 : 1)));
    this.closePanel();
    if (n.actionUrl) {
      void this.router.navigateByUrl(n.actionUrl);
    }
  }

  markAllRead(): void {
    this.api.markAllRead().subscribe({
      next: () => {
        this.items.update((list) => list.map((x) => ({ ...x, read: true })));
        this.unreadTotal.set(0);
      },
    });
  }

  dismiss(n: AppNotificationDto, ev?: Event): void {
    ev?.stopPropagation();
    this.api.dismiss(n.id).subscribe({
      next: () => {
        this.items.update((list) => list.filter((x) => x.id !== n.id));
        this.refreshUnread();
      },
    });
  }

  loadPage(): void {
    this.api.list(1, 30).subscribe({
      next: (r) => this.items.set(r.items),
    });
  }
}
