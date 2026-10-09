import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { LucideCheckCircle2, LucideInfo, LucideOctagonAlert, LucideTriangleAlert, LucideX } from '@lucide/angular';
import { Toast, ToastService } from '../../../core/services/toast.service';

/** Conteneur global de toasts — monté une fois dans AppComponent. */
@Component({
  selector: 'app-toast-container',
  imports: [CommonModule, LucideCheckCircle2, LucideInfo, LucideOctagonAlert, LucideTriangleAlert, LucideX],
  template: `
    <div class="toast-region" role="region" aria-live="polite" aria-label="Notifications">
      <div
        *ngFor="let t of toast.toasts()"
        class="toast"
        [attr.data-type]="t.type"
        role="alert"
      >
        <span class="toast-icon" aria-hidden="true">
          <svg *ngIf="t.type === 'success'" lucideCheckCircle2 [size]="20"></svg>
          <svg *ngIf="t.type === 'error'" lucideOctagonAlert [size]="20"></svg>
          <svg *ngIf="t.type === 'warning'" lucideTriangleAlert [size]="20"></svg>
          <svg *ngIf="t.type === 'info'" lucideInfo [size]="20"></svg>
        </span>
        <div class="toast-body">
          <p class="toast-title">{{ t.title }}</p>
          <p class="toast-msg" *ngIf="t.message">{{ t.message }}</p>
          <button
            *ngIf="t.action"
            type="button"
            class="toast-action"
            (click)="run(t)"
          >
            {{ t.action!.label }}
          </button>
        </div>
        <button
          type="button"
          class="toast-close"
          (click)="toast.dismiss(t.id)"
          aria-label="Fermer la notification"
        >
          <svg lucideX [size]="14"></svg>
        </button>
      </div>
    </div>
  `,
  styleUrl: './toast.component.css',
})
export class ToastComponent {
  readonly toast = inject(ToastService);

  run(t: Toast): void {
    t.action?.onClick();
    this.toast.dismiss(t.id);
  }
}
