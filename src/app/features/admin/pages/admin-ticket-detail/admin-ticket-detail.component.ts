import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  LucideArrowLeft,
  LucideHistory,
  LucideLoaderCircle,
  LucideMail,
  LucidePaperclip,
  LucideSend,
} from '@lucide/angular';
import {
  TicketsApiService,
  TicketDto,
} from '../../../../core/services/tickets-api.service';

@Component({
  selector: 'app-admin-ticket-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    LucideArrowLeft,
    LucideHistory,
    LucideLoaderCircle,
    LucideMail,
    LucidePaperclip,
    LucideSend,
  ],
  templateUrl: './admin-ticket-detail.component.html',
  styleUrl: './admin-ticket-detail.component.css',
})
export class AdminTicketDetailComponent implements OnInit {
  private readonly api = inject(TicketsApiService);
  private readonly route = inject(ActivatedRoute);

  readonly ticket = signal<TicketDto | null>(null);
  readonly assignees = signal<{ id: string; name: string; role: string }[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly saving = signal(false);
  readonly commentSending = signal(false);
  commentBody = '';

  readonly statusOptions = [
    { value: 'open', label: 'Ouvert' },
    { value: 'in_progress', label: 'En cours' },
    { value: 'waiting', label: 'En attente' },
    { value: 'resolved', label: 'Résolu' },
    { value: 'closed', label: 'Clôturé' },
  ];
  readonly priorityOptions = [
    { value: 'low', label: 'Basse' },
    { value: 'medium', label: 'Moyenne' },
    { value: 'high', label: 'Haute' },
    { value: 'urgent', label: 'Urgente' },
  ];
  readonly categoryOptions = [
    'task', 'bug', 'feature', 'candidate-followup', 'offer-revision',
    'interview', 'documents', 'account', 'application', 'offer', 'general',
  ];

  private id = '';

  ngOnInit(): void {
    this.id = this.route.snapshot.paramMap.get('id') || '';
    this.load();
    this.api.assignees().subscribe({
      next: (r) => this.assignees.set(r.assignees || []),
      error: () => {},
    });
  }

  load(): void {
    this.loading.set(true);
    this.api.get(this.id).subscribe({
      next: (r) => {
        this.ticket.set(r.ticket);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Ticket introuvable ou accès refusé.');
        this.loading.set(false);
      },
    });
  }

  patch(body: Parameters<TicketsApiService['patch']>[1]): void {
    this.saving.set(true);
    this.api.patch(this.id, body).subscribe({
      next: (r) => {
        this.ticket.set(r.ticket);
        this.saving.set(false);
      },
      error: () => this.saving.set(false),
    });
  }

  onStatus(v: string): void { this.patch({ status: v as TicketDto['status'] }); }
  onPriority(v: string): void { this.patch({ priority: v as TicketDto['priority'] }); }
  onCategory(v: string): void { this.patch({ category: v }); }
  onAssignee(v: string): void { this.patch({ assignedTo: v || null }); }

  sendComment(): void {
    const body = this.commentBody.trim();
    if (body.length < 2) return;
    this.commentSending.set(true);
    this.api.comment(this.id, body).subscribe({
      next: (r) => {
        this.ticket.set(r.ticket);
        this.commentBody = '';
        this.commentSending.set(false);
      },
      error: () => this.commentSending.set(false),
    });
  }

  fileUrl(path: string): string {
    return path || '';
  }

  statusLabel(s: string): string {
    return (
      { open: 'Ouvert', in_progress: 'En cours', waiting: 'En attente', resolved: 'Résolu', closed: 'Clôturé' }[s] || s
    );
  }

  fmt(iso: string): string {
    return iso
      ? new Date(iso).toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '';
  }
}
