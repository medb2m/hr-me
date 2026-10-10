import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  LucideArrowRight,
  LucideCompass,
  LucideFileText,
  LucideFolderOpen,
  LucideIdCard,
  LucideListChecks,
  LucidePenLine,
} from '@lucide/angular';

@Component({
  selector: 'app-client-overview',
  imports: [
    CommonModule,
    RouterLink,
    LucideArrowRight,
    LucideCompass,
    LucideFileText,
    LucideFolderOpen,
    LucideIdCard,
    LucideListChecks,
    LucidePenLine,
  ],
  templateUrl: './client-overview.component.html',
  styleUrl: './client-overview.component.css',
})
export class ClientOverviewComponent {
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
}
