/**
 * Builders HTML pour l'export PDF — reproduisent fidèlement les aperçus
 * `app-cv-preview` (feuille ep-sheet) et `app-cl-preview` (feuille clp-sheet).
 */
import { pdfDocument } from '../services/pdf.service.js';

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const fmtMonth = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d).slice(0, 10);
  return new Intl.DateTimeFormat('fr-FR', { month: 'short', year: 'numeric' }).format(dt);
};

const rangeText = (start, end, current) => {
  const s = fmtMonth(start);
  const e = current ? 'Présent' : fmtMonth(end);
  if (s && e) return `${s} → ${e}`;
  return s || e;
};

const birthDateText = (bd) => {
  if (!bd) return '';
  const iso = String(bd).slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(bd);
};

const displayName = (profile, userName) => {
  const p = profile || {};
  const line = [p.prenom, p.nom].map((x) => (x || '').trim()).filter(Boolean).join(' ');
  return line || (p.nom || userName || '').trim() || 'Candidat(e)';
};

/** Section block fusionné avec les défauts (identique à mergeCvEditorState). */
const normBlock = (raw) => {
  const o = raw && typeof raw === 'object' ? raw : {};
  const entries = Array.isArray(o.entries)
    ? o.entries.map((e) => ({
        title: e?.title || '',
        org: e?.org || '',
        startDate: e?.startDate || '',
        endDate: e?.endDate || '',
        current: !!e?.current,
        description: e?.description || '',
      }))
    : [];
  return {
    visible: o.visible !== false,
    useProfile: o.useProfile !== false && !o.useForm,
    useForm: !!o.useForm,
    customText: typeof o.customText === 'string' ? o.customText : '',
    entries,
  };
};

const nl2br = (s) => s.replace(/\n/g, '<br>');

/* ---------- Coordonnées (bloc personal + profil) ---------- */
const contactRows = (state, profile, userEmail) => {
  const p = profile || {};
  const rows = [];
  const email = (userEmail || '').trim();
  if (email) rows.push(email);
  if (p.phone?.trim()) rows.push(p.phone.trim());
  if (state.includePhones !== false) {
    for (const t of p.phones ?? []) {
      const v = String(t).trim();
      if (v) rows.push(v);
    }
  }
  if (state.includeLinks) {
    for (const l of p.links ?? []) {
      const url = (l.url || '').trim();
      if (url) rows.push(l.label?.trim() ? `${l.label.trim()} : ${url}` : url);
    }
  }
  const place = [p.city, p.country].filter((x) => x?.trim()).join(', ');
  if (place) rows.push(place);
  if (p.nationality?.trim()) rows.push(`Nationalité : ${p.nationality.trim()}`);
  const bd = birthDateText(p.birthDate);
  if (bd) rows.push(`Né(e) le : ${bd}`);
  return rows;
};

/* ---------- Sections CV ---------- */
const sectionHtml = (h3, inner) =>
  `<section class="block"><h3 class="h3">${h3}</h3>${inner}</section>`;

const dim = (t) => `<p class="text dim">${esc(t)}</p>`;

const entriesHtml = (list, withDesc) =>
  list
    .map(
      (e) => `<div class="entry">
  <p class="etitle">${esc(e.title)}${e.org ? ` — <span class="eorg">${esc(e.org)}</span>` : ''}</p>
  ${e.dates ? `<p class="edates">${esc(e.dates)}</p>` : ''}
  ${withDesc && e.description ? `<div class="etext">${e.description}</div>` : ''}
</div>`,
    )
    .join('');

