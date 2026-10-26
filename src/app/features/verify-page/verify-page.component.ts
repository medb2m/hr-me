import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import {
  LucideShieldCheck, LucideFileText, LucideCheckCircle2, LucideXCircle,
  LucideDownload, LucideBuilding2, LucideCalendarDays, LucideUser,
} from '@lucide/angular';
import { environment } from '../../../environments/environment';

interface VerifyResult {
  verified: boolean;
  message?: string;
  docName?: string;
  docMime?: string;
  holderName?: string;
  issuedAt?: string;
  summary?: string;
  aiSummary?: string;
  issuer?: string;
  fileUrl?: string;
}

@Component({
  selector: 'app-verify-page',
  imports: [CommonModule, LucideShieldCheck, LucideFileText, LucideCheckCircle2,
    LucideXCircle, LucideDownload, LucideBuilding2, LucideCalendarDays, LucideUser],
  template: `
<div class="vp">
  <header class="vp-top">
    <img src="/assets/img/al-wassit-logo.png" alt="Al Wassit" class="vp-logo" onerror="this.style.display='none'" />
    <span class="vp-tag">Talent ID Passport</span>
  </header>

  @if (loading) {
    <div class="vp-load"><span class="spin"></span> Vérification en cours…</div>
  } @else if (!v?.verified) {
    <div class="vp-card vp-card--bad">
      <svg lucideXCircle [size]="52"></svg>
      <h1>Document non vérifié</h1>
      <p>{{ v?.message || 'Ce lien de vérification est invalide ou a expiré.' }}</p>
      <a class="vp-home" href="/">Retour à alwassit.com</a>
    </div>
  } @else if (v) {
    <div class="vp-card">
      <div class="vp-seal">
        <svg lucideShieldCheck [size]="64"></svg>
        <div>
          <h1>Document vérifié</h1>
          <p>Authenticité confirmée par l'équipe de conformité Al Wassit — Tunisie.</p>
        </div>
      </div>

      <div class="vp-rows">
        <div class="vp-row">
          <span class="vp-lbl"><svg lucideFileText [size]="15"></svg> Document</span>
          <strong>{{ v.docName }}</strong>
        </div>
        <div class="vp-row">
          <span class="vp-lbl"><svg lucideUser [size]="15"></svg> Titulaire</span>
          <strong>{{ v.holderName || 'Candidat Al Wassit' }}</strong>
        </div>
        <div class="vp-row">
          <span class="vp-lbl"><svg lucideCalendarDays [size]="15"></svg> Vérifié le</span>
          <strong>{{ v.issuedAt | date:'dd MMMM yyyy' }}</strong>
        </div>
        <div class="vp-row">
          <span class="vp-lbl"><svg lucideBuilding2 [size]="15"></svg> Émetteur</span>
          <strong>{{ v.issuer }}</strong>
        </div>
      </div>

      @if (v.aiSummary || v.summary) {
        <div class="vp-summary">
          <h2>Résumé de conformité</h2>
          <p>{{ v.aiSummary || v.summary }}</p>
        </div>
      }

      <div class="vp-preview">
        <h2>Document</h2>
        @if (isImage()) {
          <img [src]="v.fileUrl" alt="Document vérifié" class="vp-img" />
        } @else if (v.docMime === 'application/pdf') {
          <iframe [src]="safeFile" class="vp-frame" title="Document vérifié"></iframe>
        } @else {
          <a class="vp-dl" [href]="v.fileUrl" target="_blank" rel="noopener">
            <svg lucideDownload [size]="16"></svg> Ouvrir le document
          </a>
        }
      </div>

      <footer class="vp-foot">
        <svg lucideCheckCircle2 [size]="15"></svg>
        Vérifié en Tunisie — aucune information falsifiée n'a été détectée dans ce document.
      </footer>
    </div>
  }
</div>
`,
  styleUrl: './verify-page.component.css',
})
export class VerifyPageComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly sanitizer = inject(DomSanitizer);

  loading = true;
  v: VerifyResult | null = null;
  safeFile: SafeResourceUrl | null = null;

  ngOnInit(): void {
    const token = this.route.snapshot.paramMap.get('token') || '';
    this.http.get<VerifyResult>(`${environment.apiUrl}/verify/${token}`).subscribe({
      next: (r) => {
        this.v = r;
        if (r.fileUrl) {
          this.safeFile = this.sanitizer.bypassSecurityTrustResourceUrl(r.fileUrl);
        }
        this.loading = false;
      },
      error: () => {
        this.v = { verified: false, message: 'Lien de vérification invalide ou expiré.' };
        this.loading = false;
      },
    });
  }

  isImage(): boolean {
    return (this.v?.docMime || '').startsWith('image/');
  }
}
