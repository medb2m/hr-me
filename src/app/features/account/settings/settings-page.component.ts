import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import {
  LucideBadgeCheck,
  LucideCircleCheck,
  LucideEye,
  LucideEyeOff,
  LucideImage,
  LucideKeyRound,
  LucideMail,
  LucideSettings,
  LucideTriangleAlert,
  LucideUserRound,
} from '@lucide/angular';
import { AuthService } from '../../../core/services/auth.service';
import { BackButtonComponent } from '../../../shared/components/back-button/back-button.component';
import { ProfilePhotoUploadComponent } from '../../../shared/components/profile-photo-upload/profile-photo-upload.component';
import { ClientProfileApiService } from '../../client/services/client-profile-api.service';
import { AccountApiService, AccountUser } from '../services/account-api.service';
import { normalizePersonName } from '../../../shared/utils/person-name';

const DEFAULT_AVATAR = '/assets/img/default-avatar.jpg';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrateur',
  client: 'Candidat',
  candidate: 'Candidat qualifié',
  recruiter: 'Recruteur / Partenaire',
};

const TIMEZONES = [
  'Africa/Tunis',
  'Africa/Algiers',
  'Africa/Casablanca',
  'Europe/Paris',
  'Europe/Brussels',
  'Europe/Rome',
  'Europe/Madrid',
  'Europe/Lisbon',
  'Europe/Warsaw',
  'Europe/Tirane',
  'Europe/Berlin',
  'Europe/London',
  'Asia/Qatar',
  'Asia/Dubai',
  'Asia/Riyadh',
  'America/New_York',
  'America/Toronto',
  'UTC',
];

@Component({
  selector: 'app-settings-page',
  imports: [
    CommonModule,
    FormsModule,
    LucideBadgeCheck,
    LucideCircleCheck,
    LucideEye,
    LucideEyeOff,
    LucideKeyRound,
    LucideMail,
    LucideSettings,
    LucideTriangleAlert,
    LucideUserRound,
    LucideImage,
    BackButtonComponent,
    ProfilePhotoUploadComponent,
  ],
  templateUrl: './settings-page.component.html',
  styleUrl: './settings-page.component.css',
})
export class SettingsPageComponent implements OnInit {
  private readonly api = inject(AccountApiService);
  private readonly auth = inject(AuthService);
  private readonly clientApi = inject(ClientProfileApiService);
  private readonly destroyRef = inject(DestroyRef);

  account: AccountUser | null = null;
  loading = true;
  loadError = '';

  // Profile form
  name = '';
  timeZone = '';
  savingProfile = false;
  profileMsg = '';
  profileError = '';
  readonly timeZones = this.buildTimeZoneList();

  // Email change
  editingEmail = false;
  newEmail = '';
  emailBusy = false;
  emailMsg = '';
  emailError = '';

  // Password
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';
  showCurrent = false;
  showNew = false;
  showConfirm = false;
  passwordBusy = false;
  passwordMsg = '';
  passwordError = '';

  // Photo du compte
  avatarBusy = false;
  avatarMsg = '';
  avatarError = '';
  /** Photos déjà uploadées dans le dossier candidat (client/candidate uniquement). */
  historyPhotos: Array<{ _id: string; url: string }> = [];

