import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import type { ClEditorState } from '../../../features/client/models/cl-editor-state';

/** Sous-ensemble du profil nécessaire à l'en-tête expéditeur de la lettre. */
export interface ClPreviewProfile {
  prenom?: string;
  nom?: string;
  phone?: string;
  phones?: string[];
  city?: string;
  country?: string;
}

/**
 * Rendu « feuille lettre de motivation » partagé : aperçu live dans l'éditeur
 * candidat et consultation côté admin (même approche que `app-cv-preview`).
 */
@Component({
  selector: 'app-cl-preview',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cl-preview.component.html',
  styleUrl: './cl-preview.component.css',
})
export class ClPreviewComponent {
  @Input({ required: true }) state!: ClEditorState;
  @Input() profile: ClPreviewProfile | null = null;
  /** Identité du compte — secours quand le profil est incomplet. */
  @Input() userName = '';
  @Input() userEmail = '';

  displayName(): string {
    const p = this.profile;
    const line = [(p?.prenom || '').trim(), (p?.nom || '').trim()].filter(Boolean).join(' ');
    return line || (p?.nom || this.userName || '').trim() || 'Candidat(e)';
  }

  /** Lignes de contact expéditeur (e-mail, téléphone(s), ville/pays). */
  senderLines(): string[] {
    const p = this.profile;
    const lines: string[] = [];
    const email = (this.userEmail || '').trim();
    if (email) {
      lines.push(email);
    }
    if (p?.phone?.trim()) {
      lines.push(p.phone.trim());
    }
    for (const t of p?.phones ?? []) {
      const v = t.trim();
      if (v) {
        lines.push(v);
      }
    }
    const place = [p?.city, p?.country].filter((x) => x?.trim()).join(', ');
    if (place) {
      lines.push(place);
    }
    return lines;
  }

  /** « Tunis, le 10 octobre 2026 » — place + date lisible. */
  dateLine(): string {
    const d = this.state.date;
    let label = '';
    if (d) {
      const dt = new Date(`${d.slice(0, 10)}T00:00:00`);
      label = Number.isNaN(dt.getTime())
        ? d.slice(0, 10)
        : new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(dt);
    }
    const place = this.state.place.trim();
    if (place && label) {
      return `${place}, le ${label}`;
    }
    return label ? `Le ${label}` : place;
  }

  /** Corps HTML ; si vide → texte d'aide. */
  bodyHtml(): string {
    const b = (this.state.body || '').trim();
    return b || '<p class="clp-dim">Le corps de la lettre apparaîtra ici…</p>';
  }

  closingText(): string {
    return (this.state.closing || '').trim();
  }
}
