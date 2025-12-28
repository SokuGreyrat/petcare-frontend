import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NgIf } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { safeAvatarLetter } from '../../utils/random';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NgIf],
  templateUrl: './shell.html',
  styleUrl: './shell.css',
})
export class Shell {
  auth = inject(AuthService);
  collapsed = signal(true);
  user = computed(() => this.auth.user());
  avatar = computed(() => safeAvatarLetter(this.auth.user()?.nombre));

  toggleNav(): void {
    this.collapsed.update((v) => !v);
  }

  closeNav(): void {
    this.collapsed.set(true);
  }
}
