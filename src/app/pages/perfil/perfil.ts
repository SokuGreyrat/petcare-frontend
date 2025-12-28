import { Component, computed, inject, signal } from '@angular/core';
import { NgIf } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { Usuario } from '../../models/api.models';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [NgIf, ReactiveFormsModule],
  templateUrl: './perfil.html',
  styleUrl: './perfil.css',
})
export class Perfil {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);

  busy = signal(false);

  statsLoading = signal(false);
  stats = signal<{
    mascotas: number | null;
    posts: number | null;
    adopciones: number | null;
    solicitudes: number | null;
    gastoMes: number | null;
    budgetMes: number | null;
  }>({ mascotas: null, posts: null, adopciones: null, solicitudes: null, gastoMes: null, budgetMes: null });

  me = computed(() => this.auth.requireUser());

  form = new FormGroup({
    nombre: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    telefonoCelular: new FormControl('', { nonNullable: true }),
    curp: new FormControl('', { nonNullable: true }),
  });

  photoUrl = new FormControl('', { nonNullable: true });

  constructor() {
    const u = this.me();
    this.form.reset({
      nombre: u.nombre,
      email: u.email,
      telefonoCelular: u.telefonoCelular || '',
      curp: u.curp || '',
    });
    this.photoUrl.reset(u.fotoPerfil || '');

    this.loadStats();
  }

  initials(): string {
    const name = (this.me().nombre || '').trim();
    if (!name) return 'U';
    const parts = name.split(/\s+/).filter(Boolean);
    const first = parts[0]?.[0] || 'U';
    const second = (parts[1]?.[0] || parts[0]?.[1] || '').toString();
    return (first + second).toUpperCase();
  }

  loadStats(): void {
    const me = this.me();
    if (!me.id) return;

    this.statsLoading.set(true);

    forkJoin({
      mascotas: this.api.getMascotas(),
      posts: this.api.getPosts(),
      adopciones: this.api.getAdopciones(),
      solicitudes: this.api.getSolicitudesAdopcion(),
      gastos: this.api.getGastos(),
      presupuestos: this.api.getPresupuestos(),
    }).subscribe({
      next: (r) => {
        const monthKey = new Date().toISOString().slice(0, 7); // YYYY-MM

        const myMascotas = (r.mascotas || []).filter((m) => m.usuarioId === me.id);
        const myPosts = (r.posts || []).filter((p) => p.usuarioId === me.id);
        const myAdopciones = (r.adopciones || []).filter((a) => a.usuarioPublicadorId === me.id);
        const mySolicitudes = (r.solicitudes || []).filter((s) => s.solicitanteId === me.id);

        const myGastosMes = (r.gastos || []).filter((g) => g.usuarioId === me.id && (g.fecha || '').slice(0, 7) === monthKey);
        const gastoMes = myGastosMes.reduce((acc, g) => acc + (Number(g.monto) || 0), 0);

        const budget = (r.presupuestos || []).find((b) => b.usuarioId === me.id && (b.mes || '').slice(0, 7) === monthKey);
        const budgetMes = budget ? Number(budget.monto) || 0 : null;

        this.stats.set({
          mascotas: myMascotas.length,
          posts: myPosts.length,
          adopciones: myAdopciones.length,
          solicitudes: mySolicitudes.length,
          gastoMes,
          budgetMes,
        });
        this.statsLoading.set(false);
      },
      error: () => {
        this.stats.set({ mascotas: null, posts: null, adopciones: null, solicitudes: null, gastoMes: null, budgetMes: null });
        this.statsLoading.set(false);
      },
    });
  }

  budgetPct(): number {
    const budget = this.stats().budgetMes;
    const gasto = this.stats().gastoMes ?? 0;
    if (!budget || budget <= 0) return 0;
    return Math.max(0, Math.min(100, (gasto / budget) * 100));
  }

  budgetHint(): string {
    const budget = this.stats().budgetMes;
    const gasto = this.stats().gastoMes ?? 0;
    if (!budget) return '';
    const restante = budget - gasto;
    if (restante >= 0) return `Vas bien. Te quedan $${restante.toFixed(0)} este mes.`;
    return `Te pasaste por $${Math.abs(restante).toFixed(0)}. Ajusta tu presupuesto o reduce gastos.`;
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const current = this.me();
    if (!current.id) return;

    const body: Usuario = {
      id: current.id,
      nombre: this.form.value.nombre!,
      email: this.form.value.email!,
      password: current.password,
      telefonoCelular: this.form.value.telefonoCelular || undefined,
      curp: this.form.value.curp || undefined,
      fotoPerfil: current.fotoPerfil,
    };

    this.busy.set(true);
    this.api.updateUser(current.id, body).subscribe({
      next: (updated) => {
        this.auth.setUser({ ...current, ...updated });
        this.toast.show('Perfil actualizado.', 'success');
        this.busy.set(false);
      },
      error: () => {
        this.toast.show('No se pudo actualizar el perfil.', 'danger');
        this.busy.set(false);
      },
    });
  }

  savePhoto(): void {
    const current = this.me();
    if (!current.id) return;
    const url = this.photoUrl.value.trim();
    this.busy.set(true);
    this.api.updateUserPhoto(current.id, url).subscribe({
      next: () => {
        this.auth.setUser({ ...current, fotoPerfil: url });
        this.toast.show('Foto de perfil actualizada.', 'success');
        this.busy.set(false);
      },
      error: () => {
        this.toast.show('No se pudo actualizar la foto.', 'danger');
        this.busy.set(false);
      },
    });
  }
}
