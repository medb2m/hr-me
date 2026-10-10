/**
 * Seed des offres de démo — `node scripts/seed-offers.js`.
 * Upsert par (name + partner) : rejouable sans créer de doublons.
 * Supprime aussi l'index unique legacy {candidate,offer,position} qui
 * bloquerait plusieurs candidatures client (candidate = null).
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Offer } from '../models/offer.js';
import { User } from '../models/user.model.js';

dotenv.config();

const inDays = (n) => new Date(Date.now() + n * 86400000);

const desc = (accroche, missions, profil, avantages) => `
<p>${accroche}</p>
<h3>Missions</h3>
<ul>${missions.map((m) => `<li>${m}</li>`).join('')}</ul>
<h3>Profil recherché</h3>
<ul>${profil.map((m) => `<li>${m}</li>`).join('')}</ul>
<h3>Nous offrons</h3>
<ul>${avantages.map((m) => `<li>${m}</li>`).join('')}</ul>`.trim();

const OFFERS = [
  {
    name: 'Infirmier(ère) diplômé(e)',
    partner: 'Groupe Santé Horizon',
    country: { code: 'FR', name: 'France' },
    city: 'Lyon',
    workMode: 'onsite',
    contract: 'CDI',
    salary: '2 600 – 3 100 €',
    sector: 'Santé',
    urgent: true,
    openings: 4,
    skills: ['Soins infirmiers', 'Français B2', 'DE infirmier', 'Travail en équipe'],
    publishDate: inDays(-5),
    deadline: inDays(55),
    status: 'published',
    description: desc(
      'Le Groupe Santé Horizon, réseau de cliniques privées en région lyonnaise, recrute des infirmiers diplômés pour renforcer ses équipes de soins. Une opportunité stable en CDI avec un accompagnement complet à l\u2019installation en France.',
      [
        'Dispenser les soins infirmiers auprès des patients hospitalisés',
        'Administrer les traitements prescrits et assurer le suivi des constantes',
        'Rédiger et tenir à jour les dossiers de soins',
        'Collaborer avec l\u2019équipe médicale pluridisciplinaire',
        'Accueillir et informer les familles des patients',
      ],
      [
        'Diplôme d\u2019État infirmier (ou équivalent reconnu)',
        'Niveau de français B2 minimum requis',
        'Expérience en milieu hospitalier appréciée',
        'Sens de l\u2019écoute et du travail en équipe',
      ],
      [
        'Salaire 2 600 – 3 100 € brut mensuel selon expérience',
        'Aide au logement à l\u2019arrivée',
        'Accompagnement pour la reconnaissance du diplôme',
        'Formation continue et mutuelle d\u2019entreprise',
      ],
    ),
  },
  {
    name: 'Soudeur TIG/MIG',
    partner: 'MetalWorks Italia',
    country: { code: 'IT', name: 'Italie' },
    city: 'Turin',
    workMode: 'onsite',
    contract: 'CDD 12 mois',
    salary: '1 900 – 2 400 €',
    sector: 'Industrie',
    urgent: false,
    openings: 6,
    skills: ['Soudure TIG', 'Soudure MIG', 'Lecture de plan', 'Contrôle qualité'],
    publishDate: inDays(-9),
    deadline: inDays(45),
    status: 'published',
    description: desc(
      'MetalWorks Italia, sous-traitant industriel pour l\u2019automobile et le ferroviaire, renforce son atelier de Turin. Poste en CDD de 12 mois renouvelable sur une production à haute valeur ajoutée.',
      [
        'Réaliser des soudures TIG et MIG sur pièces acier et inox',
        'Lire et interpréter les plans et cahiers de soudage (DMOS)',
        'Contrôler la qualité des assemblages réalisés',
        'Entretenir le poste de soudage et respecter les consignes sécurité',
      ],
      [
        '3 ans d\u2019expérience minimum en soudure TIG/MIG',
        'Lecture de plans techniques indispensable',
        'Qualification EN 9606 appréciée',
        'Rigueur et respect des procédures qualité',
      ],
      [
        'Salaire 1 900 – 2 400 € selon profil',
        'CDD 12 mois renouvelable, possibilité de CDI',
        'Prime de production et tickets restaurant',
        'Hébergement possible les premiers mois',
      ],
    ),
  },
  {
    name: 'Développeur Full-Stack',
    partner: 'TechBridge Sp. z o.o.',
    country: { code: 'PL', name: 'Pologne' },
    city: 'Varsovie',
    workMode: 'hybrid',
    contract: 'CDI',
    salary: '9 000 – 12 000 zł',
    sector: 'IT',
    urgent: true,
    openings: 2,
    skills: ['Angular', 'Node.js', 'TypeScript', 'MongoDB', 'Anglais B2'],
    publishDate: inDays(-3),
    deadline: inDays(60),
    status: 'published',
    description: desc(
      'TechBridge, éditeur de logiciels B2B en forte croissance à Varsovie, recrute un développeur full-stack pour son équipe produit internationale. Poste hybride au sein d\u2019une équipe anglophone.',
      [
        'Développer des fonctionnalités Angular (front) et Node.js (API)',
        'Concevoir et optimiser les modèles de données MongoDB',
        'Participer aux revues de code et à l\u2019amélioration continue',
        'Collaborer en méthodologie agile avec les équipes produit',
      ],
      [
        'Maîtrise d\u2019Angular et de Node.js/TypeScript',
        'Anglais professionnel B2 minimum',
        'Expérience sur des applications en production',
        'Autonomie et esprit d\u2019équipe international',
      ],
      [
        'Salaire 9 000 – 12 000 zł mensuels selon expérience',
        'Travail hybride (2 jours remote / semaine)',
        'Package relocalisation et visa de travail pris en charge',
        'Budget formation et conférences',
      ],
    ),
  },
  {
    name: 'Chef de chantier BTP',
    partner: 'Construções Atlântico',
    country: { code: 'PT', name: 'Portugal' },
    city: 'Porto',
    workMode: 'onsite',
    contract: 'CDI',
    salary: '2 200 – 2 800 €',
    sector: 'BTP',
    urgent: false,
    openings: 2,
    skills: ['Gestion de chantier', 'Management', 'Permis B', 'Lecture de plans', 'Sécurité chantier'],
    publishDate: inDays(-12),
    deadline: inDays(40),
    status: 'published',
    description: desc(
      'Construções Atlântico, entreprise générale de BTP basée à Porto, cherche un chef de chantier pour piloter des projets résidentiels et tertiaires. Encadrement d\u2019équipes de 10 à 25 compagnons.',
      [
        'Organiser et suivre l\u2019avancement des chantiers affectés',
        'Manager les équipes et coordonner les sous-traitants',
        'Veiller au respect des délais, du budget et des règles HSE',
        'Assurer l\u2019interface avec la maîtrise d\u2019ouvrage',
      ],
      [
        'Expérience confirmée en conduite de chantier',
        'Permis B indispensable — déplacements entre sites',
        'Maîtrise de la lecture de plans et des normes de sécurité',
        'Portugais ou anglais de base apprécié',
      ],
      [
        'Salaire 2 200 – 2 800 € + primes de chantier',
        'CDI dans un groupe en croissance',
        'Véhicule et téléphone de fonction',
        'Logement aidé la première année',
      ],
    ),
  },
  {
    name: 'Technicien maintenance',
    partner: 'Doha Facility Group',
    country: { code: 'QA', name: 'Qatar' },
    city: 'Doha',
    workMode: 'onsite',
    contract: 'CDD 24 mois',
    salary: '7 000 – 9 000 QAR',
    sector: 'Maintenance',
    urgent: true,
    openings: 5,
    skills: ['Maintenance industrielle', 'Électromécanique', 'CVC/climatisation', 'Diagnostic pannes'],
    publishDate: inDays(-7),
    deadline: inDays(50),
    status: 'published',
    description: desc(
      'Doha Facility Group assure la maintenance de tours de bureaux et d\u2019hôtels à Doha. Dans le cadre de nouveaux contrats, nous recrutons des techniciens de maintenance polyvalents pour un contrat de 24 mois.',
      [
        'Assurer la maintenance préventive et corrective des équipements',
        'Diagnostiquer et réparer les pannes électriques et mécaniques',
        'Intervenir sur les systèmes CVC (climatisation) des bâtiments',
        'Renseigner les rapports d\u2019intervention dans la GMAO',
      ],
      [
        'Expérience en maintenance industrielle ou technique du bâtiment',
        'Connaissances en électromécanique et/ou CVC',
        'Anglais technique de base',
        'Disponibilité pour un contrat de 24 mois',
      ],
      [
        'Salaire 7 000 – 9 000 QAR nets par mois',
        'Logement et transport entièrement fournis',
        'Billet d\u2019avion annuel vers le pays d\u2019origine',
        'Assurance santé prise en charge',
      ],
    ),
  },
  {
    name: 'Serveur / Barman',
    partner: 'Riviera Hotels',
    country: { code: 'AL', name: 'Albanie' },
    city: 'Tirana',
    workMode: 'onsite',
    contract: 'Saisonnier',
    salary: '900 – 1 200 €',
    sector: 'Hôtellerie',
    urgent: false,
    openings: 8,
    skills: ['Service en salle', 'Bar', 'Anglais', 'Relation client'],
    publishDate: inDays(-15),
    deadline: inDays(30),
    status: 'published',
    description: desc(
      'Le groupe Riviera Hotels ouvre sa saison estivale sur la Riviera albanaise et à Tirana. Nous recherchons des serveurs et barmans pour nos restaurants et bars de plage — idéal pour une première expérience à l\u2019international.',
      [
        'Assurer le service en salle et au bar des clients internationaux',
        'Préparer cocktails et boissons selon les standards de l\u2019établissement',
        'Garantir la qualité de l\u2019accueil et de l\u2019expérience client',
        'Participer à la mise en place et au rangement du service',
      ],
      [
        'Première expérience en restauration ou bar appréciée',
        'Anglais courant — clientèle internationale',
        'Sens du service et présentation soignée',
        'Disponible juin à septembre',
      ],
      [
        'Salaire 900 – 1 200 € + pourboires partagés',
        'Logement et repas fournis pendant la saison',
        'Contrat saisonnier renouvelable chaque été',
        'Ambiance de travail conviviale en bord de mer',
      ],
    ),
  },
  {
    name: 'Comptable bilingue',
    partner: 'Fidex Conseil',
    country: { code: 'FR', name: 'France' },
    city: 'Marseille',
    workMode: 'hybrid',
    contract: 'CDI',
    salary: '2 400 – 2 900 €',
    sector: 'Finance',
    urgent: false,
    openings: 1,
    skills: ['Comptabilité générale', 'Français/Anglais', 'Excel', 'Sage', 'Facturation'],
    publishDate: inDays(-20),
    deadline: inDays(35),
    status: 'published',
    description: desc(
      'Fidex Conseil, cabinet comptable marseillais à clientèle internationale, recrute un comptable bilingue français/anglais pour gérer un portefeuille de dossiers clients européens.',
      [
        'Tenir la comptabilité générale d\u2019un portefeuille clients',
        'Établir déclarations de TVA et liasses fiscales',
        'Échanger avec les clients anglophones du cabinet',
        'Participer aux révisions et clôtures annuelles',
      ],
      [
        'Formation comptable (BTS CG, DCG ou équivalent)',
        'Français et anglais professionnels exigés',
        'Maîtrise d\u2019Excel ; Sage ou logiciel équivalent',
        'Rigueur et sens de la confidentialité',
      ],
      [
        'Salaire 2 400 – 2 900 € selon expérience',
        'CDI hybride — 2 jours de télétravail',
        'Tickets restaurant et mutuelle',
        'Formation continue (IEC, mémentos)',
      ],
    ),
  },
  {
    name: 'Opérateur CNC',
    partner: 'PrecisionParts Milano',
    country: { code: 'IT', name: 'Italie' },
    city: 'Milan',
    workMode: 'onsite',
    contract: 'CDI',
    salary: '2 000 – 2 500 €',
    sector: 'Industrie',
    urgent: false,
    openings: 3,
    skills: ['CNC', 'Fraisage', 'Tournage', 'Lecture de plan', 'Métrologie'],
    publishDate: inDays(-18),
    deadline: inDays(42),
    status: 'published',
    description: desc(
      'PrecisionParts Milano produit des composants de précision pour l\u2019aéronautique et le médical. Nous recrutons des opérateurs CN sur fraiseuses et tours 3-5 axes — formation interne prévue.',
      [
        'Conduire des machines CNC (fraiseuses/tours) en production série',
        'Régler, ajuster et surveiller les paramètres d\u2019usinage',
        'Contrôler les pièces aux instruments de mesure (métrologie)',
        'Renseigner les fiches de suivi de production',
      ],
      [
        'Expérience en conduite de machines CNC',
        'Lecture de plan et tolérances dimensionnelles',
        'Formation interne assurée — profils juniors acceptés',
        'Esprit qualité et précision',
      ],
      [
        'Salaire 2 000 – 2 500 € + primes d\u2019équipe',
        'CDI dans une PME industrielle stable',
        'Formation interne et évolutions possibles',
        'Participation au transport ou au logement',
      ],
    ),
  },
];

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('[seed] connecté');

  // Index unique legacy {candidate,offer,position} — incompatible avec les
  // candidatures client (candidate=null). Suppression tolérante.
  try {
    await mongoose.connection.collection('applications').dropIndex('candidate_1_offer_1_position_1');
    console.log('[seed] index legacy applications supprimé');
  } catch {
    /* absent → ok */
  }

  const admin = await User.findOne({ role: 'admin' }).select('email').lean();
  const postedBy = admin
    ? { user: admin._id, role: 'admin', label: admin.email }
    : { role: 'admin', label: 'seed' };

  for (const data of OFFERS) {
    const res = await Offer.updateOne(
      { name: data.name, partner: data.partner },
      { $set: { ...data, postedBy, lastModifiedAt: new Date() } },
      { upsert: true },
    );
    console.log(`[seed] ${res.upsertedCount ? 'créée' : 'mise à jour'} — ${data.name} (${data.partner})`);
  }

  await mongoose.disconnect();
  console.log('[seed] terminé ✔');
}

main().catch((e) => {
  console.error('[seed] erreur', e);
  process.exit(1);
});
