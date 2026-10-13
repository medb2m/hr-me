import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  LucideArrowRight,
  LucideBot,
  LucideClock,
  LucideCompass,
  LucideFileText,
  LucideFolderOpen,
  LucideIdCard,
  LucideListChecks,
  LucidePenLine,
} from '@lucide/angular';
import { InterviewSessionListItem } from '../../../../models/interview-session';
import { InterviewService } from '../../../../services/interview.service';

interface Task {
  kind: 'interview' | 'exam' | 'quiz' | 'document' | 'signature';
  title: string;
  desc: string;
  deadline?: string | null;
  link: string;
}

/** Espace candidat — aperçu + section « À faire » (entretiens IA, futurs examens/quiz/documents). */
@Component({
  selector: 'app-client-overview',
  imports: [
    CommonModule,
    RouterLink,
    LucideArrowRight,
    LucideBot,
    LucideClock,
    LucideCompass,
    LucideFileText,
    LucideFolderOpen,
    LucideIdCard,
    LucideListChecks,
    LucidePenLine,
  ],
  providers: [DatePipe],
  templateUrl: './client-overview.component.html',
  styleUrl: './client-overview.component.css',
})
export class ClientOverviewComponent implements OnInit {
  private readonly interviewService = inject(InterviewService);
  private readonly datePipe = inject(DatePipe);

  readonly tasks = signal<Task[]>([]);
  readonly tasksLoading = signal(true);

  readonly tiles = [
    {
      icon: 'id',
      title: 'Identité & données',
      desc: 'Informations personnelles, parcours, formations et compétences centralisés.',
      link: '/candidat/profile',
      tag: 'Profil',
    },
    {
      icon: 'cv',
      title: 'Éditeur de CV',
      desc: 'Construisez un CV structuré à partir de votre profil (étapes ou blocs).',
      link: '/candidat/editor/cv',
      tag: 'CV',
    },
    {
      icon: 'letter',
      title: 'Lettre de motivation',
      desc: 'Modèles et éditeur pour adapter chaque candidature.',
      link: '/candidat/editor/cl',
      tag: 'Lettre',
    },
    {
      icon: 'docs',
      title: 'Bibliothèque de documents',
      desc: 'Diplômes, attestations et PDF vérifiés dans votre portefeuille numérique.',
      link: '/candidat/library',
      tag: 'Documents',
    },
    {
      icon: 'skills',
      title: 'Auto-évaluation des compétences',
      desc: 'Langues (CEFR), compétences numériques et transversales.',
      link: '/candidat/skills',
      tag: 'Compétences',
    },
    {
      icon: 'explore',
      title: 'Explorer offres & formations',
      desc: 'Vue agrégée pour faire correspondre votre profil aux opportunités.',
      link: '/candidat/explore',
      tag: 'Explorer',
    },
  ] as const;

  ngOnInit(): void {
    // « À faire » — entretiens IA assignés (extensible : examens, quiz, documents…)
    this.interviewService.mySessions().subscribe({
      next: (res) => {
        this.tasks.set(
          (res.data || []).map((s: InterviewSessionListItem) => ({
            kind: 'interview' as const,
            title: s.title,
            desc: s.topics?.length ? `Thèmes : ${s.topics.join(' · ')}` : 'Entretien automatisé à réaliser en ligne.',
            deadline: s.expiresAt,
            link: `/interview/pass/${s.inviteToken}`,
          }))
        );
        this.tasksLoading.set(false);
      },
      error: () => this.tasksLoading.set(false),
    });
  }

  deadlineLabel(t: Task): string {
    if (!t.deadline) return '';
    const ms = new Date(t.deadline).getTime() - Date.now();
    if (ms <= 0) return 'Délai dépassé';
    const h = Math.floor(ms / 3600000);
    if (h >= 48) {
      return `avant le ${this.datePipe.transform(t.deadline, 'd MMM, HH:mm')}`;
    }
    return h > 0 ? `reste ${h} h` : `reste ${Math.max(1, Math.floor(ms / 60000))} min`;
  }
}
