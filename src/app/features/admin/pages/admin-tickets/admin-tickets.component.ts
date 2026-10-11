import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  CdkDragDrop,
  DragDropModule,
  moveItemInArray,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import {
  LucideAlertTriangle,
  LucideArrowLeft,
  LucideArrowUp,
  LucideChartColumn,
  LucideCheckCircle2,
  LucideClock,
  LucideInbox,
  LucideLoaderCircle,
  LucideMessageSquare,
  LucideMinus,
  LucidePaperclip,
  LucidePlus,
  LucideRefreshCw,
  LucideSearch,
  LucideTicket,
  LucideUser,
  LucideUsers,
  LucideX,
} from '@lucide/angular';
import {
  TicketsApiService,
  TicketDto,
  TicketFilters,
  TicketStats,
  TicketStatus,
} from '../../../../core/services/tickets-api.service';

interface ColumnDef {
  key: TicketStatus;
  label: string;
}

@Component({
  selector: 'app-admin-tickets',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    DragDropModule,
    LucideAlertTriangle,
    LucideArrowLeft,
    LucideArrowUp,
    LucideChartColumn,
    LucideCheckCircle2,
    LucideClock,
    LucideInbox,
    LucideLoaderCircle,
    LucideMessageSquare,
    LucideMinus,
    LucidePaperclip,
    LucidePlus,
    LucideRefreshCw,
    LucideSearch,
    LucideTicket,
    LucideUser,
    LucideUsers,
    LucideX,
  ],
  templateUrl: './admin-tickets.component.html',
  styleUrl: './admin-tickets.component.css',
})
export class AdminTicketsComponent implements OnInit {
  private readonly api = inject(TicketsApiService);
  private readonly router = inject(Router);

  readonly columns: ColumnDef[] = [
    { key: 'open', label: 'Ouvert' },
    { key: 'in_progress', label: 'En cours' },
    { key: 'waiting', label: 'En attente' },
    { key: 'resolved', label: 'Résolu' },
    { key: 'closed', label: 'Clôturé' },
  ];

  readonly board = signal<Record<TicketStatus, TicketDto[]>>({
    open: [],
    in_progress: [],
    waiting: [],
    resolved: [],
    closed: [],
  });
  readonly stats = signal<TicketStats | null>(null);
  readonly assignees = signal<{ id: string; name: string; email: string; role: string }[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');

  // Filtres
  filterKind: '' | 'support' | 'internal' = '';
  filterPriority = '';
  filterAssignee = '';
  filterQ = '';

  // Modal création
  readonly showCreate = signal(false);
  readonly creating = signal(false);
  readonly createError = signal('');
  newSubject = '';
  newDescription = '';
  newCategory = 'task';
  newPriority: 'low' | 'medium' | 'high' | 'urgent' = 'medium';
  newAssignee = '';
  newKind: 'internal' | 'support' = 'internal';
  newFiles: File[] = [];

  readonly totalOnBoard = computed(() =>
    this.columns.reduce((n, c) => n + this.board()[c.key].length, 0),
  );

  ngOnInit(): void {
    this.refresh();
    this.api.assignees().subscribe({
      next: (r) => this.assignees.set(r.assignees || []),
      error: () => {},
    });
    this.api.stats().subscribe({
      next: (s) => this.stats.set(s),
      error: () => {},
    });
  }

  refresh(): void {
    this.loading.set(true);
    const f: TicketFilters = {
      kind: this.filterKind,
      priority: this.filterPriority as TicketFilters['priority'],
      assignee: this.filterAssignee,
      q: this.filterQ.trim(),
    };
    this.api.board(f).subscribe({
      next: (r) => {
        const next: Record<TicketStatus, TicketDto[]> = {
          open: [],
          in_progress: [],
          waiting: [],
          resolved: [],
          closed: [],
        };
        for (const col of this.columns) {
          next[col.key] = r.columns?.[col.key] || [];
        }
        this.board.set(next);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Impossible de charger le tableau des tickets.');
        this.loading.set(false);
      },
    });
  }

  clearFilters(): void {
    this.filterKind = '';
    this.filterPriority = '';
    this.filterAssignee = '';
    this.filterQ = '';
    this.refresh();
  }

  drop(event: CdkDragDrop<TicketDto[]>, target: TicketStatus): void {
    const ticket = event.item.data as TicketDto;
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
      return;
    }
    const prev = ticket.status;
    transferArrayItem(
      event.previousContainer.data,
      event.container.data,
      event.previousIndex,
      event.currentIndex,
    );
    ticket.status = target;
    this.api.patch(ticket.id, { status: target }).subscribe({
      next: () => this.reloadStats(),
      error: () => {
        ticket.status = prev;
        this.refresh();
      },
    });
  }

  open(t: TicketDto): void {
    void this.router.navigate(['/admin/tickets', t.id]);
  }

  openCreate(): void {
    this.showCreate.set(true);
    this.createError.set('');
  }

  closeCreate(): void {
    this.showCreate.set(false);
  }

  onFiles(evt: Event): void {
    const input = evt.target as HTMLInputElement;
    this.newFiles = Array.from(input.files || []).slice(0, 5);
  }

  submitCreate(): void {
    if (this.newSubject.trim().length < 3) {
      this.createError.set('Indiquez un sujet (au moins 3 caractères).');
      return;
    }
    this.creating.set(true);
    this.api
      .create({
        subject: this.newSubject.trim(),
        description: this.newDescription.trim(),
        category: this.newCategory,
        priority: this.newPriority,
        kind: this.newKind,
        assignedTo: this.newAssignee || undefined,
        files: this.newFiles,
      })
      .subscribe({
        next: () => {
          this.creating.set(false);
          this.showCreate.set(false);
          this.newSubject = '';
          this.newDescription = '';
          this.newAssignee = '';
          this.newFiles = [];
          this.refresh();
          this.reloadStats();
        },
        error: (err) => {
          this.creating.set(false);
          this.createError.set(err?.error?.message || 'Création impossible.');
        },
      });
  }

  reloadStats(): void {
    this.api.stats().subscribe({ next: (s) => this.stats.set(s), error: () => {} });
  }

  priorityLabel(p: string): string {
    return { low: 'Basse', medium: 'Moyenne', high: 'Haute', urgent: 'Urgente' }[p] || p;
  }

  kindLabel(k: string): string {
    return k === 'support' ? 'Support' : 'Interne';
  }

  ago(iso: string): string {
    if (!iso) return '';
    const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return 'à l’instant';
    if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
    if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
    return `il y a ${Math.floor(s / 86400)} j`;
  }
}
