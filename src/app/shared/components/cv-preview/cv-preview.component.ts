import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import {
  LucideCake,
  LucideFlag,
  LucideLink,
  LucideMail,
  LucideMapPin,
  LucidePhone,
} from '@lucide/angular';
import type { CvBlockKey, CvEditorState, CvFormEntry } from '../../../features/client/models/cv-editor-state';

/**
 * Sous-ensemble du profil nécessaire au rendu du CV.
 * Compatible avec `ClientProfileDto` (candidat) et le DTO profil admin.
 */
export interface CvPreviewProfile {
  prenom?: string;
  nom?: string;
  birthDate?: string | null;
  headline?: string;
  phone?: string;
  phones?: string[];
  links?: Array<{ label?: string; url?: string }>;
  city?: string;
  country?: string;
  nationality?: string;
  workExperiences?: Array<{
    jobTitle?: string;
    employer?: string;
    startDate?: string | null;
    endDate?: string | null;
    current?: boolean;
    description?: string;
  }>;
  educations?: Array<{
    title?: string;
    organization?: string;
    startDate?: string | null;
    endDate?: string | null;
    current?: boolean;
  }>;
  skills?: string[];
  digitalSkills?: string[];
  languagesSpoken?: Array<{ language?: string; cefrLevel?: string }>;
}

/**
 * Rendu « feuille CV » partagé : aperçu live dans l'éditeur candidat,
 * aperçu final avant envoi, et consultation côté admin.
 */
@Component({
  selector: 'app-cv-preview',
  standalone: true,
  imports: [
    CommonModule,
    LucideCake,
    LucideFlag,
    LucideLink,
    LucideMail,
    LucideMapPin,
    LucidePhone,
  ],
  templateUrl: './cv-preview.component.html',
  styleUrl: './cv-preview.component.css',
})
export class CvPreviewComponent {
  @Input({ required: true }) state!: CvEditorState;
  @Input() profile: CvPreviewProfile | null = null;
  /** Identité du compte — secours quand le profil est incomplet. */
  @Input() userName = '';
  @Input() userEmail = '';
  /** URL de photo déjà résolue (profil ou photo dédiée). */
  @Input() photoUrl: string | null = null;

  displayName(): string {
    const p = this.profile;
    const line = [(p?.prenom || '').trim(), (p?.nom || '').trim()].filter(Boolean).join(' ');
    return line || (p?.nom || this.userName || '').trim() || 'Candidat(e)';
  }

