import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  Output,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import {
  CROP_OUTPUT_PX,
  CROP_VIEWPORT_PX,
  clampPan,
  computeBaseCoverScale,
  visibleRectInNaturalImage,
} from './profile-photo-crop.util';

const ACCEPT_ATTR = 'image/jpeg,image/png,image/webp';
const MAX_BYTES = 2 * 1024 * 1024;
const ALLOW = new Set(['image/jpeg', 'image/png', 'image/webp']);

@Component({
  selector: 'app-profile-photo-upload',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './profile-photo-upload.component.html',
  styleUrl: './profile-photo-upload.component.css',
})
export class ProfilePhotoUploadComponent implements OnDestroy {
  private readonly doc = inject(DOCUMENT);

  @ViewChild('fileInput') fileInputRef?: ElementRef<HTMLInputElement>;
  @ViewChild('cropImg') cropImgRef?: ElementRef<HTMLImageElement>;
  @ViewChild('cropViewport') cropViewportRef?: ElementRef<HTMLDivElement>;

  @Input() uploading = false;
  @Input() errorMessage = '';
  @Input() hasServerPhoto = false;

  @Output() readonly upload = new EventEmitter<File>();
  @Output() readonly removeServer = new EventEmitter<void>();
  @Output() readonly validFileSelected = new EventEmitter<void>();

  readonly pendingFile = signal<File | null>(null);
  readonly previewDisplay = signal<string | null>(null);
  readonly pickHint = signal<string | null>(null);
  /** true pendant qu'un fichier est survolé sur la zone de dépôt. */
  readonly dragActive = signal(false);

  /** Image en cours de recadrage (object URL). */
  readonly cropSourceUrl = signal<string | null>(null);
  private cropSourceObjectUrl: string | null = null;
  private cropOriginalName = '';
  private cropOriginalMime = '';

  readonly natW = signal(0);
  readonly natH = signal(0);
  readonly baseScaleSig = signal(1);
  /** 100 = zoom minimal (cadre plein), 250 = zoom max. */
  readonly zoomPercent = signal(100);
  readonly panX = signal(0);
  readonly panY = signal(0);
  readonly cropReady = signal(false);

  private drag: { startClientX: number; startClientY: number; startPanX: number; startPanY: number } | null =
    null;

  readonly acceptAttr = ACCEPT_ATTR;

  readonly viewportPx = CROP_VIEWPORT_PX;

  readonly displayScale = computed(() => this.baseScaleSig() * (this.zoomPercent() / 100));

  readonly cropImgDisplayW = computed(() => Math.max(1, this.natW() * this.displayScale()));

  readonly cropImgDisplayH = computed(() => Math.max(1, this.natH() * this.displayScale()));

  ngOnDestroy(): void {
    this.endDrag();
    this.revokePreview();
    this.revokeCropSource();
  }

  onFileInputChange(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.applyPickedFile(file);
  }

  /**
   * Charge une image déjà sur le serveur (ex. entrée d’historique) pour le même flux de recadrage qu’un fichier local.
   */
  async beginRecropFromAbsoluteUrl(absoluteUrl: string): Promise<void> {
    this.pickHint.set(null);
    this.clearLocalSelection();
    try {
      const res = await fetch(absoluteUrl, { credentials: 'same-origin' });
      if (!res.ok) {
        this.pickHint.set('Impossible de charger cette image.');
        return;
      }
      const blob = await res.blob();
      let resolvedType = blob.type?.trim() || '';
      if (!ALLOW.has(resolvedType)) {
        if (resolvedType === '' || resolvedType === 'application/octet-stream') {
          resolvedType = 'image/jpeg';
        } else if (!resolvedType.startsWith('image/')) {
          this.pickHint.set('Fichier non reconnu comme image.');
          return;
        }
      }
      const ext =
        resolvedType === 'image/png' ? 'png' : resolvedType === 'image/webp' ? 'webp' : 'jpg';
      const file = new File([blob], `photo-historique.${ext}`, { type: resolvedType });
      const err = this.validateImageFile(file);
      if (err) {
        this.pickHint.set(err);
        return;
      }
      this.applyPickedFile(file);
    } catch {
      this.pickHint.set('Impossible de charger cette image.');
    }
  }

  openFilePicker(): void {
    if (this.cropSourceUrl()) {
      return;
    }
    this.fileInputRef?.nativeElement?.click();
  }

