import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
  forwardRef,
  inject,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { LucideChevronDown, LucideClock, LucideX } from '@lucide/angular';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function normalize(v: string): string | null {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(v);
  return m ? `${pad(+m[1])}:${m[2]}` : null;
}

/**
 * Time picker partagé Al Wassit — valeur `HH:mm` (ou '' quand vidé).
 * `[(ngModel)]` : `<app-time-picker [(ngModel)]="heure" />`.
 * Saisie directe au clavier (« 930 », « 9:30 ») ou molette style iPhone.
 */
@Component({
  selector: 'app-time-picker',
  imports: [CommonModule, LucideChevronDown, LucideClock, LucideX],
  templateUrl: './time-picker.component.html',
  styleUrl: './time-picker.component.css',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TimePickerComponent),
      multi: true,
    },
  ],
})
export class TimePickerComponent implements ControlValueAccessor, OnInit, OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>);

  @Input() placeholder = 'HH:mm';
  @Input() clearable = true;

  readonly hours = Array.from({ length: 24 }, (_, i) => i);
  readonly minutes = Array.from({ length: 60 }, (_, i) => i);

  value = '';
  /** Texte brut du champ pendant la frappe. */
  text = '';
  disabled = false;
  open = false;
  popStyle: Record<string, string> = {};

  private onChange: (v: string) => void = () => {};
  private onTouched: () => void = () => {};

  private readonly scrollListener = (): void => {
    if (this.open) this.positionPop();
  };

  // ---------- ControlValueAccessor ----------

  writeValue(v: string | null): void {
    this.value = normalize(v ?? '') ?? '';
    this.text = this.value;
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

  // ---------- saisie clavier ----------

  /** Garde uniquement chiffres + ':', max 5 caractères. */
  onTextInput(ev: Event): void {
    const el = ev.target as HTMLInputElement;
    el.value = el.value.replace(/[^\d:]/g, '').slice(0, 5);
    this.text = el.value;
    // Complétion automatique : « 0930 » → « 09:30 », « 9:5 » reste en frappe
    const compact = this.text.replace(':', '');
    if (compact.length === 4) {
      const candidate = `${compact.slice(0, 2)}:${compact.slice(2)}`;
      const ok = normalize(candidate);
      if (ok) {
        this.set(ok);
        el.value = ok;
        this.text = ok;
      }
    }
  }

  /** Blur / Entrée : interprète « 9 », « 930 », « 9:30 », « 09:30 ». */
  commitText(): void {
    const t = this.text.trim();
    if (t === '') {
      this.set('');
      this.text = '';
      this.onTouched();
      return;
    }
    let ok = normalize(t);
    if (!ok) {
      const compact = t.replace(':', '');
      if (/^\d{1,2}$/.test(compact)) {
        ok = normalize(`${compact}:00`);
      } else if (/^\d{3}$/.test(compact)) {
        ok = normalize(`0${compact[0]}:${compact.slice(1)}`) ?? normalize(`${compact.slice(0, 1)}:${compact.slice(1)}`);
      } else if (/^\d{4}$/.test(compact)) {
        ok = normalize(`${compact.slice(0, 2)}:${compact.slice(2)}`);
      } else {
        const mm = /^(\d{1,2}):(\d{1,2})$/.exec(t);
        if (mm) ok = normalize(`${mm[1]}:${mm[2].padStart(2, '0')}`);
      }
    }
    if (ok) {
      this.set(ok);
      this.text = ok;
    } else {
      this.text = this.value; // frappe invalide → on revient à la dernière valeur
    }
    this.onTouched();
  }

  onTextKeydown(ev: KeyboardEvent): void {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      this.commitText();
      this.close();
    }
  }

  // ---------- molette ----------

  get selHour(): number | null {
    const ok = normalize(this.value);
    return ok ? +ok.slice(0, 2) : null;
  }

  get selMinute(): number | null {
    const ok = normalize(this.value);
    return ok ? +ok.slice(3) : null;
  }

  pickHour(h: number): void {
    this.set(`${pad(h)}:${pad(this.selMinute ?? 0)}`);
  }

  pickMinute(m: number): void {
    this.set(`${pad(this.selHour ?? 9)}:${pad(m)}`);
  }

  pickNow(): void {
    const n = new Date();
    this.set(`${pad(n.getHours())}:${pad(n.getMinutes())}`);
    this.close();
  }

  clear(): void {
    this.set('');
    this.close();
  }

  done(): void {
    this.close();
  }

  private set(v: string): void {
    this.value = v;
    this.text = v;
    this.onChange(v);
    this.onTouched();
  }

  // ---------- popup ----------

  @HostListener('document:click', ['$event'])
  onDocClick(ev: Event): void {
    if (!this.open) return;
    const path = typeof ev.composedPath === 'function' ? ev.composedPath() : [];
    const inside =
      path.includes(this.host.nativeElement) ||
      this.host.nativeElement.contains(ev.target as Node);
    if (!inside) this.close();
  }

  @HostListener('keydown.escape')
  onEscape(): void {
    this.close();
  }

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('scroll', this.scrollListener, { capture: true });
      window.addEventListener('resize', this.scrollListener);
    }
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('scroll', this.scrollListener, { capture: true } as EventListenerOptions);
      window.removeEventListener('resize', this.scrollListener);
    }
  }

  toggle(): void {
    if (this.disabled) return;
    this.open = !this.open;
    if (this.open) {
      this.positionPop();
      // scroll des molettes sur la valeur courante après le rendu
      setTimeout(() => this.scrollToSelected(), 0);
    } else {
      this.onTouched();
    }
  }

  private scrollToSelected(): void {
    const root: HTMLElement = this.host.nativeElement;
    const ITEM_H = 34;
    const cols = root.querySelectorAll('.tp-col-scroll');
    const h = this.selHour ?? 9;
    const m = this.selMinute ?? 0;
    if (cols[0]) cols[0].scrollTop = h * ITEM_H - ITEM_H * 2;
    if (cols[1]) cols[1].scrollTop = m * ITEM_H - ITEM_H * 2;
  }

  private positionPop(): void {
    if (typeof window === 'undefined') return;
    const rect = this.host.nativeElement.getBoundingClientRect();
    const popW = Math.min(260, window.innerWidth - 16);
    const popH = 280;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - popW - 8));
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const top =
      spaceBelow >= popH || spaceBelow >= spaceAbove
        ? rect.bottom + 8
        : Math.max(8, rect.top - popH - 8);
    this.popStyle = {
      position: 'fixed',
      left: `${Math.round(left)}px`,
      top: `${Math.round(top)}px`,
      width: `${Math.round(popW)}px`,
    };
  }

  close(): void {
    if (this.open) {
      this.open = false;
      this.onTouched();
    }
  }
}
