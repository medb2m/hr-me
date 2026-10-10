import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';

interface LegalSection {
  heading: string;
  paragraphs: string[];
  list?: string[];
}

interface LegalDoc {
  title: string;
  subtitle: string;
  sections: LegalSection[];
}

const LEGAL_DOCS: Record<string, LegalDoc> = {
  'mentions-legales': {
    title: 'Mentions légales',
    subtitle: 'Informations légales relatives à l’éditeur du site Al Wassit.',
    sections: [
      {
        heading: '1. Éditeur du Site',
        paragraphs: [
          'Le site web Al Wassit est édité par l’Établissement Privé de Placement à l’Étranger (EPPE) [NOM DE L’EPPE], société [Forme juridique : SARL/SUARL/SA] au capital de [Montant] DT, agréée par le Ministère de la Formation Professionnelle et de l’Emploi sous le numéro d’agrément : [N° AGRÉMENT].',
        ],
        list: [
          'Siège social : [Adresse complète, Ville, Tunisie]',
          'Matricule Fiscal : [N° Matricule Fiscal]',
          'Registre National des Entreprises (RNE) : [N° RNE]',
          'Téléphone : [N° Téléphone]',
          'E-mail : [Adresse E-mail professionnelle]',
        ],
      },
      {
        heading: '2. Directeur de la publication',
        paragraphs: [
          'Le directeur de la publication du site est [Nom du Responsable/Directeur de l’EPPE], en sa qualité de [Poste/Fonction].',
        ],
      },
      {
        heading: '3. Hébergement du Site',
        paragraphs: [
          'Le site est hébergé à des fins de développement par : Mohamed Ben Mohamed, [Adresse de l’hébergeur].',
          'En production, ces mentions seront remplacées par les coordonnées de l’hébergeur tunisien définitif (Oxahost, Topnet, Ooredoo, etc.).',
        ],
      },
    ],
  },
  'politique-confidentialite': {
    title: 'Politique de confidentialité',
    subtitle:
      'Protection des données personnelles conformément à la législation tunisienne (INPDP).',
    sections: [
      {
        heading: '1. Engagement de conformité',
        paragraphs: [
          'L’EPPE [NOM DE L’EPPE] s’engage à protéger la vie privée et les données personnelles des utilisateurs du site Al Wassit, conformément à la Loi organique n° 2004-63 du 27 juillet 2004 portant sur la protection des données à caractère personnel en Tunisie.',
        ],
      },
      {
        heading: '2. Collecte et Finalité des données',
        paragraphs: [
          'Les données collectées sur la plateforme (Nom, prénom, e-mail, téléphone, CV, diplômes, historique professionnel, copie du passeport) ont pour uniques finalités :',
        ],
        list: [
          'L’évaluation des candidatures dans le cadre d’un placement à l’étranger.',
          'La mise en relation avec des employeurs partenaires internationaux.',
          'L’accomplissement des procédures administratives de recrutement à l’international.',
        ],
      },
      {
        heading: '3. Destinataires des données',
        paragraphs: [
          'Les données à caractère personnel des candidats sont strictement destinées aux services internes de [NOM DE L’EPPE] et aux employeurs à l’étranger dûment identifiés, dans le strict respect de l’objet du contrat de placement. Aucune donnée n’est vendue ou cédée à des tiers à des fins commerciales.',
        ],
      },
      {
        heading: '4. Droits des utilisateurs (Droit d’accès et de rectification)',
        paragraphs: [
          'Conformément à la législation tunisienne, tout candidat dispose d’un droit d’accès, de modification, de rectification et de suppression des données qui le concernent.',
          'Pour exercer ce droit, l’utilisateur peut envoyer une demande écrite accompagnée d’une copie de sa pièce d’identité à :',
        ],
        list: [
          'Par e-mail : [E-mail de support/RGPD]',
          'Par courrier : [Adresse du siège social]',
        ],
      },
      {
        heading: '5. Sécurité',
        paragraphs: [
          'Nous mettons en œuvre des mesures de sécurité techniques (chiffrement des connexions via protocole HTTPS, sécurisation des bases de données) pour empêcher l’accès non autorisé, la modification ou la destruction de vos données stockées.',
        ],
      },
    ],
  },
  cgu: {
    title: 'Conditions Générales d’Utilisation',
    subtitle: 'Modalités de mise à disposition et d’utilisation des services Al Wassit.',
    sections: [
      {
        heading: '1. Objet',
        paragraphs: [
          'Les présentes CGU ont pour objet de définir les modalités de mise à disposition et d’utilisation des services du site Al Wassit par les candidats et les partenaires.',
        ],
      },
      {
        heading: '2. Obligations du Candidat',
        paragraphs: [
          'En s’inscrivant sur la plateforme, le candidat s’engage à :',
        ],
        list: [
          'Fournir des informations exactes, sincères et actualisées (notamment concernant ses diplômes et son expérience professionnelle).',
          'Ne pas usurper l’identité d’un tiers.',
          'Ne pas téléverser de fichiers corrompus ou contenant des virus.',
        ],
      },
      {
        heading: 'Suspension de compte',
        paragraphs: [
          'L’EPPE se réserve le droit de suspendre immédiatement tout compte ayant fourni des informations frauduleuses ou falsifiées.',
        ],
      },
      {
        heading: '3. Responsabilité de l’Éditeur',
        paragraphs: [
          '[NOM DE L’EPPE] met tout en œuvre pour assurer l’accès au site 24h/24. Toutefois, sa responsabilité ne saurait être engagée en cas d’interruption technique, de maintenance ou de force majeure. L’EPPE agit en tant qu’intermédiaire de placement et ne garantit pas l’obtention systématique d’un contrat de travail à l’étranger pour le candidat.',
        ],
      },
      {
        heading: '4. Propriété intellectuelle',
        paragraphs: [
          'L’ensemble du contenu du site Al Wassit (textes, logos, graphismes, code source) est la propriété exclusive de [NOM DE L’EPPE]. Toute reproduction non autorisée est passible de poursuites.',
        ],
      },
      {
        heading: '5. Droit applicable',
        paragraphs: [
          'Les présentes CGU sont régies par le droit tunisien. Tout litige relatif à leur interprétation ou leur exécution relève de la compétence exclusive des tribunaux de Tunis.',
        ],
      },
    ],
  },
};

@Component({
  selector: 'app-legal-page',
  imports: [CommonModule],
  templateUrl: './legal-page.component.html',
  styleUrl: './legal-page.component.css',
})
export class LegalPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  doc: LegalDoc = LEGAL_DOCS['mentions-legales'];

  ngOnInit(): void {
    const key = this.route.snapshot.data['legal'] as string;
    if (key && LEGAL_DOCS[key]) {
      this.doc = LEGAL_DOCS[key];
    }
  }
}
