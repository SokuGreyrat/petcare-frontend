import { Injectable, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { Usuario } from '../models/api.models';

const LS_KEY = 'petcare.session.v1';
const LS_KEY2 = 'userId';

const LS_LOGIN_AT = 'petcare.loginAt';
const SESSION_MAX_MIN = 30;

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
      const loginAt = localStorage.getItem(LS_LOGIN_AT);
      if (!raw || !loginAt) return;

    const elapsedMin = (Date.now() - Number(loginAt)) / 60000;
    if (elapsedMin > SESSION_MAX_MIN) {
      this.logout();
      return;
    }

    this._user.set(JSON.parse(raw));
  } catch {
    this.logout();
  }
  }

  private persist(u: Usuario | null): void {
    if (!u) {
      localStorage.removeItem(LS_KEY);
      localStorage.removeItem(LS_KEY2);
      return;
    }
    localStorage.setItem(LS_KEY, JSON.stringify(u));
    localStorage.setItem(LS_LOGIN_AT, Date.now().toString());
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
