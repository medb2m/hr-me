import { Component, DestroyRef, inject, OnDestroy, OnInit, ViewChild, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BackButtonComponent } from '../../../../shared/components/back-button/back-button.component';
import { finalize } from 'rxjs/operators';
import {
  LucideBadgeCheck,
  LucideCake,
  LucideCamera,
  LucideCheck,
  LucideCrop,
  LucideHistory,
  LucideListChecks,
  LucideTrash2,
  LucideUserRound,
} from '@lucide/angular';
import {
  ClientProfileSections,
  ClientProfileStateService,
} from '../../services/client-profile-state.service';
import {
  ClientProfileApiService,
  type ClientProfileDto,
} from '../../services/client-profile-api.service';
import { ProfilePhotoUploadComponent } from '../../../../shared/components/profile-photo-upload/profile-photo-upload.component';

@Component({
  selector: 'app-client-profile-page',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    ProfilePhotoUploadComponent,
    BackButtonComponent,
    LucideBadgeCheck,
    LucideCake,
    LucideCamera,
    LucideCheck,
    LucideCrop,
    LucideHistory,
    LucideListChecks,
    LucideTrash2,
    LucideUserRound,
  ],
  templateUrl: './client-profile-page.component.html',
  styleUrl: './client-profile-page.component.css',
})
export class ClientProfilePageComponent implements OnInit, OnDestroy {
  @ViewChild(ProfilePhotoUploadComponent) private profilePhotoField?: ProfilePhotoUploadComponent;

  readonly profileState = inject(ClientProfileStateService);
  readonly profileApi = inject(ClientProfileApiService);
  private readonly destroyRef = inject(DestroyRef);

  uploading = false;
  uploadError = '';

  /** Photos précédentes conservées sur le serveur (hors photo active). */
  photoHistory: Array<{ _id: string; url: string; uploadedAt?: string }> = [];
  historyBusyId: string | null = null;
  historyError = '';

  readonly sectionRows: { key: keyof ClientProfileSections; label: string }[] = [
    { key: 'personalInfo', label: 'Informations personnelles' },
    { key: 'workHistory', label: 'Expériences professionnelles' },
    { key: 'education', label: 'Formation & diplômes' },
    { key: 'skills', label: 'Compétences' },
    { key: 'languages', label: 'Langues (CEFR, etc.)' },
    { key: 'digitalSkills', label: 'Compétences numériques' },
  ];

  /** Valeur du champ `type="date"` (YYYY-MM-DD), synchronisée avec le serveur. */
  birthDateIso = '';
  savingBirth = false;
  birthSaveError = '';