  onDropZoneKeydown(ev: KeyboardEvent): void {
    if (this.cropSourceUrl()) {
      return;
    }
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      this.openFilePicker();
    }
  }

  /** Taille lisible du fichier en attente (« 1,4 Mo »). */
  readonly pendingSizeLabel = computed(() => {
    const f = this.pendingFile();
    if (!f) return '';
    return f.size >= 1024 * 1024
      ? `${(f.size / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`
      : `${Math.max(1, Math.round(f.size / 1024))} Ko`;
  });

  // ---------- glisser-déposer ----------

  onDragOver(ev: DragEvent): void {
    if (this.cropSourceUrl()) return;
    ev.preventDefault();
    ev.stopPropagation();
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'copy';
    this.dragActive.set(true);
  }

  onDragLeave(ev: DragEvent): void {
    ev.preventDefault();
    // Ne désactive que si on sort vraiment de la zone (pas un enfant).
    const zone = ev.currentTarget as HTMLElement;
    if (!zone.contains(ev.relatedTarget as Node)) {
      this.dragActive.set(false);
    }
  }

  onDrop(ev: DragEvent): void {
    ev.preventDefault();
    ev.stopPropagation();
    this.dragActive.set(false);
    if (this.cropSourceUrl()) return;
    const file = ev.dataTransfer?.files?.[0] ?? null;
    this.applyPickedFile(file);
  }

  clearLocalSelection(): void {
    this.cancelCropInternal();
    this.revokePreview();
    this.pendingFile.set(null);
    this.previewDisplay.set(null);
    this.pickHint.set(null);
    if (this.fileInputRef?.nativeElement) {
      this.fileInputRef.nativeElement.value = '';
    }
  }

  resetPending(): void {
    this.clearLocalSelection();
  }

  emitUpload(): void {
    const f = this.pendingFile();
    if (!f || this.uploading || this.cropSourceUrl()) {
      return;
    }
    this.upload.emit(f);
  }

  emitRemoveServer(): void {
    if (this.uploading || !this.hasServerPhoto) {
      return;
    }
    this.removeServer.emit();
  }

  onCropImageLoad(): void {
    const el = this.cropImgRef?.nativeElement;
    if (!el) {
      return;
    }
    const w = el.naturalWidth;
    const h = el.naturalHeight;
    if (w < 1 || h < 1) {
      this.pickHint.set('Image invalide.');
      this.cancelCropInternal();
      return;
    }
    this.natW.set(w);
    this.natH.set(h);
    this.baseScaleSig.set(computeBaseCoverScale(w, h, CROP_VIEWPORT_PX));
    this.zoomPercent.set(100);
    this.resetPanCenter();
    this.cropReady.set(true);
  }

  onZoomInput(ev: Event): void {
    const v = Number((ev.target as HTMLInputElement).value);
    if (!Number.isFinite(v)) {
      return;
    }
    this.zoomPercent.set(Math.min(250, Math.max(100, v)));
    const c = clampPan(this.panX(), this.panY(), this.natW(), this.natH(), this.displayScale(), CROP_VIEWPORT_PX);
    this.panX.set(c.x);
    this.panY.set(c.y);
  }

  onCropWheel(ev: WheelEvent): void {
    if (!this.cropViewportRef?.nativeElement?.contains(ev.target as Node)) {
      return;
    }
    ev.preventDefault();
    const delta = ev.deltaY > 0 ? -8 : 8;
    this.zoomPercent.set(Math.min(250, Math.max(100, this.zoomPercent() + delta)));
    const c = clampPan(this.panX(), this.panY(), this.natW(), this.natH(), this.displayScale(), CROP_VIEWPORT_PX);
    this.panX.set(c.x);
    this.panY.set(c.y);
  }

  onCropPointerDown(ev: PointerEvent): void {
    if (!this.cropReady() || ev.button !== 0) {
      return;
    }
    const vp = this.cropViewportRef?.nativeElement;
    vp?.setPointerCapture(ev.pointerId);
    this.drag = {
      startClientX: ev.clientX,
      startClientY: ev.clientY,
      startPanX: this.panX(),
      startPanY: this.panY(),
    };
  }

  @HostListener('document:pointermove', ['$event'])
  onCropPointerMove(ev: PointerEvent): void {
    if (!this.drag) {
      return;
    }
    const dx = ev.clientX - this.drag.startClientX;
    const dy = ev.clientY - this.drag.startClientY;
    const nx = this.drag.startPanX + dx;
    const ny = this.drag.startPanY + dy;
    const c = clampPan(nx, ny, this.natW(), this.natH(), this.displayScale(), CROP_VIEWPORT_PX);
    this.panX.set(c.x);
    this.panY.set(c.y);
  }

  @HostListener('document:pointerup', ['$event'])
  onCropPointerUp(ev: PointerEvent): void {
    if (!this.drag) {
      return;
    }
    const vp = this.cropViewportRef?.nativeElement;
    try {
      vp?.releasePointerCapture(ev.pointerId);
    } catch {
      /* ignore */
    }
    this.drag = null;
  }

  @HostListener('document:pointercancel')
  onCropPointerCancel(): void {
    this.drag = null;
  }

  cancelCrop(): void {
    this.cancelCropInternal();
    if (this.fileInputRef?.nativeElement) {
      this.fileInputRef.nativeElement.value = '';
    }
  }

  confirmCrop(): void {
    const img = this.cropImgRef?.nativeElement;
    if (!img?.complete || !this.cropReady()) {
      return;
    }
    const natWi = img.naturalWidth;
    const natHi = img.naturalHeight;
    const ds = this.displayScale();
    let { sx, sy, sw, sh } = visibleRectInNaturalImage(this.panX(), this.panY(), ds, CROP_VIEWPORT_PX);
    sx = Math.max(0, sx);
    sy = Math.max(0, sy);
    sw = Math.min(sw, natWi - sx);
    sh = Math.min(sh, natHi - sy);
    if (sw < 1 || sh < 1) {
      this.pickHint.set('Recadrage invalide, réessayez.');
      return;
    }

    const canvas = this.doc.createElement('canvas');
    canvas.width = CROP_OUTPUT_PX;
    canvas.height = CROP_OUTPUT_PX;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, CROP_OUTPUT_PX, CROP_OUTPUT_PX);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          this.pickHint.set('Export impossible, réessayez.');
          return;
        }
        const base = (this.cropOriginalName || 'photo').replace(/\.[^/.]+$/, '');
        const file = new File([blob], `${base}.jpg`, { type: 'image/jpeg' });
        this.cancelCropInternal();
        this.setPendingFromCroppedFile(file);
      },
      'image/jpeg',
      0.9,
    );
  }

  private endDrag(): void {
    this.drag = null;
  }

  private resetPanCenter(): void {
    const ds = this.displayScale();
    const sw = this.natW() * ds;
    const sh = this.natH() * ds;
    const c = clampPan((CROP_VIEWPORT_PX - sw) / 2, (CROP_VIEWPORT_PX - sh) / 2, this.natW(), this.natH(), ds, CROP_VIEWPORT_PX);
    this.panX.set(c.x);
    this.panY.set(c.y);
  }

  private validateImageFile(file: File): string | null {
    if (!ALLOW.has(file.type)) {
      return 'Formats acceptés : JPEG, PNG ou WebP.';
    }
    if (file.size > MAX_BYTES) {
      return 'Fichier trop volumineux (max 2 Mo).';
    }
    return null;
  }

  private applyPickedFile(file: File | null): void {
    this.pickHint.set(null);
    this.revokePreview();
    this.pendingFile.set(null);
    this.previewDisplay.set(null);
    this.cancelCropInternal();

    if (!file) {
      return;
    }
    const err = this.validateImageFile(file);
    if (err) {
      this.pickHint.set(err);
      if (this.fileInputRef?.nativeElement) {
        this.fileInputRef.nativeElement.value = '';
      }
      return;
    }

    this.cropOriginalName = file.name;
    this.cropOriginalMime = file.type;
    this.revokeCropSource();
    const url = URL.createObjectURL(file);
    this.cropSourceObjectUrl = url;
    this.cropSourceUrl.set(url);
    this.natW.set(0);
    this.natH.set(0);
    this.cropReady.set(false);
  }

  private setPendingFromCroppedFile(file: File): void {
    this.revokePreview();
    this.pendingFile.set(file);
    const url = URL.createObjectURL(file);
    this.previewObjectUrl = url;
    this.previewDisplay.set(url);
    this.validFileSelected.emit();
  }

  private cancelCropInternal(): void {
    this.endDrag();
    this.revokeCropSource();
    this.natW.set(0);
    this.natH.set(0);
    this.zoomPercent.set(100);
    this.panX.set(0);
    this.panY.set(0);
    this.cropReady.set(false);
  }

  private revokeCropSource(): void {
    if (this.cropSourceObjectUrl) {
      URL.revokeObjectURL(this.cropSourceObjectUrl);
    }
    this.cropSourceObjectUrl = null;
    this.cropSourceUrl.set(null);
  }

  private previewObjectUrl: string | null = null;

  private revokePreview(): void {
    if (this.previewObjectUrl) {
      URL.revokeObjectURL(this.previewObjectUrl);
    }
    this.previewObjectUrl = null;
  }
}
