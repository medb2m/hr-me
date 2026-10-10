/** État éditeur CV  — versionné pour évolutions futures. */
export const CV_EDITOR_VERSION = 1;

/** Entrée structurée du formulaire guidé (expérience, formation…). */
export interface CvFormEntry {
  /** Poste / diplôme. */
  title: string;
  /** Employeur / établissement. */
  org: string;
  /** YYYY-MM-DD via le date picker partagé. */
  startDate: string;
  endDate: string;
  /** « En cours » — l'aperçu affiche « Présent », endDate ignorée. */
  current: boolean;
  /** Description HTML (éditeur riche). */
  description: string;
}

export interface CvSectionBlock {
  visible: boolean;
  /** true = reprendre les données du profil ; false = utiliser `customText` (ou vide). */
  useProfile: boolean;
  /** Troisième source : saisie guidée par formulaire (`entries`). */
  useForm: boolean;
  /** Texte libre si `useProfile` est false (ex. résumé personnalisé). */
  customText: string;
  /** Entrées du formulaire guidé (expérience/formation). */
  entries: CvFormEntry[];
}

export interface CvEditorState {
  version: number;
  /** Titre affiché en-tête du CV (ex. poste visé) — distinct du nom interne du CV. */
  jobTitle: string;
  /** Afficher les numéros de téléphone enregistrés dans le profil. */
  includePhones: boolean;
  /** Afficher les liens externes enregistrés dans le profil. */
  includeLinks: boolean;
  /** Format Canada / USA : CV sans photo. */
  hidePhoto: boolean;
  summary: CvSectionBlock;
  personal: CvSectionBlock;
  experience: CvSectionBlock;
  education: CvSectionBlock;
  skills: CvSectionBlock;
  languages: CvSectionBlock;
}

export function defaultCvSectionBlock(): CvSectionBlock {
  return { visible: true, useProfile: true, useForm: false, customText: '', entries: [] };
}

export function createDefaultCvEditorState(): CvEditorState {
  return {
    version: CV_EDITOR_VERSION,
    jobTitle: '',
    includePhones: true,
    includeLinks: true,
    hidePhoto: false,
    summary: defaultCvSectionBlock(),
    personal: defaultCvSectionBlock(),
    experience: defaultCvSectionBlock(),
    education: defaultCvSectionBlock(),
    skills: defaultCvSectionBlock(),
    languages: defaultCvSectionBlock(),
  };
}

function mergeBlock(base: CvSectionBlock, raw: unknown): CvSectionBlock {
  if (!raw || typeof raw !== 'object') {
    return { ...base };
  }
  const o = raw as Record<string, unknown>;
  const entries = Array.isArray(o['entries'])
    ? (o['entries'] as Record<string, unknown>[]).map((e) => ({
        title: typeof e?.['title'] === 'string' ? e['title'] : '',
        org: typeof e?.['org'] === 'string' ? e['org'] : '',
        startDate: typeof e?.['startDate'] === 'string' ? e['startDate'] : '',
        endDate: typeof e?.['endDate'] === 'string' ? e['endDate'] : '',
        current: typeof e?.['current'] === 'boolean' ? e['current'] : false,
        description: typeof e?.['description'] === 'string' ? e['description'] : '',
      }))
    : base.entries;
  return {
    visible: typeof o['visible'] === 'boolean' ? o['visible'] : base.visible,
    useProfile: typeof o['useProfile'] === 'boolean' ? o['useProfile'] : base.useProfile,
    useForm: typeof o['useForm'] === 'boolean' ? o['useForm'] : base.useForm,
    customText: typeof o['customText'] === 'string' ? o['customText'] : base.customText,
    entries,
  };
}

/** Fusionne un objet serveur partiel avec les valeurs par défaut. */
export function mergeCvEditorState(raw: unknown): CvEditorState {
  const d = createDefaultCvEditorState();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return d;
  }
  const o = raw as Record<string, unknown>;
  return {
    version: typeof o['version'] === 'number' ? o['version'] : CV_EDITOR_VERSION,
    jobTitle: typeof o['jobTitle'] === 'string' ? o['jobTitle'] : d.jobTitle,
    includePhones: typeof o['includePhones'] === 'boolean' ? o['includePhones'] : d.includePhones,
    includeLinks: typeof o['includeLinks'] === 'boolean' ? o['includeLinks'] : d.includeLinks,
    hidePhoto: typeof o['hidePhoto'] === 'boolean' ? o['hidePhoto'] : d.hidePhoto,
    summary: mergeBlock(d.summary, o['summary']),
    personal: mergeBlock(d.personal, o['personal']),
    experience: mergeBlock(d.experience, o['experience']),
    education: mergeBlock(d.education, o['education']),
    skills: mergeBlock(d.skills, o['skills']),
    languages: mergeBlock(d.languages, o['languages']),
  };
}
