import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  HostListener,
  Input,
  forwardRef,
  inject,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { LucideCalendar, LucideChevronLeft, LucideChevronRight, LucideX } from '@lucide/angular';

const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];
const WEEKDAYS_FR = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'];

interface DayCell {
  /** YYYY-MM-DD ; '' pour les cases vides du padding. */
  iso: string;
  label: number | null;
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  disabled: boolean;
}

function toIso(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function parseIso(v: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim());
  if (!m) return null;
  return { y: +m[1], m: +m[2] - 1, d: +m[3] };
}

function todayIso(): string {
  const n = new Date();
  return toIso(n.getFullYear(), n.getMonth(), n.getDate());
}

/**
 * Date picker partagé Al Wassit — valeur `YYYY-MM-DD` (ou '' quand vidé).
 * Utilisable partout via `[(ngModel)]` : `<app-date-picker [(ngModel)]="iso" />`.
 * Inputs : `placeholder`, `min`, `max` (YYYY-MM-DD), `clearable` (défaut true).
 */
@Component({
  selector: 'app-date-picker',
  imports: [CommonModule, LucideCalendar, LucideChevronLeft, LucideChevronRight, LucideX],
  templateUrl: './date-picker.component.html',
  styleUrl: './date-picker.component.css',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DatePickerComponent),
      multi: true,
    },
  ],
})
export class DatePickerComponent implements ControlValueAccessor {
  private readonly host = inject(ElementRef<HTMLElement>);

  @Input() placeholder = 'Choisir une date';
  @Input() min = '';
  @Input() max = '';
  @Input() clearable = true;

  readonly months = MONTHS_FR;
  readonly weekdays = WEEKDAYS_FR;

  /** Valeur modèle 'YYYY-MM-DD' ou ''. */
  value = '';
  disabled = false;
  open = false;

  /** Mois/année affichés dans le calendrier. */
  viewYear = new Date().getFullYear();
  viewMonth = new Date().getMonth();

  /** Mode sélection d'année (grille rapide). */
  yearPicker = false;
  yearRangeStart = this.viewYear - 6;

  private onChange: (v: string) => void = () => {};
  private onTouched: () => void = () => {};

  // ---------- ControlValueAccessor ----------

  writeValue(v: string | null): void {
    this.value = v ?? '';
    const p = this.value ? parseIso(this.value) : null;
    if (p) {
      this.viewYear = p.y;
      this.viewMonth = p.m;
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
    if (disabled) this.open = false;
  }

  // ---------- popup ----------

  @HostListener('document:click', ['$event'])
  onDocClick(ev: Event): void {
    if (this.open && !this.host.nativeElement.contains(ev.target as Node)) {
      this.close();
    }
  }

  @HostListener('keydown.escape')
  onEscape(): void {
    this.close();
  }

  toggle(): void {
    if (this.disabled) return;
    this.open = !this.open;
    if (this.open) {
      const p = this.value ? parseIso(this.value) : null;
      if (p) {
        this.viewYear = p.y;
        this.viewMonth = p.m;
      }
      this.yearPicker = false;
      this.yearRangeStart = this.viewYear - 6;
    } else {
      this.onTouched();
    }
  }

  close(): void {
    if (this.open) {
      this.open = false;
      this.onTouched();
    }
  }

  // ---------- navigation ----------

  prevMonth(): void {
    if (this.viewMonth === 0) {
      this.viewMonth = 11;
      this.viewYear--;
    } else {
      this.viewMonth--;
    }
  }

  nextMonth(): void {
    if (this.viewMonth === 11) {
      this.viewMonth = 0;
      this.viewYear++;
    } else {
      this.viewMonth++;
    }
  }

  toggleYearPicker(): void {
    this.yearPicker = !this.yearPicker;
    this.yearRangeStart = this.viewYear - 6;
  }

  pickYear(y: number): void {
    this.viewYear = y;
    this.yearPicker = false;
  }

  prevYears(): void {
    this.yearRangeStart -= 12;
  }

  nextYears(): void {
    this.yearRangeStart += 12;
  }

  get yearGrid(): number[] {
    return Array.from({ length: 12 }, (_, i) => this.yearRangeStart + i);
  }

  // ---------- grille ----------

  get grid(): DayCell[] {
    const cells: DayCell[] = [];
    const first = new Date(this.viewYear, this.viewMonth, 1);
    // Lundi = 0 : getDay() 0=dim → on décale.
    const offset = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(this.viewYear, this.viewMonth + 1, 0).getDate();
    const today = todayIso();

    for (let i = 0; i < offset; i++) {
      cells.push({ iso: '', label: null, inMonth: false, isToday: false, isSelected: false, disabled: true });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = toIso(this.viewYear, this.viewMonth, d);
      cells.push({
        iso,
        label: d,
        inMonth: true,
        isToday: iso === today,
        isSelected: iso === this.value,
        disabled: (this.min !== '' && iso < this.min) || (this.max !== '' && iso > this.max),
      });
    }
    return cells;
  }

  trackCell(_i: number, c: DayCell): string {
    return c.iso || `pad-${_i}`;
  }

  pick(cell: DayCell): void {
    if (!cell.inMonth || cell.disabled || !cell.iso) return;
    this.value = cell.iso;
    this.onChange(this.value);
    this.onTouched();
    this.close();
  }

  pickToday(): void {
    const t = todayIso();
    if ((this.min && t < this.min) || (this.max && t > this.max)) return;
    this.value = t;
    this.onChange(t);
    this.onTouched();
    const p = parseIso(t);
    if (p) {
      this.viewYear = p.y;
      this.viewMonth = p.m;
    }
    this.close();
  }

  clear(): void {
    this.value = '';
    this.onChange('');
    this.onTouched();
    this.close();
  }

  // ---------- affichage ----------

  get displayValue(): string {
    const p = this.value ? parseIso(this.value) : null;
    if (!p) return '';
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(p.y, p.m, p.d));
  }

  get viewLabel(): string {
    return `${MONTHS_FR[this.viewMonth]} ${this.viewYear}`;
  }
}
