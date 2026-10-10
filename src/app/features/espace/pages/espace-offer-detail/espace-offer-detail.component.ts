import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import {
  LucideArrowLeft,
  LucideBanknote,
  LucideBriefcase,
  LucideBuilding2,
  LucideCheck,
  LucideClock,
  LucideFileText,
  LucideLaptop,
  LucideMapPin,
  LucidePaperclip,
  LucideSend,
  LucideTimer,
  LucideUpload,
  LucideUsers,
  LucideWifi,
  LucideX,
} from '@lucide/angular';
import { OfferService, PublicOffer } from '../../../../services/offer.service';
import { ApplicationsService } from '../../../../services/applications.service';
import { AuthService } from '../../../../core/services/auth.service';
import { FlagComponent } from '../../../../shared/components/flag/flag.component';
import { RichTextEditorComponent } from '../../../../shared/components/rich-text-editor/rich-text-editor.component';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Envoyée',
  applied: 'Envoyée',
  review: 'En révision',
  accepted: 'Acceptée',
  rejected: 'Refusée',
};

@Component({
  selector: 'app-espace-offer-detail',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    FlagComponent,
    RichTextEditorComponent,
    LucideArrowLeft,
    LucideBanknote,
    LucideBriefcase,
    LucideBuilding2,
    LucideCheck,
    LucideClock,
    LucideFileText,
    LucideLaptop,
    LucideMapPin,
    LucidePaperclip,
    LucideSend,
    LucideTimer,
    LucideUpload,
    LucideUsers,
    LucideWifi,
    LucideX,
  ],
  templateUrl: './espace-offer-detail.component.html',
  styleUrl: './espace-offer-detail.component.css',
})
export class EspaceOfferDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly offers = inject(OfferService);
  private readonly apps = inject(ApplicationsService);
  protected readonly auth = inject(AuthService);

  offer: PublicOffer | null = null;
  loading = true;
  errorMsg = '';

  // Formulaire de candidature
  applyOpen = false;
  appName = '';
  appEmail = '';
  appMessage = '';
  cvFile: File | null = null;
  extraFiles: File[] = [];
  sending = false;
  sendError = '';
  sent = false;

  ngOnInit(): void {
    const u = this.auth.user();
    this.appName = u?.name || '';
    this.appEmail = u?.email || '';
    const id = this.route.snapshot.paramMap.get('id') || '';
    this.offers
      .getPublicOffer(id)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: ({ offer }) => {
          this.offer = offer;
          this.sent = offer.applied;
        },
        error: () => {
          this.errorMsg = 'Offre introuvable ou plus disponible.';
        },
      });
  }

  statusLabel(s?: string): string {
    return STATUS_LABELS[s || 'pending'] || 'Envoyée';
  }

  modeLabel(m: string): string {
    return m === 'remote' ? 'Remote' : m === 'hybrid' ? 'Hybride' : 'Sur site';
  }

  deadlineLabel(o: PublicOffer): string {
    if (o.daysLeft === null) return '';
    if (o.daysLeft === 0) return 'Dernier jour pour postuler';
    return `Plus que ${o.daysLeft} jour${o.daysLeft > 1 ? 's' : ''} pour postuler`;
  }

  fmtDate(d: string | null): string {
    if (!d) return '—';
    const dt = new Date(d);
    return Number.isNaN(dt.getTime())
      ? '—'
      : dt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  onCvPick(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    this.cvFile = input.files?.[0] || null;
    input.value = '';
  }

  onExtraPick(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    for (const f of files) {
      if (this.extraFiles.length < 5 && !this.extraFiles.some((x) => x.name === f.name)) {
        this.extraFiles.push(f);
      }
    }
    input.value = '';
  }

  removeExtra(i: number): void {
    this.extraFiles.splice(i, 1);
  }

  get canSubmit(): boolean {
    return !!this.appName.trim() && !this.sending;
  }

  toggleApply(): void {
    this.applyOpen = !this.applyOpen;
    if (this.applyOpen) {
      setTimeout(() => {
        document.getElementById('apply-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    }
  }

  submit(): void {
    if (!this.offer || !this.canSubmit) return;
    this.sendError = '';
    this.sending = true;
    this.apps
      .apply({
        offerId: this.offer.id,
        name: this.appName.trim(),
        email: this.appEmail.trim(),
        message: this.appMessage,
        cv: this.cvFile,
        attachments: this.extraFiles,
      })
      .pipe(finalize(() => (this.sending = false)))
      .subscribe({
        next: () => {
          this.sent = true;
          this.applyOpen = false;
          if (this.offer) {
            this.offer.applied = true;
            this.offer.myStatus = 'pending';
            this.offer.applicationsCount += 1;
          }
        },
        error: (err) => {
          const m = err?.error?.message;
          if (err?.status === 409) {
            this.sent = true;
            if (this.offer) this.offer.applied = true;
          }
          this.sendError = m || 'Envoi impossible pour le moment.';
        },
      });
  }
}
