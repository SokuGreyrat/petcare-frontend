import { Injectable, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { Usuario } from '../models/api.models';

const LS_KEY = 'petcare.session.v1';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _user = signal<Usuario | null>(null);
  user = this._user.asReadonly();
  isLoggedIn = computed(() => !!this._user());

  constructor(private api: ApiService, private router: Router) {
    this.hydrate();
  }

  private hydrate(): void {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Usuario;
      if (parsed && typeof parsed.id === 'number') {
        this._user.set(parsed);
      }
    } catch {
      // ignore
    }
  }

  private persist(u: Usuario | null): void {
    if (!u) {
      localStorage.removeItem(LS_KEY);
      return;
    }
    localStorage.setItem(LS_KEY, JSON.stringify(u));
  }

  async login(email: string, password: string): Promise<Usuario | null> {
    const users = await firstValueFrom(this.api.getUsers());
    const found = users.find((u) => (u.email || '').toLowerCase() === email.toLowerCase() && u.password === password);
    if (!found) return null;

    this._user.set(found);
    this.persist(found);
    return found;
  }

  logout(): void {
    this._user.set(null);
    this.persist(null);
    this.router.navigateByUrl('/login');
  }

  setUser(u: Usuario): void {
    this._user.set(u);
    this.persist(u);
  }

  requireUser(): Usuario {
    const u = this._user();
    if (!u) throw new Error('No hay sesión.');
    return u;
  }
}
