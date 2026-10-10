import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import {
  LucideArrowLeft,
  LucideBuilding2,
  LucideCheckCircle,
  LucideChevronRight,
  LucideClock,
  LucideFileText,
  LucideMail,
  LucidePaperclip,
  LucideRefreshCw,
  LucideSearch,
  LucideTimer,
  LucideUserCheck,
  LucideUsers,
  LucideXCircle,
} from '@lucide/angular';
import {
  AdminApplication,
  AdminAppStatus,
  AdminApplicationsApiService,
  AppSource,
  OfferApplicationsResult,
} from '../../services/admin-applications-api.service';
import { FlagComponent } from '../../../../shared/components/flag/flag.component';

const STATUS_META: Record<AdminAppStatus, { label: string; cls: string }> = {
  pending: { label: 'Envoyée', cls: 'pending' },
  review: { label: 'En révision', cls: 'review' },
  accepted: { label: 'Acceptée', cls: 'accepted' },
  rejected: { label: 'Refusée', cls: 'rejected' },
};

const SOURCE_META: Record<AppSource, string> = {
  candidate: 'Candidat',
  client: 'Client',
  agent: 'Agent RH',
};

@Component({
  selector: 'app-admin-offer-applications',
  imports: [
    CommonModule,
    RouterLink,
    FlagComponent,
    LucideArrowLeft,
    LucideBuilding2,
    LucideCheckCircle,
    LucideChevronRight,
    LucideClock,
    LucideFileText,
    LucideMail,
    LucidePaperclip,
    LucideRefreshCw,
    LucideSearch,
    LucideTimer,
    LucideUserCheck,
    LucideUsers,
    LucideXCircle,
  ],
  templateUrl: './admin-offer-applications.component.html',
  styleUrl: './admin-offer-applications.component.css',
})
export class AdminOfferApplicationsComponent implements OnInit {
  private readonly api = inject(AdminApplicationsApiService);
  private readonly route = inject(ActivatedRoute);

  offerId = '';
  result: OfferApplicationsResult | null = null;
  loading = false;
  errorMsg = '';
  savingId = '';

  statusFilter: '' | AdminAppStatus = '';
  sourceFilter: '' | AppSource = '';

  ngOnInit(): void {
    this.offerId = this.route.snapshot.paramMap.get('id') || '';
    this.load();
  }

  load(): void {
    this.loading = true;
    this.errorMsg = '';
    this.api
      .listForOffer(this.offerId, { status: this.statusFilter, source: this.sourceFilter })
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (r) => {
          this.result = r;
        },
        error: () => {
          this.errorMsg = 'Impossible de charger les candidatures.';
        },
      });
  }

  setStatus(f: '' | AdminAppStatus): void {
    this.statusFilter = f;
    this.load();
  }

  setSource(f: '' | AppSource): void {
    this.sourceFilter = f;
    this.load();
  }

  setAppStatus(a: AdminApplication, status: AdminAppStatus): void {
    if (a.status === status || this.savingId) return;
    this.savingId = a.id;
    this.api
      .update(a.id, { status })
      .pipe(finalize(() => (this.savingId = '')))
      .subscribe({
        next: () => {
          a.status = status;
          this.load();
        },
        error: () => {
          this.errorMsg = 'Changement de statut impossible.';
        },
      });
  }

  statusLabel(s: AdminAppStatus): string {
    return STATUS_META[s]?.label || s;
  }

  statusCls(s: AdminAppStatus): string {
    return STATUS_META[s]?.cls || 'pending';
  }

  sourceLabel(s: AppSource): string {
    return SOURCE_META[s] || s;
  }

  displayName(a: AdminApplication): string {
    return a.applicantName || a.profile?.name || a.user?.name || a.user?.email || '—';
  }

  avatarOf(a: AdminApplication): string {
    return a.profile?.photoUrl || a.user?.avatarUrl || '';
  }

  initials(a: AdminApplication): string {
    const n = this.displayName(a).trim();
    if (!n || n === '—') return '?';
    return n
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
  }

  fmtDate(d: string): string {
    const dt = new Date(d);
    return Number.isNaN(dt.getTime())
      ? '—'
      : dt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) +
          ' ' +
          dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  trackById(_i: number, a: AdminApplication): string {
    return a.id;
  }
}
