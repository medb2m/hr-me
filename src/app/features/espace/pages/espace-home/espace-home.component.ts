import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  LucideArrowRight,
  LucideAward,
  LucideFileCheck,
  LucideGlobe2,
  LucideHandshake,
  LucideImage,
  LucideMapPin,
  LucideRocket,
  LucideSearch,
  LucideTarget,
  LucideUsers,
} from '@lucide/angular';

interface Stat {
  value: string;
  label: string;
}

interface Step {
  title: string;
  desc: string;
}

/** Landing de l'espace client — présentation Al Wassit + incitation à devenir candidat. */
@Component({
  selector: 'app-espace-home',
  imports: [
    CommonModule,
    RouterLink,
    LucideArrowRight,
    LucideAward,
    LucideFileCheck,
    LucideGlobe2,
    LucideHandshake,
    LucideImage,
    LucideMapPin,
    LucideRocket,
    LucideSearch,
    LucideTarget,
    LucideUsers,
  ],
  templateUrl: './espace-home.component.html',
  styleUrl: './espace-home.component.css',
})
export class EspaceHomeComponent {
  readonly stats: Stat[] = [
    { value: '5 000+', label: 'Candidats placés' },
    { value: '150+', label: 'Partenaires internationaux' },
    { value: '40+', label: 'Pays desservis' },
    { value: '95 %', label: 'Taux de réussite' },
  ];

  readonly steps: Step[] = [
    {
      title: 'Découverte des talents',
      desc: 'Nous sourçons les meilleurs candidats au sein de notre réseau mondial.',
    },
    {
      title: 'Sélection & validation',
      desc: 'Des évaluations rigoureuses garantissent l\'adéquation parfaite des compétences.',
    },
    {
      title: 'Processus d\'entretien',
      desc: 'Nous coordonnons des entretiens fluides entre employeurs et candidats.',
    },
    {
      title: 'Placement réussi',
      desc: 'Nous gérons toute la documentation et assurons un suivi continu.',
    },
  ];

  readonly destinations = ['France', 'Italie', 'Pologne', 'Portugal', 'Albanie', 'Qatar'];
}