  fmtMonth(d: string | null | undefined): string {
    if (!d) {
      return '';
    }
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) {
      return String(d).slice(0, 10);
    }
    return new Intl.DateTimeFormat('fr-FR', { month: 'short', year: 'numeric' }).format(dt);
  }

  rangeText(start: string | null | undefined, end: string | null | undefined, current?: boolean): string {
    const s = this.fmtMonth(start);
    const e = current ? 'Présent' : this.fmtMonth(end);
    if (s && e) {
      return `${s} → ${e}`;
    }
    return s || e;
  }

  /** Date de naissance lisible : ISO `YYYY-MM-DD` → `JJ/MM/AAAA`, sinon telle quelle. */
  birthDateText(): string {
    const bd = this.profile?.birthDate;
    if (!bd) {
      return '';
    }
    const iso = String(bd).slice(0, 10);
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : String(bd);
  }

  /** Coordonnées structurées (lignes icônées) depuis le profil. */
  contactRows(): { icon: 'mail' | 'phone' | 'link' | 'map' | 'flag' | 'cake'; text: string }[] {
    const p = this.profile;
    const rows: { icon: 'mail' | 'phone' | 'link' | 'map' | 'flag' | 'cake'; text: string }[] = [];
    const email = (this.userEmail || '').trim();
    if (email) {
      rows.push({ icon: 'mail', text: email });
    }
    if (p?.phone?.trim()) {
      rows.push({ icon: 'phone', text: p.phone.trim() });
    }
    if (this.state.includePhones) {
      for (const t of p?.phones ?? []) {
        const v = t.trim();
        if (v) {
          rows.push({ icon: 'phone', text: v });
        }
      }
    }
    if (this.state.includeLinks) {
      for (const l of p?.links ?? []) {
        const url = (l.url || '').trim();
        if (url) {
          rows.push({ icon: 'link', text: (l.label || '').trim() ? `${l.label!.trim()} : ${url}` : url });
        }
      }
    }
    const place = [p?.city, p?.country].filter((x) => x?.trim()).join(', ');
    if (place) {
      rows.push({ icon: 'map', text: place });
    }
    if (p?.nationality?.trim()) {
      rows.push({ icon: 'flag', text: `Nationalité : ${p.nationality.trim()}` });
    }
    const bd = this.birthDateText();
    if (bd) {
      rows.push({ icon: 'cake', text: `Né(e) le : ${bd}` });
    }
    return rows;
  }

  /** Expériences du profil structurées pour l'aperçu. */
  profileWorkEntries(): { title: string; org: string; dates: string; html: string }[] {
    return (this.profile?.workExperiences ?? [])
      .map((w) => ({
        title: (w.jobTitle || '').trim() || 'Poste',
        org: (w.employer || '').trim(),
        dates: this.rangeText(w.startDate, w.endDate, w.current),
        html: (w.description || '').trim(),
      }))
      .filter((w) => w.title || w.org || w.html);
  }

  profileEduEntries(): { title: string; org: string; dates: string }[] {
    return (this.profile?.educations ?? [])
      .map((e) => ({
        title: (e.title || '').trim() || 'Formation',
        org: (e.organization || '').trim(),
        dates: this.rangeText(e.startDate, e.endDate, e.current),
      }))
      .filter((e) => e.title || e.org);
  }

  /** Compétences du profil en deux groupes pour l'aperçu. */
  profileSkillGroups(): { label: string; items: string[] }[] {
    const p = this.profile;
    const metiers = (p?.skills ?? []).map((s) => s.trim()).filter(Boolean);
    const digital = (p?.digitalSkills ?? []).map((s) => s.trim()).filter(Boolean);
    const groups: { label: string; items: string[] }[] = [];
    if (metiers.length) groups.push({ label: 'Métiers', items: metiers });
    if (digital.length) groups.push({ label: 'Numériques', items: digital });
    return groups;
  }

  profileLangRows(): { name: string; lvl: string }[] {
    return (this.profile?.languagesSpoken ?? [])
      .map((l) => ({ name: (l.language || '').trim(), lvl: (l.cefrLevel || '').trim() }))
      .filter((l) => l.name);
  }

  /** Entrées du bloc en cours de formulaire (non vides pour l'aperçu). */
  formEntries(key: CvBlockKey): CvFormEntry[] {
    return this.state[key].entries.filter(
      (e) => e.title.trim() || e.org.trim() || e.description.trim(),
    );
  }

  previewBlockText(key: CvBlockKey): string {
    const b = this.state[key];
    if (!b.visible) {
      return '';
    }
    if (b.useForm) {
      const list = b.entries.filter(
        (e) => e.title.trim() || e.org.trim() || e.description.trim(),
      );
      if (!list.length) {
        return 'Ajoutez des entrées via le formulaire guidé.';
      }
      return list
        .map((e) => {
          const head = [e.title.trim(), e.org.trim()].filter(Boolean).join(' — ') || 'Entrée';
          const dates = this.rangeText(e.startDate, e.endDate, e.current);
          const parts = [`<strong>${this.esc(head)}</strong>`];
          if (dates) {
            parts.push(`<em class="ep-dates">${this.esc(dates)}</em>`);
          }
          if (e.description.trim()) {
            parts.push(e.description);
          }
          return parts.join('<br>');
        })
        .join('<br><br>');
    }
    if (b.useProfile) {
      return this.textFromProfile(key);
    }
    return (b.customText || '').trim() || '—';
  }

  /** Texte personnalisé / formulaire = HTML ; profil = HTML si description riche. */
  previewBlockIsHtml(key: CvBlockKey): boolean {
    const b = this.state[key];
    if (b.useForm || !b.useProfile) {
      return true;
    }
    return /<[a-z][^>]*>/i.test(this.textFromProfile(key));
  }

  /** Rendu HTML d'un bloc (retours ligne → <br> pour le contenu mixte). */
  previewBlockHtml(key: CvBlockKey): string {
    return this.previewBlockText(key).replace(/\n/g, '<br>');
  }

  /** Texte d'un bloc « profil » — sert aussi d'aperçu texte dans l'éditeur. */
  textFromProfile(key: CvBlockKey): string {
    const p = this.profile;
    const nom = (p?.nom || this.userName || '').trim() || '—';
    const prenom = (p?.prenom || '').trim();
    const email = this.userEmail || '';
    const bd = this.birthDateText();

    switch (key) {
      case 'summary': {
        const h = (p?.headline || '').trim();
        if (h) {
          return h;
        }
        const identity = [prenom, nom].filter(Boolean).join(' ');
        return identity ? `${identity} — candidat(e) (données profil).` : 'Complétez votre accroche dans Identité & profil.';
      }
      case 'personal': {
        const lines: string[] = [];
        const fullName = [prenom, nom].filter(Boolean).join(' ');
        if (fullName) {
          lines.push(fullName);
        }
        if (email) {
          lines.push(email);
        }
        if (p?.phone?.trim()) {
          lines.push(p.phone.trim());
        }
        if (this.state.includePhones) {
          lines.push(...(p?.phones ?? []).map((t) => t.trim()).filter(Boolean));
        }
        if (this.state.includeLinks) {
          lines.push(
            ...(p?.links ?? [])
              .map((l) => {
                const u = (l.url || '').trim();
                const lab = (l.label || '').trim();
                return u ? (lab ? `${lab} : ${u}` : u) : '';
              })
              .filter(Boolean),
          );
        }
        const place = [p?.city, p?.country].filter((x) => x?.trim()).join(', ');
        if (place) {
          lines.push(place);
        }
        if (p?.nationality?.trim()) {
          lines.push(`Nationalité : ${p.nationality.trim()}`);
        }
        if (bd) {
          lines.push(`Né(e) le : ${bd}`);
        }
        return lines.length ? lines.join('\n') : 'Renseignez vos coordonnées dans Identité & profil.';
      }
      case 'experience': {
        const list = p?.workExperiences ?? [];
        if (!list.length) {
          return 'Aucune expérience enregistrée dans le profil — ajoutez-en dans Identité & profil.';
        }
        return list
          .map((w) => {
            const title = (w.jobTitle || '').trim() || 'Poste';
            const emp = (w.employer || '').trim();
            const dates = this.rangeText(w.startDate, w.endDate, w.current);
            const desc = (w.description || '').trim();
            const head = emp ? `${title}, ${emp}` : title;
            return [head, dates, desc].filter(Boolean).join('\n');
          })
          .join('\n\n');
      }
      case 'education': {
        const list = p?.educations ?? [];
        if (!list.length) {
          return 'Aucune formation enregistrée dans le profil.';
        }
        return list
          .map((e) => {
            const t = (e.title || '').trim() || 'Formation';
            const org = (e.organization || '').trim();
            const dates = this.rangeText(e.startDate, e.endDate, e.current);
            return [org ? `${t} — ${org}` : t, dates].filter(Boolean).join('\n');
          })
          .join('\n\n');
      }
      case 'skills': {
        const s = p?.skills?.filter((x) => x.trim()) ?? [];
        const d = p?.digitalSkills?.filter((x) => x.trim()) ?? [];
        const parts: string[] = [];
        if (s.length) {
          parts.push(s.join(', '));
        }
        if (d.length) {
          parts.push(`Comp. numériques : ${d.join(', ')}`);
        }
        return parts.length ? parts.join('\n') : 'Ajoutez des compétences dans Identité & profil.';
      }
      case 'languages': {
        const list = p?.languagesSpoken ?? [];
        if (!list.length) {
          return 'Aucune langue renseignée dans le profil.';
        }
        return list
          .map((l) => {
            const lang = (l.language || '').trim() || 'Langue';
            const lv = (l.cefrLevel || '').trim();
            return lv ? `${lang} (${lv})` : lang;
          })
          .join('\n');
      }
      default:
        return '';
    }
  }

  private esc(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
