import { Component, EventEmitter, Input, Output } from '@angular/core';
import { NgIf } from '@angular/common';

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [NgIf],
  templateUrl: './modal.html',
  styleUrl: './modal.css',
})
export class Modal {
  @Input() open: boolean = false;
  @Input() title: string = '';
  @Input() width: 'sm' | 'md' | 'lg' = 'md';
  @Output() closed = new EventEmitter<void>();

  close(): void { this.closed.emit(); }

  wClass(): string {
    switch (this.width) {
      case 'sm':
        return 'pc-modal-sm';
      case 'lg':
        return 'pc-modal-lg';
      default:
        return 'pc-modal-md';
    }
  }
}
