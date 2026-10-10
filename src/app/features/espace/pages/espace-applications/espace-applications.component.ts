import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import {
  LucideBuilding2,
  LucideCalendar,
  LucideFileText,
  LucideSearch,
  LucideSend,
  LucideTimer,
} from '@lucide/angular';
import { ApplicationsService, ApplicationStatus, MyApplication } from '../../../../services/applications.service';
import { FlagComponent } from '../../../../shared/components/flag/flag.component';

type Filter = '' | ApplicationStatus;

const STATUS_META: Record<ApplicationStatus, { label: string; cls: string }> = {
  pending: { label: 'Envoyée', cls: 'pending' },
  review: { label: 'En révision', cls: 'review' },
  accepted: { label: 'Acceptée', cls: 'accepted' },
  rejected: { label: 'Refusée', cls: 'rejected' },
};

@Component({
  selector: 'app-espace-applications',
  imports: [
    CommonModule,
    RouterLink,
    FlagComponent,
    LucideBuilding2,
    LucideCalendar,
    LucideFileText,
    LucideSearch,
    LucideSend,
    LucideTimer,
  ],
  templateUrl: './espace-applications.component.html',
  styleUrl: './espace-applications.component.css',
})
export class EspaceApplicationsComponent implements OnInit {
  private readonly api = inject(ApplicationsService);

  applications: MyApplication[] = [];
  loading = false;
  errorMsg = '';
  filter: Filter = '';

  ngOnInit(): void {
    this.loading = true;
    this.api
      .mine()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: ({ applications }) => {
          this.applications = applications;
        },
        error: () => {
          this.errorMsg = 'Impossible de charger tes candidatures.';
        },
      });
  }

  filtered(): MyApplication[] {
    if (!this.filter) return this.applications;
    return this.applications.filter((a) => a.status === this.filter);
  }

  count(f: Filter): number {
    if (!f) return this.applications.length;
    return this.applications.filter((a) => a.status === f).length;
  }

  setFilter(f: Filter): void {
    this.filter = f;
  }

  statusLabel(s: ApplicationStatus): string {
    return STATUS_META[s]?.label || s;
  }

  statusCls(s: ApplicationStatus): string {
    return STATUS_META[s]?.cls || 'pending';
  }

  fmtDate(d: string): string {
    const dt = new Date(d);
    return Number.isNaN(dt.getTime())
      ? '—'
      : dt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  trackById(_i: number, a: MyApplication): string {
    return a.id;
  }
}
