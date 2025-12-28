import { Component, inject } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [NgFor, NgIf],
  templateUrl: './toast-container.html',
  styleUrl: './toast-container.css',
})
export class ToastContainer {
  toast = inject(ToastService);

  cssFor(type: string): string {
    switch (type) {
      case 'success':
        return 'border-success';
      case 'warning':
        return 'border-warning';
      case 'danger':
        return 'border-danger';
      default:
        return 'border-info';
    }
  }
}