/** Construit le corps HTML d'un bloc (profil / formulaire / texte libre). */
const blockHtml = (key, block, state, profile, userEmail) => {
  const p = profile || {};
  if (block.useForm) {
    const list = block.entries.filter((e) => e.title.trim() || e.org.trim() || e.description.trim());
    if (!list.length) return dim('Ajoutez des entrées via le formulaire guidé.');
    return entriesHtml(
      list.map((e) => ({
        title: e.title.trim() || 'Entrée',
        org: e.org.trim(),
        dates: rangeText(e.startDate, e.endDate, e.current),
        description: e.description,
      })),
      true,
    );
  }
  if (!block.useProfile) {
    const t = (block.customText || '').trim();
    return t ? `<div class="text">${nl2br(t)}</div>` : dim('—');
  }
  // Source = profil
  switch (key) {
    case 'summary': {
      const h = (p.headline || '').trim();
      const identity = displayName(p, '');
      const t =
        h ||
        (identity && identity !== 'Candidat(e)'
          ? `${esc(identity)} — candidat(e) (données profil).`
          : '');
      return t ? `<div class="tagline">${nl2br(t)}</div>` : '';
    }
    case 'personal': {
      const rows = contactRows(state, p, userEmail);
      if (!rows.length) return dim('Renseignez vos coordonnées dans Identité & profil.');
      return `<ul class="contact">${rows.map((r) => `<li><span class="dot"></span><span>${esc(r)}</span></li>`).join('')}</ul>`;
    }
    case 'experience': {
      const list = (p.workExperiences ?? [])
        .map((w) => ({
          title: (w.jobTitle || '').trim() || 'Poste',
          org: (w.employer || '').trim(),
          dates: rangeText(w.startDate, w.endDate, w.current),
          description: (w.description || '').trim(),
        }))
        .filter((w) => w.title || w.org || w.description);
      return list.length ? entriesHtml(list, true) : dim('Aucune expérience renseignée.');
    }
    case 'education': {
      const list = (p.educations ?? [])
        .map((e) => ({
          title: (e.title || '').trim() || 'Formation',
          org: (e.organization || '').trim(),
          dates: rangeText(e.startDate, e.endDate, e.current),
        }))
        .filter((e) => e.title || e.org);
      return list.length ? entriesHtml(list, false) : dim('Aucune formation renseignée.');
    }
    case 'skills': {
      const metiers = (p.skills ?? []).map((s) => s.trim()).filter(Boolean);
      const digital = (p.digitalSkills ?? []).map((s) => s.trim()).filter(Boolean);
      if (!metiers.length && !digital.length) return dim('Aucune compétence renseignée.');
      const chips = (items) => `<div class="chips">${items.map((s) => `<span class="chip">${esc(s)}</span>`).join('')}</div>`;
      return [
        metiers.length ? `<p class="glabel">Métiers</p>${chips(metiers)}` : '',
        digital.length ? `<p class="glabel">Numériques</p>${chips(digital)}` : '',
      ].join('');
    }
    case 'languages': {
      const list = (p.languagesSpoken ?? [])
        .map((l) => ({ name: (l.language || '').trim(), lvl: (l.cefrLevel || '').trim() }))
        .filter((l) => l.name);
      if (!list.length) return dim('Aucune langue renseignée.');
      return `<div class="langs">${list
        .map(
          (l) =>
            `<span class="lang">${esc(l.name)}${l.lvl ? ` <span class="lvl">${esc(l.lvl)}</span>` : ''}</span>`,
        )
        .join('')}</div>`;
    }
    default:
      return '';
  }
};

