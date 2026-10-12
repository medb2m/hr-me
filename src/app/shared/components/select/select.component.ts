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
import { LucideCheck, LucideChevronDown } from '@lucide/angular';

export interface SelectOption {
  value: string;
  label: string;
  /** Pastille couleur optionnelle devant le libellé. */
  color?: string;
}

/**
 * Select partagé Al Wassit — remplace le `<select>` natif.
 * `[(ngModel)]` : `<app-select [(ngModel)]="v" [options]="opts" />`.
 */
@Component({
  selector: 'app-select',
  imports: [CommonModule, LucideCheck, LucideChevronDown],
  templateUrl: './select.component.html',
  styleUrl: './select.component.css',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectComponent),
      multi: true,
    },
  ],
})
export class SelectComponent implements ControlValueAccessor, OnInit, OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>);

  @Input() options: SelectOption[] = [];
  @Input() placeholder = 'Sélectionner';

  value = '';
  disabled = false;
  open = false;
  popStyle: Record<string, string> = {};

  private onChange: (v: string) => void = () => {};
  private onTouched: () => void = () => {};

  private readonly scrollListener = (): void => {
    if (this.open) this.positionPop();
  };

  writeValue(v: string | null): void {
    this.value = v ?? '';
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

  get selected(): SelectOption | undefined {
    return this.options.find((o) => o.value === this.value);
  }

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
    if (this.open) this.positionPop();
    else this.onTouched();
  }

  pick(o: SelectOption): void {
    this.value = o.value;
    this.onChange(o.value);
    this.onTouched();
    this.close();
  }

  close(): void {
    if (this.open) {
      this.open = false;
      this.onTouched();
    }
  }

  private positionPop(): void {
    if (typeof window === 'undefined') return;
    const rect = this.host.nativeElement.getBoundingClientRect();
    const popH = Math.min(280, this.options.length * 38 + 16);
    const left = rect.left;
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const top =
      spaceBelow >= popH || spaceBelow >= spaceAbove
        ? rect.bottom + 6
        : Math.max(8, rect.top - popH - 6);
    this.popStyle = {
      position: 'fixed',
      left: `${Math.round(left)}px`,
      top: `${Math.round(top)}px`,
      width: `${Math.round(rect.width)}px`,
    };
  }
}
