/** État éditeur CV  — versionné pour évolutions futures. */
export const CV_EDITOR_VERSION = 1;

export interface CvSectionBlock {
  visible: boolean;
  /** true = reprendre les données du profil ; false = utiliser `customText` (ou vide). */
  useProfile: boolean;
  /** Texte libre si `useProfile` est false (ex. résumé personnalisé). */
  customText: string;
}

export interface CvEditorState {
  version: number;
  /** Titre affiché en-tête du CV (ex. poste visé) — distinct du nom interne du CV. */
  jobTitle: string;
  /** Afficher les numéros de téléphone enregistrés dans le profil. */
  includePhones: boolean;
  /** Afficher les liens externes enregistrés dans le profil. */
  includeLinks: boolean;
  summary: CvSectionBlock;
  personal: CvSectionBlock;
  experience: CvSectionBlock;
  education: CvSectionBlock;
  skills: CvSectionBlock;
  languages: CvSectionBlock;
}

export function defaultCvSectionBlock(): CvSectionBlock {
  return { visible: true, useProfile: true, customText: '' };
}

export function createDefaultCvEditorState(): CvEditorState {
  return {
    version: CV_EDITOR_VERSION,
    jobTitle: '',
    includePhones: true,
    includeLinks: true,
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
  return {
    visible: typeof o['visible'] === 'boolean' ? o['visible'] : base.visible,
    useProfile: typeof o['useProfile'] === 'boolean' ? o['useProfile'] : base.useProfile,
    customText: typeof o['customText'] === 'string' ? o['customText'] : base.customText,
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
    summary: mergeBlock(d.summary, o['summary']),
    personal: mergeBlock(d.personal, o['personal']),
    experience: mergeBlock(d.experience, o['experience']),
    education: mergeBlock(d.education, o['education']),
    skills: mergeBlock(d.skills, o['skills']),
    languages: mergeBlock(d.languages, o['languages']),
  };
}
