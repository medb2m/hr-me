import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

/**
 * Drapeau pays — image SVG/PNG flagcdn (fonctionne partout, contrairement
 * aux emojis de drapeau qui n'affichent que des lettres sous Windows).
 * Fallback : pastille avec le code ISO si l'image échoue ou le code est vide.
 * Usage : `<app-flag code="fr" />` ou `<app-flag code="fr" size="lg" />`.
 */
@Component({
  selector: 'app-flag',
  imports: [CommonModule],
  template: `
    @if (!errored && code) {
      <img
        class="fl-img"
        [class.fl-img--lg]="size === 'lg'"
        [src]="src"
        [srcset]="src2x"
        [alt]="code"
        loading="lazy"
        (error)="errored = true"
      />
    } @else {
      <span class="fl-fallback" [class.fl-fallback--lg]="size === 'lg'">{{ code || '—' }}</span>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      line-height: 0;
      vertical-align: middle;
    }
    .fl-img {
      width: 20px;
      height: 15px;
      object-fit: cover;
      border-radius: 3px;
      box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.12);
      display: block;
    }
    .fl-img--lg {
      width: 26px;
      height: 20px;
      border-radius: 4px;
    }
    .fl-fallback {
      display: inline-grid;
      place-items: center;
      width: 20px;
      height: 15px;
      border-radius: 3px;
      background: #e2e8f0;
      color: #475569;
      font-size: 0.55rem;
      font-weight: 800;
      letter-spacing: 0.02em;
    }
    .fl-fallback--lg {
      width: 26px;
      height: 20px;
      font-size: 0.6rem;
      border-radius: 4px;
    }
  `,
})
export class FlagComponent {
  @Input() code = '';
  @Input() size: 'sm' | 'lg' = 'sm';

  errored = false;

  get src(): string {
    return `https://flagcdn.com/w40/${this.code.toLowerCase()}.png`;
  }

  get src2x(): string {
    return `https://flagcdn.com/w80/${this.code.toLowerCase()}.png 2x`;
  }
}
