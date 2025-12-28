import { Injectable, signal } from '@angular/core';

export type ToastType = 'info' | 'success' | 'warning' | 'danger';

export interface Toast {
  id: number;
  title?: string;
  message: string;
  type: ToastType;
  timeoutMs?: number;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private _toasts = signal<Toast[]>([]);
  toasts = this._toasts.asReadonly();
  private seq = 1;

  show(message: string, type: ToastType = 'info', title?: string, timeoutMs: number = 3500): void {
    const toast: Toast = { id: this.seq++, title, message, type, timeoutMs };
    this._toasts.update((arr) => [toast, ...arr].slice(0, 5));
    if (timeoutMs && timeoutMs > 0) {
      setTimeout(() => this.dismiss(toast.id), timeoutMs);
    }
  }

  dismiss(id: number): void {
    this._toasts.update((arr) => arr.filter((t) => t.id !== id));
  }

  clear(): void {
    this._toasts.set([]);
  }
}