/** PDF HTML complet d'un CV (feuille identique à app-cv-preview). */
export function cvPdfDocument(cv, profile, user) {
  const s = cv.editorState && typeof cv.editorState === 'object' ? cv.editorState : {};
  const state = {
    jobTitle: s.jobTitle || '',
    includePhones: s.includePhones !== false,
    includeLinks: s.includeLinks !== false,
    hidePhoto: !!s.hidePhoto,
    summary: normBlock(s.summary),
    personal: normBlock(s.personal),
    experience: normBlock(s.experience),
    education: normBlock(s.education),
    skills: normBlock(s.skills),
    languages: normBlock(s.languages),
  };
  const name = displayName(profile, user?.name);
  const photoUrl =
    cv.photoSource === 'custom'
      ? cv.customPhotoUrl || ''
      : profile?.profilePhotoUrl || '';
  const summaryInner = state.summary.visible
    ? blockHtml('summary', state.summary, state, profile, user?.email)
    : '';
  const sections = [
    ['personal', 'Coordonnées'],
    ['experience', 'Expérience professionnelle'],
    ['education', 'Formation'],
    ['skills', 'Compétences'],
    ['languages', 'Langues'],
  ]
    .map(([key, h3]) => (state[key].visible ? sectionHtml(h3, blockHtml(key, state[key], state, profile, user?.email)) : ''))
    .join('');

  const html = `
<div class="sheet">
  <div class="accent">
    ${!state.hidePhoto && photoUrl ? `<div class="photo"><img src="${esc(photoUrl)}" alt=""></div>` : ''}
    <div class="head">
      <p class="name">${esc(name)}</p>
      ${state.jobTitle.trim() ? `<p class="job">${esc(state.jobTitle)}</p>` : ''}
      ${summaryInner}
    </div>
  </div>
  <div class="body">${sections}</div>
</div>`;

  return pdfDocument(
    html,
    `
.sheet { background:#fff; width: 100%; min-height: 297mm; }
.accent { display:flex; gap:1rem; padding:14mm 16mm 9mm; background:linear-gradient(135deg,#0f172a 0%,#334155 100%); color:#fff; }
.photo { width:30mm; height:36mm; flex-shrink:0; border:1.2mm solid rgba(255,255,255,.85); border-radius:1mm; overflow:hidden; }
.photo img { width:100%; height:100%; object-fit:cover; }
.head { flex:1; min-width:0; }
.name { margin:0; font-size:22pt; font-weight:700; letter-spacing:.02em; }
.job { margin:3pt 0 0; font-size:14pt; font-weight:700; color:#ffd300; }
.tagline { margin:6pt 0 0; font-size:10.5pt; line-height:1.45; color:#e2e8f0; }
.tagline ul,.tagline ol { margin:3pt 0; padding-left:14pt; } .tagline ul{list-style:disc} .tagline ol{list-style:decimal} .tagline li{color:#e2e8f0}
.body { padding:8mm 16mm 12mm; }
.block { margin-bottom:6mm; padding-bottom:5mm; border-bottom:.3mm solid #e2e8f0; page-break-inside:avoid; }
.block:last-child { margin-bottom:0; padding-bottom:0; border-bottom:none; }
.h3 { margin:0 0 3pt; font-size:9pt; text-transform:uppercase; letter-spacing:.06em; color:#0f172a; }
.text { font-size:9.5pt; line-height:1.5; color:#1e293b; }
.text ul,.text ol,.etext ul,.etext ol { margin:3pt 0; padding-left:14pt; } .text ul,.etext ul{list-style:disc} .text ol,.etext ol{list-style:decimal} .text li,.etext li{color:#1e293b}
.contact { list-style:none; display:flex; flex-direction:column; gap:3pt; }
.contact li { display:flex; align-items:center; gap:6pt; font-size:9.5pt; color:#1e293b; }
.dot { width:3pt; height:3pt; border-radius:50%; background:#a16207; flex-shrink:0; }
.entry { margin-bottom:8pt; page-break-inside:avoid; } .entry:last-child{margin-bottom:0}
.etitle { font-size:10pt; font-weight:700; color:#0f172a; }
.eorg { font-weight:600; color:#475569; }
.edates { margin:1pt 0 2pt; font-size:8.5pt; font-style:italic; color:#64748b; }
.etext { font-size:9.5pt; line-height:1.5; color:#1e293b; }
.dim { color:#94a3b8; font-style:italic; }
.glabel { margin:5pt 0 3pt; font-size:8pt; font-weight:800; text-transform:uppercase; letter-spacing:.05em; color:#64748b; }
.glabel:first-of-type{margin-top:0}
.chips { display:flex; flex-wrap:wrap; gap:4pt; }
.chip { display:inline-flex; padding:3pt 8pt; border-radius:999px; font-size:8.5pt; font-weight:600; color:#0f172a; background:rgba(255,211,0,.18); border:.3mm solid rgba(255,211,0,.5); }
.langs { display:flex; flex-wrap:wrap; gap:5pt; }
.lang { display:inline-flex; align-items:center; gap:5pt; padding:4pt 9pt; border-radius:8px; font-size:9pt; font-weight:600; color:#1e293b; background:#f1f5f9; border:.3mm solid #e2e8f0; }
.lvl { padding:1pt 6pt; border-radius:999px; font-size:7.5pt; font-weight:800; color:#0f172a; background:#ffd300; }
`,
  );
}

/* ---------- Lettre de motivation ---------- */

const letterDateLine = (state) => {
  const d = state.date;
  let label = '';
  if (d) {
    const dt = new Date(`${String(d).slice(0, 10)}T00:00:00`);
    label = Number.isNaN(dt.getTime())
      ? String(d).slice(0, 10)
      : new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(dt);
  }
  const place = (state.place || '').trim();
  if (place && label) return `${place}, le ${label}`;
  return label ? `Le ${label}` : place;
};

