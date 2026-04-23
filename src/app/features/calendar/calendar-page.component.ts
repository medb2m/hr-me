import { CommonModule } from '@angular/common';
import { afterNextRender, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CalendarApiService } from '../../core/services/calendar-api.service';
import { SocketService } from '../../core/services/socket.service';
import { AuthService } from '../../core/services/auth.service';
import type { CalendarEventDto } from '../../core/models/hr-me-realtime.models';

@Component({
  selector: 'app-calendar-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './calendar-page.component.html',
  styleUrl: './calendar-page.component.scss',
})
export class CalendarPageComponent {
  private readonly calendarApi = inject(CalendarApiService);
  private readonly http = inject(HttpClient);
  private readonly socketSvc = inject(SocketService);
  private readonly auth = inject(AuthService);

  /** Premier jour du mois affiché (locale minuit). */
  readonly viewMonth = signal(this.monthStart(new Date()));

  readonly title = computed(() => {
    const d = this.viewMonth();
    return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  });

  readonly gridWeeks = computed(() => this.buildMonthGrid(this.viewMonth()));
  readonly eventsByDay = signal<Map<string, CalendarEventDto[]>>(new Map());
  readonly loading = signal(false);
  readonly socketHint = signal<string | null>(null);

  constructor() {
    afterNextRender(() => {
      this.auth.refreshFromStorage();
      this.reloadEvents();
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('authToken') : '';
      if (!token) {
        return;
      }
      const s = this.socketSvc.connect(token);
      const uid = this.auth.user()?.id;
      if (uid) {
        s.emit('calendar:subscribe', { agentIds: [uid] });
      }
      s.on('calendar:event_created', () => this.reloadEvents());
      s.on('calendar:event_updated', () => this.reloadEvents());
      s.on('calendar:event_cancelled', () => this.reloadEvents());
    });
  }

  truncate(s: string, max: number): string {
    if (!s || s.length <= max) {
      return s;
    }
    return s.slice(0, max) + '…';
  }

  prevMonth(): void {
    const d = this.viewMonth();
    this.viewMonth.set(this.monthStart(new Date(d.getFullYear(), d.getMonth() - 1, 1)));
    this.reloadEvents();
  }

  nextMonth(): void {
    const d = this.viewMonth();
    this.viewMonth.set(this.monthStart(new Date(d.getFullYear(), d.getMonth() + 1, 1)));
    this.reloadEvents();
  }

  today(): void {
    this.viewMonth.set(this.monthStart(new Date()));
    this.reloadEvents();
  }

  dayKey(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  eventsFor(d: Date): CalendarEventDto[] {
    return this.eventsByDay().get(this.dayKey(d)) ?? [];
  }

  downloadIcs(ev: CalendarEventDto): void {
    const url = this.calendarApi.downloadIcsUrl(ev.id);
    this.http.get(url, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `event-${ev.id}.ics`;
        a.click();
        URL.revokeObjectURL(a.href);
      },
    });
  }

  private reloadEvents(): void {
    const start = this.viewMonth();
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    const fetchFrom = new Date(start.getFullYear(), start.getMonth(), 0);
    const fetchTo = new Date(start.getFullYear(), start.getMonth() + 2, 1);
    this.loading.set(true);
    this.calendarApi.events(fetchFrom, fetchTo).subscribe({
      next: (r) => {
        const map = new Map<string, CalendarEventDto[]>();
        for (const ev of r.items) {
          const day = ev.startsAt.slice(0, 10);
          const list = map.get(day) ?? [];
          list.push(ev);
          map.set(day, list);
        }
        this.eventsByDay.set(map);
        this.loading.set(false);
      },
      error: () => {
        this.socketHint.set('Impossible de charger les événements (session ou réseau).');
        this.loading.set(false);
      },
    });
  }

  private monthStart(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }

  /** 6 × 7 dates pour la grille du mois. */
  private buildMonthGrid(monthStart: Date): Date[][] {
    const firstDow = (monthStart.getDay() + 6) % 7;
    const gridStart = new Date(monthStart);
    gridStart.setDate(monthStart.getDate() - firstDow);
    const weeks: Date[][] = [];
    let cur = new Date(gridStart);
    for (let w = 0; w < 6; w++) {
      const row: Date[] = [];
      for (let d = 0; d < 7; d++) {
        row.push(new Date(cur));
        cur.setDate(cur.getDate() + 1);
      }
      weeks.push(row);
    }
    return weeks;
  }
}
