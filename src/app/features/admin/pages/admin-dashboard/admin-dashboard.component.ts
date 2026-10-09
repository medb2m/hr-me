import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs/operators';
import {
  LucideBriefcase,
  LucideCalendar,
  LucideLayoutGrid,
  LucideTicket,
  LucideUserPlus,
  LucideUsers,
  LucideVideo,
} from '@lucide/angular';
import { AuthService } from '../../../../core/services/auth.service';
import { AdminUsersApiService, UserStats } from '../../services/admin-users-api.service';
import { ROLE_OPTIONS } from '../admin-users/admin-users.component';

@Component({
  selector: 'app-admin-dashboard',
  imports: [
    CommonModule,
    RouterLink,
    LucideBriefcase,
    LucideCalendar,
    LucideLayoutGrid,
    LucideTicket,
    LucideUserPlus,
    LucideUsers,
    LucideVideo,
  ],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.css',
})
export class AdminDashboardComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly api = inject(AdminUsersApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly user = this.auth.user;
  readonly roleLabels = ROLE_OPTIONS;

  stats: UserStats | null = null;
  loadingStats = true;
  statsError = '';

  ngOnInit(): void {
    this.api
      .stats()
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => (this.loadingStats = false)))
      .subscribe({
        next: (s) => (this.stats = s),
        error: () => (this.statsError = 'Statistiques indisponibles.'),
      });
  }

  roleLabel(role: string): string {
    return this.roleLabels.find((r) => r.value === role)?.label ?? role;
  }

  verifiedPercent(): number {
    if (!this.stats || this.stats.total === 0) return 0;
    return Math.round((this.stats.verified / this.stats.total) * 100);
  }
}