  ngOnInit(): void {
    this.api
      .getMe()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => (this.loading = false)),
      )
      .subscribe({
        next: ({ user }) => {
          this.applyUser(user);
          this.loadHistoryPhotos();
        },
        error: () => (this.loadError = 'Impossible de charger votre compte.'),
      });
  }

  get roleLabel(): string {
    return ROLE_LABELS[this.account?.role ?? ''] ?? this.account?.role ?? '';
  }

  get initials(): string {
    const src = (this.account?.name || this.account?.email || '?').trim();
    return src
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('');
  }

  get memberSince(): string {
    const d = this.account?.createdAt;
    if (!d) return '';
    return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(new Date(d));
  }

  // ---------- Photo du compte ----------

  get avatarSrc(): string {
    return this.account?.avatarUrl || DEFAULT_AVATAR;
  }

  get isDossierRole(): boolean {
    const r = this.account?.role;
    return r === 'client' || r === 'candidate';
  }

  media(url: string): string {
    return this.clientApi.resolveMediaUrl(url) ?? '';
  }

  trackHistoryId(_i: number, h: { _id: string }): string {
    return h._id;
  }

  onAvatarUpload(file: File): void {
    this.avatarBusy = true;
    this.avatarMsg = '';
    this.avatarError = '';
    this.api
      .uploadAvatar(file)
      .pipe(finalize(() => (this.avatarBusy = false)))
      .subscribe({
        next: ({ user }) => this.applyAvatar(user, 'Photo de compte enregistrée.'),
        error: (err) => (this.avatarError = err.error?.message || 'Envoi impossible.'),
      });
  }

  onAvatarRemove(): void {
    this.avatarBusy = true;
    this.avatarMsg = '';
    this.avatarError = '';
    this.api
      .removeAvatar()
      .pipe(finalize(() => (this.avatarBusy = false)))
      .subscribe({
        next: ({ user }) => this.applyAvatar(user, 'Photo supprimée — photo par défaut restaurée.'),
        error: (err) => (this.avatarError = err.error?.message || 'Suppression impossible.'),
      });
  }

  pickHistoryPhoto(url: string): void {
    if (this.avatarBusy || this.account?.avatarUrl === url) return;
    this.avatarBusy = true;
    this.avatarMsg = '';
    this.avatarError = '';
    this.api
      .setAvatar(url)
      .pipe(finalize(() => (this.avatarBusy = false)))
      .subscribe({
        next: ({ user }) => this.applyAvatar(user, 'Photo de compte enregistrée.'),
        error: (err) => (this.avatarError = err.error?.message || 'Sélection impossible.'),
      });
  }

  private applyAvatar(user: AccountUser, msg: string): void {
    this.account = user;
    this.auth.updateStoredUser({ avatarUrl: user.avatarUrl });
    this.avatarMsg = msg;
  }

  private loadHistoryPhotos(): void {
    if (!this.isDossierRole) return;
    this.clientApi
      .getProfile()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ profile }) => {
          const h = profile.profilePhotoHistory ?? [];
          this.historyPhotos = [...h].reverse();
        },
        error: () => {},
      });
  }

  /** Normalise la casse du nom à la sortie du champ (même règle qu'à l'inscription). */
  onNameBlur(): void {
    const normalized = normalizePersonName(this.name);
    if (normalized !== this.name.trim()) {
      this.name = normalized;
    }
  }

  saveProfile(): void {
    this.savingProfile = true;
    this.profileMsg = '';
    this.profileError = '';
    this.api
      .updateMe({ name: this.name, timeZone: this.timeZone || null })
      .pipe(finalize(() => (this.savingProfile = false)))
      .subscribe({
        next: ({ user }) => {
          this.applyUser(user);
          this.auth.updateStoredUser({ name: user.name });
          this.profileMsg = 'Informations enregistrées.';
        },
        error: (err) => (this.profileError = err.error?.message || 'Enregistrement impossible.'),
      });
  }

  startEmailEdit(): void {
    this.editingEmail = true;
    this.newEmail = '';
    this.emailMsg = '';
    this.emailError = '';
  }

  requestEmailChange(): void {
    this.emailBusy = true;
    this.emailMsg = '';
    this.emailError = '';
    this.api
      .requestEmailChange(this.newEmail)
      .pipe(finalize(() => (this.emailBusy = false)))
      .subscribe({
        next: ({ user, message }) => {
          this.applyUser(user);
          this.editingEmail = false;
          this.newEmail = '';
          this.emailMsg = message;
        },
        error: (err) => (this.emailError = err.error?.message || 'Demande impossible.'),
      });
  }

  cancelEmailChange(): void {
    this.emailBusy = true;
    this.emailError = '';
    this.api
      .cancelEmailChange()
      .pipe(finalize(() => (this.emailBusy = false)))
      .subscribe({
        next: ({ user }) => this.applyUser(user),
        error: (err) => (this.emailError = err.error?.message || 'Action impossible.'),
      });
  }

  get passwordMismatch(): boolean {
    return this.confirmPassword.length > 0 && this.newPassword !== this.confirmPassword;
  }

  changePassword(): void {
    this.passwordBusy = true;
    this.passwordMsg = '';
    this.passwordError = '';
    this.api
      .changePassword({ currentPassword: this.currentPassword, newPassword: this.newPassword })
      .pipe(finalize(() => (this.passwordBusy = false)))
      .subscribe({
        next: () => {
          this.currentPassword = '';
          this.newPassword = '';
          this.confirmPassword = '';
          this.passwordMsg = 'Mot de passe mis à jour.';
        },
        error: (err) => (this.passwordError = err.error?.message || 'Mise à jour impossible.'),
      });
  }

  private applyUser(user: AccountUser): void {
    this.account = user;
    this.name = user.name;
    this.timeZone = user.timeZone ?? '';
    if (this.timeZone && !this.timeZones.includes(this.timeZone)) {
      this.timeZones.unshift(this.timeZone);
    }
  }

  private buildTimeZoneList(): string[] {
    const zones = [...TIMEZONES];
    try {
      const local = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (local && !zones.includes(local)) {
        zones.unshift(local);
      }
    } catch {
      // SSR / older browsers — curated list is enough
    }
    return zones;
  }
}
