import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  PLATFORM_ID,
  ViewChild,
  inject,
} from '@angular/core';

/**
 * Miniature d'un document : rendu réel de la page 1 pour les PDF (pdf.js),
 * l'image elle-même pour JPG/PNG/WebP, contenu projeté sinon (icône).
 */
@Component({
  selector: 'app-doc-thumb',
  imports: [CommonModule],
  template: `
    @if (isImage()) {
      <img class="thumb-img" [src]="src" [alt]="alt" loading="lazy" />
    } @else if (isPdf()) {
      <canvas #pdfCanvas class="thumb-canvas" [class.thumb-canvas--ready]="rendered"></canvas>
      @if (!rendered) {
        <div class="thumb-fallback" aria-hidden="true">PDF</div>
      }
    } @else {
      <div class="thumb-icon"><ng-content /></div>
    }
  `,
  styleUrl: './doc-thumb.component.css',
})
export class DocThumbComponent implements AfterViewInit, OnChanges {
  /** URL du fichier (`/uploads/…` même origine). */
  @Input({ required: true }) src = '';
  @Input() mime = '';
  @Input() alt = '';

  @ViewChild('pdfCanvas') private canvasRef?: ElementRef<HTMLCanvasElement>;

  private readonly platformId = inject(PLATFORM_ID);
  rendered = false;
  private loadToken = 0;

  isImage(): boolean {
    return this.mime.startsWith('image/');
  }

  isPdf(): boolean {
    return this.mime === 'application/pdf';
  }

  ngAfterViewInit(): void {
    void this.renderPdf();
  }

  ngOnChanges(): void {
    this.rendered = false;
    void this.renderPdf();
  }

  /** Rend la page 1 du PDF dans le canvas — navigateur uniquement (SSR safe). */
  private async renderPdf(): Promise<void> {
    if (!isPlatformBrowser(this.platformId) || !this.isPdf() || !this.src) {
      return;
    }
    const token = ++this.loadToken;
    try {
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = 'assets/pdf.worker.min.mjs';
      const doc = await pdfjs.getDocument(this.src).promise;
      const page = await doc.getPage(1);
      if (token !== this.loadToken) {
        return;
      }
      const canvas = this.canvasRef?.nativeElement;
      if (!canvas) {
        // La vue @else n'est pas encore créée — réessaie au prochain tick.
        setTimeout(() => void this.renderPdf(), 50);
        return;
      }
      const base = page.getViewport({ scale: 1 });
      const targetH = 220;
      const viewport = page.getViewport({ scale: targetH / base.height });
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return;
      }
      await page.render({
        canvasContext: ctx,
        viewport,
        transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
      }).promise;
      this.rendered = true;
      void doc.destroy();
    } catch {
      this.rendered = false;
    }
  }
}
