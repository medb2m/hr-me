import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import {
  LucideArchive,
  LucideBuilding2,
  LucideChevronLeft,
  LucideChevronRight,
  LucideInbox,
  LucideMail,
  LucideRefreshCw,
  LucideSearch,
  LucideTrash2,
  LucideUndo2,
  LucideX,
} from '@lucide/angular';
import { AdminContact, ContactApiService } from '../../../../core/services/contact-api.service';

type StatusFilter = '' | 'new' | 'archived';

@Component({
  selector: 'app-admin-contacts',
  imports: [
    CommonModule,
    FormsModule,
    LucideArchive,
    LucideBuilding2,
    LucideChevronLeft,
    LucideChevronRight,
    LucideInbox,
    LucideMail,
    LucideRefreshCw,
    LucideSearch,
    LucideTrash2,
    LucideUndo2,
    LucideX,
  ],
  templateUrl: './admin-contacts.component.html',
  styleUrl: './admin-contacts.component.css',
})
export class AdminContactsComponent implements OnInit {
  private readonly api = inject(ContactApiService);

  contacts: AdminContact[] = [];
  total = 0;
  newCount = 0;
  page = 1;
  pages = 1;
  readonly limit = 10;

  statusFilter: StatusFilter = '';
  search = '';
  loading = false;
  errorMsg = '';
  expandedId = '';
  deletingId = '';
  confirmDeleteId = '';

  ngOnInit(): void {
    this.load();
  }

  load(page = 1): void {
    this.loading = true;
    this.errorMsg = '';
    this.api
      .listContacts({ page, limit: this.limit, status: this.statusFilter, q: this.search })
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (r) => {
          this.contacts = r.contacts;
          this.total = r.total;
          this.newCount = r.newCount;
          this.page = r.page;
          this.pages = r.pages;
        },
        error: () => {
          this.errorMsg = 'Impossible de charger les messages.';
        },
      });
  }

  applyFilters(): void {
    this.page = 1;
    this.load(1);
  }

  setStatus(f: StatusFilter): void {
    this.statusFilter = f;
    this.applyFilters();
  }

  clearSearch(): void {
    this.search = '';
    this.applyFilters();
  }

  prevPage(): void {
    if (this.page > 1) this.load(this.page - 1);
  }

  nextPage(): void {
    if (this.page < this.pages) this.load(this.page + 1);
  }

  toggleExpand(c: AdminContact): void {
    this.expandedId = this.expandedId === c.id ? '' : c.id;
  }

  archive(c: AdminContact, archived: boolean): void {
    this.api.setContactStatus(c.id, archived ? 'archived' : 'new').subscribe({
      next: ({ contact }) => {
        c.status = contact.status;
        if (this.statusFilter === 'new' || this.statusFilter === 'archived') {
          this.load(this.page);
        }
      },
      error: () => {
        this.errorMsg = 'Mise à jour impossible.';
      },
    });
  }

  askDelete(c: AdminContact): void {
    this.confirmDeleteId = c.id;
  }

  cancelDelete(): void {
    this.confirmDeleteId = '';
  }

  doDelete(c: AdminContact): void {
    this.deletingId = c.id;
    this.api
      .deleteContact(c.id)
      .pipe(finalize(() => (this.deletingId = '')))
      .subscribe({
        next: () => {
          this.confirmDeleteId = '';
          this.contacts = this.contacts.filter((x) => x.id !== c.id);
          this.total -= 1;
          if (this.contacts.length === 0 && this.page > 1) {
            this.load(this.page - 1);
          }
        },
        error: () => {
          this.errorMsg = 'Suppression impossible.';
        },
      });
  }

  fmtDate(d: string): string {
    const dt = new Date(d);
    return Number.isNaN(dt.getTime())
      ? d
      : dt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) +
          ' ' +
          dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }
}
