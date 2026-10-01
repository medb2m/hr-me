import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-client-overview',
  imports: [CommonModule, RouterLink],
  templateUrl: './client-overview.component.html',
  styleUrl: './client-overview.component.css',
})
export class ClientOverviewComponent {
  readonly tiles = [
    {
      title: 'Identité & données',
      desc: 'Informations personnelles, parcours, formations et compétences centralisés.',
      link: '/client/profile',
      tag: 'Profil',
    },
    {
      title: 'Éditeur de CV',
      desc: 'Construisez un CV structuré à partir de votre profil (étapes ou blocs).',
      link: '/client/editor/cv',
      tag: 'CV',
    },
    {
      title: 'Lettre de motivation',
      desc: 'Modèles et éditeur pour adapter chaque candidature.',
      link: '/client/editor/cl',
      tag: 'Lettre',
    },
    {
      title: 'Bibliothèque de documents',
      desc: 'Diplômes, attestations et PDF vérifiés dans votre portefeuille numérique.',
      link: '/client/library',
      tag: 'Documents',
    },
    {
      title: 'Auto-évaluation des compétences',
      desc: 'Langues (CEFR), compétences numériques et transversales.',
      link: '/client/skills',
      tag: 'Compétences',
    },
    {
      title: 'Explorer offres & formations',
      desc: 'Vue agrégée pour faire correspondre votre profil aux opportunités.',
      link: '/client/explore',
      tag: 'Explorer',
    },
  ] as const;
}
