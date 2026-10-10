/** État éditeur lettre de motivation — versionné pour évolutions futures. */
export const CL_EDITOR_VERSION = 1;

export interface ClEditorState {
  version: number;
  /** Entreprise destinataire (bloc en-tête à droite). */
  companyName: string;
  /** Complément destinataire : service RH, adresse… */
  companyDetail: string;
  /** Objet de la lettre (ex. « Candidature au poste de soudeur TIG »). */
  object: string;
  /** Lieu de rédaction — « Fait à … ». */
  place: string;
  /** Date de la lettre — `YYYY-MM-DD` (défaut : aujourd'hui). */
  date: string;
  /** Formule d'appel (ex. « Madame, Monsieur, »). */
  salutation: string;
  /** Corps de la lettre — HTML (éditeur riche). */
  body: string;
  /** Formule de politesse finale. */
  closing: string;
  /** Nom du signataire repris du profil en bas de lettre. */
  includeSignature: boolean;
}

const DEFAULT_CLOSING =
  'Dans l’attente de votre retour, je vous prie d’agréer, Madame, Monsieur, l’expression de mes salutations distinguées.';

export function createDefaultClEditorState(): ClEditorState {
  return {
    version: CL_EDITOR_VERSION,
    companyName: '',
    companyDetail: '',
    object: '',
    place: '',
    date: new Date().toISOString().slice(0, 10),
    salutation: 'Madame, Monsieur,',
    body: '',
    closing: DEFAULT_CLOSING,
    includeSignature: true,
  };
}

/** Fusionne un objet serveur partiel avec les valeurs par défaut. */
export function mergeClEditorState(raw: unknown): ClEditorState {
  const d = createDefaultClEditorState();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return d;
  }
  const o = raw as Record<string, unknown>;
  const str = (k: keyof ClEditorState) =>
    typeof o[k] === 'string' ? (o[k] as string) : (d[k] as string);
  return {
    version: typeof o['version'] === 'number' ? o['version'] : CL_EDITOR_VERSION,
    companyName: str('companyName'),
    companyDetail: str('companyDetail'),
    object: str('object'),
    place: str('place'),
    date: str('date') || d.date,
    salutation: str('salutation'),
    body: str('body'),
    closing: str('closing'),
    includeSignature:
      typeof o['includeSignature'] === 'boolean' ? o['includeSignature'] : d.includeSignature,
  };
}
