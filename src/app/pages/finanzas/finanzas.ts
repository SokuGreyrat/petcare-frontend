import { Component, computed, inject, signal } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { Gasto, Mascota, Presupuesto } from '../../models/api.models';
import { Modal } from '../../components/modal/modal';
import { formatFriendlyDate, toLocalDateString, toMonthString } from '../../utils/date';

@Component({
  selector: 'app-finanzas',
  standalone: true,
  imports: [NgFor, NgIf, ReactiveFormsModule, Modal],
  templateUrl: './finanzas.html',
  styleUrl: './finanzas.css',
})
export class Finanzas {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);

  month = signal(toMonthString());
  showGasto = signal(false);
  showBudget = signal(false);

  gastos = signal<Gasto[]>([]);
  presupuestos = signal<Presupuesto[]>([]);
  mascotas = signal<Mascota[]>([]);

  me = computed(() => this.auth.requireUser());
  myMascotas = computed(() => this.mascotas().filter((m) => m.usuarioId === this.me().id));
  myGastos = computed(() => this.gastos().filter((g) => g.usuarioId === this.me().id));

  gastosMes = computed(() => {
    const m = this.month();
    return this.myGastos().filter((g) => {
      const f = (g.fecha || g.fechaCreacion || '').toString();
      return f.startsWith(m);
    });
  });

  totalMes = computed(() => this.gastosMes().reduce((acc, g) => acc + (Number(g.monto) || 0), 0));

  budgetMes = computed(() => {
    const m = this.month();
    return this.presupuestos().find((p) => p.usuarioId === this.me().id && p.mes === m) || null;
  });

  restante = computed(() => {
    const b = Number(this.budgetMes()?.monto) || 0;
    return b - this.totalMes();
  });

  byCategoria = computed(() => {
    const map: Record<string, number> = {};
    for (const g of this.gastosMes()) {
      const k = (g.categoria || 'Sin categoría').trim();
      map[k] = (map[k] || 0) + (Number(g.monto) || 0);
    }
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([categoria, monto]) => ({ categoria, monto }));
  });

  gastoForm = new FormGroup({
    categoria: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    monto: new FormControl<number | null>(null, { validators: [Validators.required] }),
    proveedor: new FormControl('', { nonNullable: true }),
    mascotaId: new FormControl<number | null>(null),
    fecha: new FormControl(toLocalDateString(), { nonNullable: true }),
    fechaRecordatorio: new FormControl('', { nonNullable: true }),
  });

  budgetForm = new FormGroup({
    mes: new FormControl(this.month(), { nonNullable: true, validators: [Validators.required] }),
    monto: new FormControl<number | null>(null, { validators: [Validators.required] }),
  });

  constructor() {
    this.reload();
  }

  reload(): void {
    this.api.getGastos().subscribe({ next: (v) => this.gastos.set(v || []) });
    this.api.getPresupuestos().subscribe({ next: (v) => this.presupuestos.set(v || []) });
    this.api.getMascotas().subscribe({ next: (v) => this.mascotas.set(v || []) });
  }

  mascotaLabel(id?: number | null): string {
    if (!id) return '—';
    const m = this.myMascotas().find((x) => x.id === id);
    return m?.nombre || ('#' + id);
  }


  format(d?: string): string {
    return formatFriendlyDate(d);
  }

  openGasto(): void {
    this.gastoForm.reset({
      categoria: '',
      monto: null,
      proveedor: '',
      mascotaId: null,
      fecha: toLocalDateString(),
      fechaRecordatorio: '',
    });
    this.showGasto.set(true);
  }

  createGasto(): void {
    if (this.gastoForm.invalid) {
      this.gastoForm.markAllAsTouched();
      return;
    }
    const raw = this.gastoForm.getRawValue();
    const body: Gasto = {
      usuarioId: this.me().id!,
      categoria: raw.categoria!,
      monto: Number(raw.monto),
      proveedor: raw.proveedor || undefined,
      mascotaId: raw.mascotaId || undefined,
      fecha: raw.fecha || toLocalDateString(),
      fechaRecordatorio: raw.fechaRecordatorio || undefined,
    };
    this.api.createGasto(body).subscribe({
      next: (created) => {
        this.gastos.update((arr) => [...arr, created]);
        this.toast.show('Gasto registrado.', 'success');
        this.showGasto.set(false);
      },
      error: () => this.toast.show('No se pudo registrar el gasto.', 'danger'),
    });
  }

  deleteGasto(g: Gasto): void {
    if (!g.id) return;
    if (!confirm('¿Eliminar este gasto?')) return;
    this.api.deleteGasto(g.id).subscribe({
      next: () => {
        this.gastos.update((arr) => arr.filter((x) => x.id !== g.id));
        this.toast.show('Gasto eliminado.', 'info');
      },
      error: () => this.toast.show('No se pudo eliminar.', 'danger'),
    });
  }

  openBudget(): void {
    const current = this.budgetMes();
    this.budgetForm.reset({
      mes: this.month(),
      monto: (current?.monto as any) || null,
    });
    this.showBudget.set(true);
  }

  saveBudget(): void {
    if (this.budgetForm.invalid) {
      this.budgetForm.markAllAsTouched();
      return;
    }
    const mes = this.budgetForm.value.mes!;
    const monto = Number(this.budgetForm.value.monto);
    const current = this.presupuestos().find((p) => p.usuarioId === this.me().id && p.mes === mes);
    const body: Presupuesto = {
      usuarioId: this.me().id!,
      mes,
      monto,
    };

    if (current?.id) {
      this.api.updatePresupuesto(current.id, body).subscribe({
        next: (updated) => {
          this.presupuestos.update((arr) => arr.map((x) => (x.id === updated.id ? updated : x)));
          this.toast.show('Presupuesto actualizado.', 'success');
          this.showBudget.set(false);
        },
        error: () => this.toast.show('No se pudo actualizar.', 'danger'),
      });
      return;
    }

    this.api.createPresupuesto(body).subscribe({
      next: (created) => {
        this.presupuestos.update((arr) => [...arr, created]);
        this.toast.show('Presupuesto guardado.', 'success');
        this.showBudget.set(false);
      },
      error: () => this.toast.show('No se pudo guardar.', 'danger'),
    });
  }
}
