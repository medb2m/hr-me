import { CommonModule } from '@angular/common';
import { Component, ElementRef, Input, ViewChild, forwardRef, inject } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { finalize } from 'rxjs';
import {
  LucideBold,
  LucideEraser,
  LucideItalic,
  LucideLink,
  LucideList,
  LucideListOrdered,
  LucideLoader2,
  LucideRotateCcw,
  LucideSparkles,
  LucideUnderline,
} from '@lucide/angular';
import { AiTextService } from '../../../core/services/ai-text.service';

/**
 * Éditeur de texte enrichi (WYSIWYG) partagé — `[(ngModel)]` sur du HTML.
 * Barre d'outils : gras, italique, souligné, listes, lien, effacer le format,
 * correction IA et réinitialisation.
 */
@Component({
  selector: 'app-rich-text-editor',
  standalone: true,
  imports: [
    CommonModule,
    LucideBold,
    LucideEraser,
    LucideItalic,
    LucideLink,
    LucideList,
    LucideListOrdered,
    LucideLoader2,
    LucideRotateCcw,
    LucideSparkles,
    LucideUnderline,
  ],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RichTextEditorComponent),
      multi: true,
    },
  ],
  templateUrl: './rich-text-editor.component.html',
  styleUrl: './rich-text-editor.component.css',
})
export class RichTextEditorComponent implements ControlValueAccessor {
  private readonly ai = inject(AiTextService);

  @ViewChild('editor') private editorRef?: ElementRef<HTMLDivElement>;

  @Input() placeholder = 'Saisissez votre texte…';
  /** Affiche le bouton de correction IA. */
  @Input() aiEnabled = true;

  disabled = false;
  aiBusy = false;
  aiError = '';

  private onChange: (v: string) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(html: string | null): void {
    const el = this.editorRef?.nativeElement;
    if (!el) {
      return;
    }
    const incoming = this.normalizeIncoming(html ?? '');
    if (el.innerHTML !== incoming) {
      el.innerHTML = incoming;
    }
  }

  registerOnChange(fn: (v: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled = disabled;
  }

  /** Texte brut hérité (sans balises) → convertir les sauts de ligne. */
  private normalizeIncoming(v: string): string {
    if (!v.includes('<')) {
      return v.replace(/\n/g, '<br>');
    }
    return v;
  }

  onInput(): void {
    const el = this.editorRef?.nativeElement;
    this.onChange(el?.innerHTML ?? '');
  }

  onBlur(): void {
    this.onTouched();
  }

  exec(command: string, value?: string): void {
    if (this.disabled) {
      return;
    }
    this.editorRef?.nativeElement.focus();
    document.execCommand(command, false, value);
    this.onInput();
  }

  insertLink(): void {
    if (this.disabled) {
      return;
    }
    const url = window.prompt('URL du lien :', 'https://');
    if (url?.trim() && url !== 'https://') {
      this.exec('createLink', url.trim());
    }
  }

  clearFormat(): void {
    this.exec('removeFormat');
  }

  resetContent(): void {
    if (this.disabled) {
      return;
    }
    const el = this.editorRef?.nativeElement;
    if (el) {
      el.innerHTML = '';
    }
    this.onChange('');
  }

  correctWithAi(): void {
    const el = this.editorRef?.nativeElement;
    const html = el?.innerHTML ?? '';
    if (this.disabled || this.aiBusy || !html.trim() || !this.stripTags(html).trim()) {
      return;
    }
    this.aiBusy = true;
    this.aiError = '';
    this.ai
      .correctText(html)
      .pipe(finalize(() => (this.aiBusy = false)))
      .subscribe({
        next: ({ corrected }) => {
          if (el && corrected?.trim()) {
            el.innerHTML = corrected;
            this.onChange(corrected);
          }
        },
        error: (err: { error?: { message?: string } }) => {
          this.aiError = err.error?.message || 'Correction IA indisponible.';
        },
      });
  }

  private stripTags(html: string): string {
    return html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').trim();
  }
}
