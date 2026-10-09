import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  LucideBanknote,
  LucideBriefcase,
  LucideBuilding2,
  LucideClock,
  LucideImage,
  LucideLock,
  LucideMapPin,
} from '@lucide/angular';
import { ToastService } from '../../../../core/services/toast.service';

interface Offer {
  title: string;
  company: string;
  city: string;
  country: string;
  flag: string;
  contract: string;
  salary: string;
  tags: string[];
  sector: string;
  hot?: boolean;
}

/** Offres publiques statiques — la postulation complète est réservée aux candidats qualifiés. */
@Component({
  selector: 'app-espace-offers',
  imports: [
    CommonModule,
    LucideBanknote,
    LucideBriefcase,
    LucideBuilding2,
    LucideClock,
    LucideImage,
    LucideLock,
    LucideMapPin,
  ],
  templateUrl: './espace-offers.component.html',
  styleUrl: './espace-offers.component.css',
})
export class EspaceOffersComponent {
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  activeFilter = 'Tous';
  readonly filters = ['Tous', 'France', 'Italie', 'Pologne', 'Portugal', 'Qatar', 'Albanie'];

  readonly offers: Offer[] = [
    {
      title: 'Infirmier(ère) diplômé(e)',
      company: 'Groupe Santé Horizon',
      city: 'Lyon',
      country: 'France',
      flag: '🇫🇷',
      contract: 'CDI',
      salary: '2 600 – 3 100 €',
      tags: ['Santé', 'Logement aidé', 'Français B2'],
      sector: 'Santé',
      hot: true,
    },
    {
      title: 'Soudeur TIG/MIG',
      company: 'MetalWorks Italia',
      city: 'Turin',
      country: 'Italie',
      flag: '🇮🇹',
      contract: 'CDD 12 mois',
      salary: '1 900 – 2 400 €',
      tags: ['Industrie', 'Expérience 3 ans'],
      sector: 'Industrie',
    },
    {
      title: 'Développeur Full-Stack',
      company: 'TechBridge Sp. z o.o.',
      city: 'Varsovie',
      country: 'Pologne',
      flag: '🇵🇱',
      contract: 'CDI',
      salary: '9 000 – 12 000 zł',
      tags: ['Angular', 'Node.js', 'Anglais B2'],
      sector: 'IT',
      hot: true,
    },
    {
      title: 'Chef de chantier BTP',
      company: 'Construções Atlântico',
      city: 'Porto',
      country: 'Portugal',
      flag: '🇵🇹',
      contract: 'CDI',
      salary: '2 200 – 2 800 €',
      tags: ['BTP', 'Management', 'Permis B'],
      sector: 'BTP',
    },
    {
      title: 'Technicien maintenance',
      company: 'Doha Facility Group',
      city: 'Doha',
      country: 'Qatar',
      flag: '🇶🇦',
      contract: 'CDD 24 mois',
      salary: '7 000 – 9 000 QAR',
      tags: ['Logement inclus', 'Transport inclus'],
      sector: 'Maintenance',
      hot: true,
    },
    {
      title: 'Serveur / Barman',
      company: 'Riviera Hotels',
      city: 'Tirana',
      country: 'Albanie',
      flag: '🇦🇱',
      contract: 'Saisonnier',
      salary: '900 – 1 200 €',
      tags: ['Hôtellerie', 'Saison été'],
      sector: 'Hôtellerie',
    },
    {
      title: 'Comptable bilingue',
      company: 'Fidex Conseil',
      city: 'Marseille',
      country: 'France',
      flag: '🇫🇷',
      contract: 'CDI',
      salary: '2 400 – 2 900 €',
      tags: ['Finance', 'Français/Anglais'],
      sector: 'Finance',
    },
    {
      title: 'Opérateur CNC',
      company: 'PrecisionParts Milano',
      city: 'Milan',
      country: 'Italie',
      flag: '🇮🇹',
      contract: 'CDI',
      salary: '2 000 – 2 500 €',
      tags: ['Industrie', 'Formation interne'],
      sector: 'Industrie',
    },
  ];

  filtered(): Offer[] {
    if (this.activeFilter === 'Tous') return this.offers;
    return this.offers.filter((o) => o.country === this.activeFilter);
  }

  /** Postuler nécessite le statut candidat — aiguillage vers la qualification. */
  apply(_offer: Offer): void {
    this.toast.info('Statut candidat requis', 'Postuler aux offres demande une qualification par l\'agence.', {
      action: {
        label: 'Demander la qualification',
        onClick: () => void this.router.navigate(['/espace/profil'], { fragment: 'qualification' }),
      },
    });
  }
}
