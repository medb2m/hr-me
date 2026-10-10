import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, forkJoin, of, switchMap } from 'rxjs';
import {
  LucideArrowLeft,
  LucideAward,
  LucideBanknote,
  LucideBriefcase,
  LucideBuilding2,
  LucideCheck,
  LucideClock,
  LucideExternalLink,
  LucideFileText,
  LucideGraduationCap,
  LucideLaptop,
  LucideMapPin,
  LucidePaperclip,
  LucidePenLine,
  LucideSend,
  LucideShare2,
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
import { ClientCvApiService, ClientCvDto } from '../../services/client-cv-api.service';
import { mergeCvEditorState } from '../../models/cv-editor-state';
import {
  ClientDocumentDto,
  ClientDocumentsApiService,
  ClientDocKind,
} from '../../services/client-documents-api.service';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Envoyée',
  applied: 'Envoyée',
  review: 'En révision',
  accepted: 'Acceptée',
  rejected: 'Refusée',
};

const KIND_LABELS: Record<ClientDocKind, string> = {
  diploma: 'Diplôme',
  certificate: 'Certification',
  other: 'Autre',
};

/** Détail d'une offre côté candidat — postulation « Partager mon profil ». */
@Component({
  selector: 'app-client-offer-detail',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    FlagComponent,
    RichTextEditorComponent,
    LucideArrowLeft,
    LucideAward,
    LucideBanknote,
    LucideBriefcase,
    LucideBuilding2,
    LucideCheck,
    LucideClock,
    LucideExternalLink,
    LucideFileText,
    LucideGraduationCap,
    LucideLaptop,
    LucideMapPin,
    LucidePaperclip,
    LucidePenLine,
    LucideSend,
    LucideShare2,
    LucideTimer,
    LucideUpload,
    LucideUsers,
    LucideWifi,
    LucideX,
  ],
  templateUrl: './client-offer-detail.component.html',
  styleUrl: './client-offer-detail.component.css',
})
export class ClientOfferDetailComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly offers = inject(OfferService);
  private readonly apps = inject(ApplicationsService);
  private readonly cvsApi = inject(ClientCvApiService);
  private readonly docsApi = inject(ClientDocumentsApiService);
  protected readonly auth = inject(AuthService);

  offer: PublicOffer | null = null;
  loading = true;
  errorMsg = '';

  // Formulaire « Partager mon profil »
  applyOpen = false;
  appName = '';
  appEmail = '';
  appMessage = '';
  extraFiles: File[] = [];
  sending = false;
  sendError = '';
  sent = false;

  // Partage profil
  cvs: ClientCvDto[] = [];
  docs: ClientDocumentDto[] = [];
  assetsLoading = false;
  assetsLoaded = false;
  sharedCvId = '';
  sharedDocIds = new Set<string>();
  // Personnalisation : copie du CV en cours de création / fraîchement créée
  customizingId = '';
  pendingCvId = '';
  customizeError = '';
  private readonly cvChannel =
    typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('alwassit-cv') : null;
  private readonly onWindowFocus = () => {
    if (this.applyOpen) {
      this.loadAssets(true);
    }
  };

  readonly kindLabels = KIND_LABELS;

  ngOnInit(): void {
    const u = this.auth.user();
    this.appName = u?.name || '';
    this.appEmail = u?.email || '';
    if (this.cvChannel) {
      this.cvChannel.onmessage = (e: MessageEvent) => {
        if ((e.data as { type?: string })?.type === 'cv-saved') {
          this.loadAssets(true);
        }
      };
    }
    window.addEventListener('focus', this.onWindowFocus);
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

  ngOnDestroy(): void {
    this.cvChannel?.close();
    window.removeEventListener('focus', this.onWindowFocus);
  }

  /** Charge CV + bibliothèque quand le panneau s'ouvre la première fois ; `force` = re-fetch. */
  loadAssets(force = false): void {
    if (this.assetsLoading || (!force && this.assetsLoaded)) return;
    this.assetsLoading = true;
    forkJoin({ cvs: this.cvsApi.listCvs(), docs: this.docsApi.list() })
      .pipe(
        finalize(() => {
          this.assetsLoading = false;
          this.assetsLoaded = true;
        }),
      )
      .subscribe({
        next: ({ cvs, docs }) => {
          this.cvs = cvs.cvs;
          this.docs = docs.documents;
          // Un CV personnalisé vient d'être enregistré dans l'autre onglet → sélection auto.
          if (this.pendingCvId && this.cvs.some((c) => c._id === this.pendingCvId)) {
            this.sharedCvId = this.pendingCvId;
            this.pendingCvId = '';
          } else if (!this.sharedCvId && this.cvs.length === 1) {
            this.sharedCvId = this.cvs[0]._id;
          }
        },
      });
  }

  /**
   * « Personnaliser » : duplique le CV (`nom — JJ/MM/AAAA HH:mm`) puis ouvre l'éditeur
   * sur la copie dans un nouvel onglet (window.open → l'éditeur pourra le refermer).
   */
  customizeCv(cv: ClientCvDto): void {
    if (this.customizingId) {
      return;
    }
    this.customizingId = cv._id;
    this.customizeError = '';
    this.cvsApi
      .getCv(cv._id)
      .pipe(
        switchMap(({ cv: src }) => {
          const stamp = new Intl.DateTimeFormat('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }).format(new Date());
          const base = src.name.slice(0, 88);
          return this.cvsApi
            .createCv({ name: `${base} — ${stamp}`, editorState: mergeCvEditorState(src.editorState) })
            .pipe(
              switchMap(({ cv: created }) =>
                src.photoSource === 'custom' && src.customPhotoUrl
                  ? this.cvsApi
                      .saveCv(created._id, {
                        photoSource: 'custom',
                        customPhotoUrl: src.customPhotoUrl,
                      })
                      .pipe(switchMap(() => of(created)))
                  : of(created),
              ),
            );
        }),
        finalize(() => (this.customizingId = '')),
      )
      .subscribe({
        next: (created) => {
          this.pendingCvId = created._id;
          const url = this.router.serializeUrl(
            this.router.createUrlTree(['/candidat/editor/cv', created._id], {
              queryParams: { from: 'apply' },
            }),
          );
          window.open(url, '_blank');
          this.loadAssets(true);
        },
        error: () => {
          this.customizeError = 'Impossible de dupliquer ce CV — réessaie.';
        },
      });
  }

  toggleDoc(id: string): void {
    if (this.sharedDocIds.has(id)) this.sharedDocIds.delete(id);
    else this.sharedDocIds.add(id);
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

  fmtSize(bytes: number): string {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
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
      this.loadAssets();
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
        attachments: this.extraFiles,
        shareProfile: true,
        sharedCvId: this.sharedCvId,
        sharedDocIds: [...this.sharedDocIds],
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