  /** Âge calculé depuis la date enregistrée (affichage contextuel). */
  readonly age = computed(() => {
    const iso = this.profileState.birthDate();
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
      return null;
    }
    const birth = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(birth.getTime())) {
      return null;
    }
    const now = new Date();
    let a = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
      a--;
    }
    return a >= 0 && a <= 120 ? a : null;
  });

  /** Pour le cercle de progression SVG (r = 26 → circonférence ≈ 163.4). */
  readonly progressDash = computed(() => {
    const c = 2 * Math.PI * 26;
    const pct = this.profileState.completionPercent();
    return `${(c * pct) / 100} ${c}`;
  });

  /** Bulle de succès près du pointeur (coordonnées viewport). */
  successAnchor: { x: number; y: number; message: string } | null = null;
  private successClearTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnDestroy(): void {
    this.clearSuccessBubble();
  }

  ngOnInit(): void {
    this.profileApi
      .getProfile()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ profile }) => {
          this.applyServerProfile(profile);
          this.syncBirthDateFromState();
        },
        error: () => {},
      });
  }

  private applyServerProfile(p: ClientProfileDto): void {
    this.profileState.applyFromServerProfile(p);
    this.photoHistory = [...(p.profilePhotoHistory ?? [])].sort(
      (a, b) =>
        new Date(b.uploadedAt ?? 0).getTime() - new Date(a.uploadedAt ?? 0).getTime(),
    );
  }

  private syncBirthDateFromState(): void {
    this.birthDateIso = this.profileState.birthDate() ?? '';
  }

  hasServerProfilePhoto(): boolean {
    const u = this.profileState.profilePhotoUrl();
    return typeof u === 'string' && u.startsWith('/uploads/');
  }

  clearPhotoUploadError(): void {
    this.uploadError = '';
  }

  onProfilePhotoUpload(file: File): void {
    this.uploading = true;
    this.uploadError = '';
    this.profileApi
      .uploadProfilePhoto(file)
      .pipe(finalize(() => (this.uploading = false)))
      .subscribe({
        next: ({ profile }) => {
          this.applyServerProfile(profile);
          this.profilePhotoField?.resetPending();
        },
        error: (err: { error?: { message?: string } }) => {
          this.uploadError = err.error?.message || 'Envoi impossible.';
        },
      });
  }

  removeServerPhoto(): void {
    this.uploading = true;
    this.uploadError = '';
    this.profileApi
      .deleteProfilePhoto()
      .pipe(finalize(() => (this.uploading = false)))
      .subscribe({
        next: ({ profile }) => this.applyServerProfile(profile),
        error: (err: { error?: { message?: string } }) => {
          this.uploadError = err.error?.message || 'Suppression impossible.';
        },
      });
  }

  async recropHistoryAsProfile(entry: { _id: string; url: string }): Promise<void> {
    this.historyError = '';
    const resolved = this.profileApi.resolveMediaUrl(entry.url);
    if (!resolved) {
      this.historyError = 'URL d’image invalide.';
      return;
    }
    try {
      await this.profilePhotoField?.beginRecropFromAbsoluteUrl(resolved);
    } catch {
      this.historyError = 'Impossible d’ouvrir le recadrage.';
    }
  }

  activateHistoryPhoto(historyId: string): void {
    this.historyError = '';
    this.historyBusyId = historyId;
    this.profileApi
      .activateProfilePhotoFromHistory(historyId)
      .pipe(finalize(() => (this.historyBusyId = null)))
      .subscribe({
        next: ({ profile }) => this.applyServerProfile(profile),
        error: (err: { error?: { message?: string } }) => {
          this.historyError = err.error?.message || 'Action impossible.';
        },
      });
  }

  deleteHistoryPhoto(entry: { _id: string; url: string }): void {
    if (!confirm('Supprimer définitivement ce fichier du serveur ? Cette action est irréversible.')) {
      return;
    }
    this.historyError = '';
    this.historyBusyId = entry._id;
    this.profileApi
      .deleteProfilePhotoHistoryEntry(entry._id)
      .pipe(finalize(() => (this.historyBusyId = null)))
      .subscribe({
        next: ({ profile }) => this.applyServerProfile(profile),
        error: (err: { error?: { message?: string } }) => {
          this.historyError = err.error?.message || 'Suppression impossible.';
        },
      });
  }

  toggleSection(key: keyof import('../../services/client-profile-state.service').ClientProfileSections): void {
    const s = this.profileState.sections();
    this.profileState.patchSections({ [key]: !s[key] });
  }

  saveBirthDate(event: MouseEvent): void {
    const anchorX = event.clientX;
    const anchorY = event.clientY;
    this.savingBirth = true;
    this.birthSaveError = '';
    const raw = this.birthDateIso;
    const iso =
      raw != null && typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.trim()) ? raw.trim() : null;
    const payload = { birthDate: iso };
    this.profileApi
      .patchProfile(payload)
      .pipe(finalize(() => (this.savingBirth = false)))
      .subscribe({
        next: ({ profile }) => {
          this.applyServerProfile(profile);
          this.syncBirthDateFromState();
          const msg =
            iso == null
              ? 'Date de naissance effacée.'
              : 'Date de naissance enregistrée.';
          this.showSuccessNearPointer(anchorX, anchorY, msg);
        },
        error: (err: { error?: { message?: string } }) => {
          this.birthSaveError = err.error?.message || 'Enregistrement impossible.';
        },
      });
  }

  private showSuccessNearPointer(clientX: number, clientY: number, message: string): void {
    this.clearSuccessBubble();
    if (typeof window === 'undefined') {
      return;
    }
    const pad = 14;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let x = clientX + pad;
    let y = clientY + pad;
    const maxW = 260;
    x = Math.max(pad, Math.min(x, vw - maxW));
    y = Math.max(pad, Math.min(y, vh - 48));
    this.successAnchor = { x, y, message };
    this.successClearTimer = setTimeout(() => this.clearSuccessBubble(), 2600);
  }

  private clearSuccessBubble(): void {
    if (this.successClearTimer != null) {
      clearTimeout(this.successClearTimer);
      this.successClearTimer = null;
    }
    this.successAnchor = null;
  }

  setDemoPhoto(): void {
    this.profileState.setPhoto('assets/img/user.jpg');
  }

  clearPhoto(): void {
    this.profileState.setPhoto(null);
  }
}