export function clPdfDocument(cl, profile, user) {
  const raw = cl.editorState && typeof cl.editorState === 'object' ? cl.editorState : {};
  const state = {
    companyName: raw.companyName || '',
    companyDetail: raw.companyDetail || '',
    object: raw.object || '',
    place: raw.place || '',
    date: raw.date || new Date().toISOString().slice(0, 10),
    salutation: raw.salutation || 'Madame, Monsieur,',
    body: raw.body || '',
    closing:
      raw.closing ??
      'Dans l’attente de votre retour, je vous prie d’agréer, Madame, Monsieur, l’expression de mes salutations distinguées.',
    includeSignature: raw.includeSignature !== false,
  };
  const p = profile || {};
  const name = displayName(p, user?.name);
  const senderLines = [];
  if (user?.email?.trim()) senderLines.push(user.email.trim());
  if (p.phone?.trim()) senderLines.push(p.phone.trim());
  for (const t of p.phones ?? []) {
    const v = String(t).trim();
    if (v) senderLines.push(v);
  }
  const place = [p.city, p.country].filter((x) => x?.trim()).join(', ');
  if (place) senderLines.push(place);
  const dateLine = letterDateLine(state);
  const body = (state.body || '').trim() || '<p class="dim">Le corps de la lettre apparaîtra ici…</p>';
  const closing = (state.closing || '').trim();

  const html = `
<div class="sheet">
  <div class="lhead">
    <div class="sender">
      <p class="lname">${esc(name)}</p>
      ${senderLines.map((l) => `<p class="lline">${esc(l)}</p>`).join('')}
    </div>
    <div class="recipient">
      <p class="to">À l’attention de</p>
      <p class="company">${esc(state.companyName.trim() || 'Entreprise destinataire')}</p>
      ${state.companyDetail.trim() ? `<p class="lline">${esc(state.companyDetail)}</p>` : ''}
    </div>
  </div>
  ${dateLine ? `<p class="ldate">${esc(dateLine)}</p>` : ''}
  ${state.object.trim() ? `<p class="object"><strong>Objet :</strong> ${esc(state.object)}</p>` : ''}
  ${state.salutation.trim() ? `<p class="salutation">${esc(state.salutation)}</p>` : ''}
  <div class="lbody">${body}</div>
  ${closing ? `<p class="closing">${esc(closing)}</p>` : ''}
  ${state.includeSignature ? `<p class="signature">${esc(name)}</p>` : ''}
</div>`;

  return pdfDocument(
    html,
    `
.sheet { background:#fff; min-height:297mm; padding:18mm 20mm; font-family:Georgia,'Times New Roman',serif; color:#1e293b; }
.lhead { display:flex; justify-content:space-between; gap:14mm; margin-bottom:12mm; }
.sender,.recipient { min-width:0; font-size:10pt; line-height:1.5; }
.recipient { text-align:right; max-width:45%; }
.lname { margin:0 0 3pt; font-weight:700; font-size:11pt; color:#0f172a; }
.lline { margin:0; color:#475569; }
.to { margin:0 0 1.5pt; font-size:8.5pt; font-style:italic; color:#94a3b8; }
.company { margin:0; font-weight:700; font-size:10.5pt; color:#0f172a; }
.ldate { margin:0 0 10mm; text-align:right; font-size:10pt; color:#334155; }
.object { margin:0 0 8mm; font-size:10.5pt; color:#0f172a; }
.salutation { margin:0 0 6mm; font-size:10pt; color:#1e293b; }
.lbody { font-size:10pt; line-height:1.65; color:#1e293b; word-break:break-word; }
.lbody p { margin:0 0 5mm; }
.lbody ul,.lbody ol { margin:2pt 0 5mm; padding-left:16pt; }
.lbody ul{list-style:disc} .lbody ol{list-style:decimal} .lbody li{color:#1e293b}
.dim { color:#94a3b8; font-style:italic; }
.closing { margin:10mm 0 0; font-size:10pt; line-height:1.6; color:#1e293b; }
.signature { margin:12mm 0 0; text-align:right; font-family:'Segoe Script','Lucida Handwriting',cursive; font-size:13pt; color:#0f172a; }
`,
  );
}

/** Nom de fichier de téléchargement sûr. */
export function pdfFilename(prefix, name) {
  const base = String(name || '')
    .trim()
    .replace(/[\\/:*?"<>|]/g, '-')
    .slice(0, 80);
  return `${prefix} - ${base || 'document'}.pdf`;
}
