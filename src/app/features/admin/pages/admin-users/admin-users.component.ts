import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import {
  LucideBadgeCheck,
  LucideChevronLeft,
  LucideChevronRight,
  LucideEye,
  LucideEyeOff,
  LucidePencil,
  LucidePlus,
  LucideRefreshCw,
  LucideSearch,
  LucideTrash2,
  LucideUserCheck,
  LucideUsers,
  LucideX,
} from '@lucide/angular';
import { AuthService } from '../../../../core/services/auth.service';
import { AdminUsersApiService, AdminUser } from '../../services/admin-users-api.service';

export const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: 'client', label: 'Client' },
  { value: 'candidate', label: 'Candidat' },
  { value: 'agent', label: 'Agent' },
  { value: 'director', label: 'Directeur' },
  { value: 'recruiter', label: 'Recruteur / Partenaire' },
  { value: 'admin', label: 'Administrateur' },
];

@Component({
  selector: 'app-admin-users',
  imports: [
    CommonModule,
    FormsModule,
    LucideBadgeCheck,
    LucideChevronLeft,
    LucideChevronRight,
    LucideEye,
    LucideEyeOff,
    LucidePencil,
    LucidePlus,
    LucideRefreshCw,
    LucideSearch,
    LucideTrash2,
    LucideUserCheck,
    LucideUsers,
    LucideX,
  ],
  templateUrl: './admin-users.component.html',
  styleUrl: './admin-users.component.css',
})
export class AdminUsersComponent implements OnInit {
  private readonly api = inject(AdminUsersApiService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly roleOptions = ROLE_OPTIONS;

  users: AdminUser[] = [];
  total = 0;
  page = 1;
  pages = 1;
  limit = 10;
  readonly limitOptions = [10, 20, 50];

  search = '';
  roleFilter = '';
  loading = false;
  tableError = '';

  // Create / edit panel
  editing: AdminUser | null = null;
  formOpen = false;
  formName = '';
  formEmail = '';
  formRole = 'client';
  formPassword = '';
  formVerified = true;
  showFormPassword = false;
  formBusy = false;
  formError = '';

  // Delete confirm
  deleting: AdminUser | null = null;
  deleteBusy = false;
  deleteError = '';

  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.load();
  }

  load(page = this.page): void {
    this.loading = true;
    this.tableError = '';
    this.api
      .list({ page, limit: this.limit, role: this.roleFilter || undefined, q: this.search })
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => (this.loading = false)))
      .subscribe({
        next: (res) => {
          this.users = res.users;
          this.total = res.total;
          this.page = res.page;
          this.pages = res.pages;
        },
        error: (err) => (this.tableError = err.error?.message || 'Chargement impossible.'),
      });
  }

  onSearchInput(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.load(1), 350);
  }

  onRoleFilter(): void {
    this.load(1);
  }

  onLimitChange(): void {
    this.load(1);
  }

  prevPage(): void {
    if (this.page > 1) this.load(this.page - 1);
  }

  nextPage(): void {
    if (this.page < this.pages) this.load(this.page + 1);
  }

  // ---------- create / edit ----------

  openCreate(): void {
    this.editing = null;
    this.formName = '';
    this.formEmail = '';
    this.formRole = 'client';
    this.formPassword = '';
    this.formVerified = true;
    this.showFormPassword = false;
    this.formError = '';
    this.formOpen = true;
  }

  openEdit(u: AdminUser): void {
    this.editing = u;
    this.formName = u.name;
    this.formEmail = u.email;
    this.formRole = u.role;
    this.formPassword = '';
    this.formVerified = u.emailVerified;
    this.showFormPassword = false;
    this.formError = '';
    this.formOpen = true;
  }

  closeForm(): void {
    if (this.formBusy) return;
    this.formOpen = false;
  }

  isSelf(u: AdminUser): boolean {
    return this.auth.user()?.id === u.id;
  }

  submitForm(): void {
    this.formError = '';
    if (!this.editing && this.formPassword.length < 8) {
      this.formError = 'Le mot de passe doit contenir au moins 8 caractères.';
      return;
    }
    this.formBusy = true;
    const req$ = this.editing
      ? this.api.update(this.editing.id, {
          name: this.formName,
          email: this.formEmail,
          role: this.formRole,
          emailVerified: this.formVerified,
          ...(this.formPassword ? { password: this.formPassword } : {}),
        })
      : this.api.create({
          name: this.formName,
          email: this.formEmail,
          role: this.formRole,
          password: this.formPassword,
          emailVerified: this.formVerified,
        });

    req$.pipe(finalize(() => (this.formBusy = false))).subscribe({
      next: () => {
        this.formOpen = false;
        this.load(this.editing ? this.page : 1);
      },
      error: (err) => (this.formError = err.error?.message || 'Enregistrement impossible.'),
    });
  }

  // ---------- delete ----------

  askDelete(u: AdminUser): void {
    this.deleting = u;
    this.deleteError = '';
  }

  cancelDelete(): void {
    if (this.deleteBusy) return;
    this.deleting = null;
  }

  confirmDelete(): void {
    if (!this.deleting) return;
    this.deleteBusy = true;
    this.deleteError = '';
    this.api
      .remove(this.deleting.id)
      .pipe(finalize(() => (this.deleteBusy = false)))
      .subscribe({
        next: () => {
          this.deleting = null;
          // Keep pagination sane when the last row of a page disappears.
          const target = this.users.length === 1 && this.page > 1 ? this.page - 1 : this.page;
          this.load(target);
        },
        error: (err) => (this.deleteError = err.error?.message || 'Suppression impossible.'),
      });
  }

  roleLabel(role: string): string {
    return ROLE_OPTIONS.find((r) => r.value === role)?.label ?? role;
  }

  fmtDate(iso?: string): string {
    if (!iso) return '—';
    return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(iso));
  }

  initials(u: AdminUser): string {
    const src = (u.name || u.email).trim();
    return src
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('');
  }

  trackById(_i: number, u: AdminUser): string {
    return u.id;
  }
}
