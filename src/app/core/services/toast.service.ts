import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: number;
  type: ToastType;
  title: string;
  message?: string;
  action?: ToastAction;
}

let nextId = 1;

/**
 * Notifications toast globales — survivent à la navigation car le conteneur
 * vit au niveau AppComponent. Usage : `toast.success('Titre', 'Message')`.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);

  success(title: string, message?: string, opts: { action?: ToastAction } = {}): void {
    this.push({ type: 'success', title, message, action: opts.action });
  }

  error(title: string, message?: string, opts: { action?: ToastAction } = {}): void {
    this.push({ type: 'error', title, message, action: opts.action });
  }

  info(title: string, message?: string, opts: { action?: ToastAction } = {}): void {
    this.push({ type: 'info', title, message, action: opts.action });
  }

  warning(title: string, message?: string, opts: { action?: ToastAction } = {}): void {
    this.push({ type: 'warning', title, message, action: opts.action });
  }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }

  private push(t: Omit<Toast, 'id'>): void {
    const id = nextId++;
    this.toasts.update((list) => [...list, { ...t, id }]);
    setTimeout(() => this.dismiss(id), 7000);
  }
}
