import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import {
  LucideBot,
  LucideBookOpen,
  LucideCheckCircle2,
  LucideChevronDown,
  LucideClock,
  LucideLightbulb,
  LucideLifeBuoy,
  LucideLoaderCircle,
  LucideMail,
  LucideMessageSquare,
  LucidePaperclip,
  LucidePhone,
  LucideSend,
  LucideTicket,
  LucideTimer,
} from '@lucide/angular';
import {
  TicketsApiService,
  TicketDto,
} from '../../../core/services/tickets-api.service';

interface SupportIdea {
  icon: string;
  title: string;
  body: string;
  tag: string;
}

/** Page « Support » — demandes + suivi + section chatbot (à venir). Partagée candidat/client. */
@Component({
  selector: 'app-support-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    LucideBot,
    LucideBookOpen,
    LucideCheckCircle2,
    LucideChevronDown,
    LucideClock,
    LucideLightbulb,
    LucideLifeBuoy,
    LucideLoaderCircle,
    LucideMail,
    LucideMessageSquare,
    LucidePaperclip,
    LucidePhone,
    LucideSend,
    LucideTicket,
    LucideTimer,
  ],
  templateUrl: './support-page.component.html',
  styleUrl: './support-page.component.css',
})
export class SupportPageComponent implements OnInit {
  private readonly api = inject(TicketsApiService);

  readonly tickets = signal<TicketDto[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal('');
  readonly selected = signal<TicketDto | null>(null);

  // Nouveau ticket
  readonly showForm = signal(false);
  readonly sending = signal(false);
  readonly sendError = signal('');
  readonly sentOk = signal(false);
  subject = '';
  category = 'account';
  description = '';
  files: File[] = [];

  // Réponse sur un ticket
  replyBody = '';
  readonly replySending = signal(false);

  readonly supportCategories = [
    { value: 'account', label: 'Compte & accès' },
    { value: 'application', label: 'Candidature' },
    { value: 'offer', label: 'Offre d’emploi' },
    { value: 'documents', label: 'Documents & CV' },
    { value: 'technical', label: 'Problème technique' },
    { value: 'general', label: 'Autre demande' },
  ];

  /** Idées/statiques pour plus tard — validées ou non par l'équipe. */
  readonly ideas: SupportIdea[] = [
    {
      icon: 'book',
      title: 'Base de connaissances & FAQ',
      body: 'Articles d’aide : créer un CV, suivre une candidature, préparer un entretien à l’étranger…',
      tag: 'À venir',
    },
    {
      icon: 'timer',
      title: 'Engagements de réponse (SLA)',
      body: 'Temps de réponse garanti selon la priorité : urgent < 4 h, normal < 24 h ouvrées.',
      tag: 'À venir',
    },
    {
      icon: 'mail',
      title: 'Notifications e-mail',
      body: 'Recevoir les réponses de l’équipe directement par e-mail, avec réponse possible depuis la boîte de réception.',
      tag: 'À venir',
    },
    {
      icon: 'phone',
      title: 'Contact direct',
      body: 'Prise de rendez-vous téléphonique avec un conseiller pour les dossiers complexes.',
      tag: 'À étudier',
    },
  ];

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.list().subscribe({
      next: (r) => {
        this.tickets.set(r.tickets || []);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set('Impossible de charger vos demandes.');
        this.loading.set(false);
      },
    });
  }

  openTicket(t: TicketDto): void {
    if (this.selected()?.id === t.id) {
      this.selected.set(null);
      return;
    }
    this.api.get(t.id).subscribe({
      next: (r) => this.selected.set(r.ticket),
      error: () => this.selected.set(t),
    });
  }

  onFiles(evt: Event): void {
    const input = evt.target as HTMLInputElement;
    this.files = Array.from(input.files || []).slice(0, 5);
  }

  submit(): void {
    if (this.subject.trim().length < 3) {
      this.sendError.set('Indiquez un sujet (au moins 3 caractères).');
      return;
    }
    if (this.description.trim().length < 10) {
      this.sendError.set('Décrivez votre demande (au moins 10 caractères).');
      return;
    }
    this.sending.set(true);
    this.sendError.set('');
    this.api
      .create({
        subject: this.subject.trim(),
        description: this.description.trim(),
        category: this.category,
        priority: 'medium',
        kind: 'support',
        files: this.files,
      })
      .subscribe({
        next: () => {
          this.sending.set(false);
          this.showForm.set(false);
          this.sentOk.set(true);
          this.subject = '';
          this.description = '';
          this.files = [];
          this.load();
          setTimeout(() => this.sentOk.set(false), 5000);
        },
        error: (err) => {
          this.sending.set(false);
          this.sendError.set(err?.error?.message || 'Envoi impossible, réessayez.');
        },
      });
  }

  sendReply(): void {
    const t = this.selected();
    const body = this.replyBody.trim();
    if (!t || body.length < 2) return;
    this.replySending.set(true);
    this.api.comment(t.id, body).subscribe({
      next: (r) => {
        this.selected.set(r.ticket);
        this.replyBody = '';
        this.replySending.set(false);
      },
      error: () => this.replySending.set(false),
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

  categoryLabel(c: string): string {
    return this.supportCategories.find((x) => x.value === c)?.label || c;
  }

  fmt(iso: string): string {
    return iso
      ? new Date(iso).toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '';
  }
}
