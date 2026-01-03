import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { catchError, of } from 'rxjs';

type MascotaUI = {
  idMascota: number;
  nombre: string;
  usuarioId: number;
};

type Presupuesto = {
  id: number;
  usuarioId: number;
  mes: string;
  monto: number;
};

type Gasto = {
  id: number;
  usuarioId: number;
  mascotaId?: number;
  categoria: string;
  monto: number;
  fecha: any;
  proveedor?: string;
};

type GastoUI = {
  idGasto: number;
  categoria: string;
  monto: number;
  descripcion?: string;
};

@Component({
  selector: 'app-finanzas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './finanzas.html',
  styleUrls: ['./finanzas.css'],
})
export class Finanzas implements OnInit {
  private http = inject(HttpClient);

  // UI
  toastVisible = false;
  toastMsg = '';
  toastType: 'ok' | 'err' = 'ok';

  loading = false;
  loadingMascotas = false;

  // Modales
  modalPresupuesto = false;
  modalGasto = false;

  // Contexto
  meses = [
    { num: 1, nombre: 'Enero' },
    { num: 2, nombre: 'Febrero' },
    { num: 3, nombre: 'Marzo' },
    { num: 4, nombre: 'Abril' },
    { num: 5, nombre: 'Mayo' },
    { num: 6, nombre: 'Junio' },
    { num: 7, nombre: 'Julio' },
    { num: 8, nombre: 'Agosto' },
    { num: 9, nombre: 'Septiembre' },
    { num: 10, nombre: 'Octubre' },
    { num: 11, nombre: 'Noviembre' },
    { num: 12, nombre: 'Diciembre' },
  ];

  anios: number[] = [];
  mesSeleccionado = new Date().getMonth() + 1;
  anioSeleccionado = new Date().getFullYear();

  // Mascotas
  mascotas: MascotaUI[] = [];
  mascotaSeleccionadaId: number | null = null;

  // Datos
  presupuestoMonto: number | null = null;
  private presupuestoId: number | null = null;

  gastos: GastoUI[] = [];
  totalGastos = 0;
  restante = 0;

  // Forms
  formPresupuesto: { monto: number | null } = { monto: null };
  formGasto: { monto: number | null; categoria: string; descripcion: string } = {
    monto: null,
    categoria: 'Alimento',
    descripcion: '',
  };

  ngOnInit(): void {
    const a = new Date().getFullYear();
    this.anios = [a - 1, a, a + 1];

    this.cargarMascotasDelUsuario();
  }

  // -----------------------
  // Helpers
  // -----------------------
  private showToast(msg: string, type: 'ok' | 'err' = 'ok') {
    this.toastMsg = msg;
    this.toastType = type;
    this.toastVisible = true;
    setTimeout(() => (this.toastVisible = false), 2500);
  }

  private errorMsg(err: any): string {
    const e = err as HttpErrorResponse;
    if (e?.error) {
      if (typeof e.error === 'string') return e.error;
      if (e.error?.message) return e.error.message;
      if (e.error?.error) return e.error.error;
    }
    return 'Ocurrió un error. Revisa backend.';
  }

  private authHeaders(): HttpHeaders {
    let headers = new HttpHeaders({ 'Content-Type': 'application/json' });

    const token =
      localStorage.getItem('token') ||
      localStorage.getItem('access_token') ||
      localStorage.getItem('jwt');

    if (token) {
      headers = headers.set(
        'Authorization',
        token.startsWith('Bearer ') ? token : `Bearer ${token}`
      );
    }
    return headers;
  }

  private getUserIdOrNull(): number | null {
    const directKeys = ['idUsuario', 'userId', 'id_user', 'usuarioId'];
    for (const k of directKeys) {
      const v = localStorage.getItem(k);
      if (v && !isNaN(Number(v))) return Number(v);
    }

    const objKeys = ['user', 'usuario', 'currentUser', 'authUser'];
    for (const k of objKeys) {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      try {
        const o = JSON.parse(raw);
        const id = o?.idUsuario ?? o?.userId ?? o?.id ?? o?.id_user;
        if (id && !isNaN(Number(id))) return Number(id);
      } catch {}
    }
    return null;
  }

  nombreMes(mes: number): string {
    return this.meses.find((m) => m.num === Number(mes))?.nombre ?? 'Enero';
  }

  private toDate(x: any): Date | null {
    if (!x) return null;
    const d = new Date(x);
    return isNaN(d.getTime()) ? null : d;
  }

  private recalcular() {
    this.totalGastos = this.gastos.reduce((acc, g) => acc + (Number(g.monto) || 0), 0);
    const presupuesto = Number(this.presupuestoMonto) || 0;
    this.restante = presupuesto - this.totalGastos;
  }

  // -----------------------
  // ✅ Mascotas: SIN tocar backend
  // -----------------------
  private cargarMascotasDelUsuario() {
    const usuarioId = this.getUserIdOrNull();
    if (!usuarioId) {
      this.showToast('No encontré idUsuario en localStorage. Inicia sesión otra vez.', 'err');
      this.mascotas = [];
      return;
    }

    this.loadingMascotas = true;

    this.http
      .get<any[]>('/api/petcare/allmascotas', { headers: this.authHeaders() })
      .pipe(catchError(() => of([] as any[])))
      .subscribe((resp) => {
        const lista = Array.isArray(resp) ? resp : [];

        const normalizadas: MascotaUI[] = lista
          .map((x: any) => ({
            idMascota: Number(x?.id ?? x?.idMascota ?? x?.id_mascota),
            nombre: String(x?.nombre ?? 'Mascota'),
            usuarioId: Number(x?.usuarioId ?? x?.idUsuario ?? x?.userId ?? x?.user_id),
          }))
          .filter((m: MascotaUI) => !!m.idMascota && !isNaN(m.idMascota));

        this.mascotas = normalizadas.filter((m) => Number(m.usuarioId) === Number(usuarioId));

        if (!this.mascotaSeleccionadaId && this.mascotas.length > 0) {
          this.mascotaSeleccionadaId = this.mascotas[0].idMascota;
        }

        this.loadingMascotas = false;

        if (this.mascotas.length === 0) {
          this.showToast(
            'No me salió ninguna mascota para este usuario. Revisa que usuarioId esté bien en la BD.',
            'err'
          );
          return;
        }

        this.onContextChange();
      });
  }

  // -----------------------
  // Presupuesto + gastos
  // -----------------------
  onContextChange() {
    const usuarioId = this.getUserIdOrNull();
    if (!usuarioId) return;

    const mesNombre = this.nombreMes(this.mesSeleccionado);
    const anio = Number(this.anioSeleccionado);
    const mesNum = Number(this.mesSeleccionado);
    const mascotaId = this.mascotaSeleccionadaId ? Number(this.mascotaSeleccionadaId) : null;

    // presupuesto por usuario + mes (sin año en backend)
    this.http
      .get<Presupuesto[]>('/api/petcare/allpresupuestos', { headers: this.authHeaders() })
      .pipe(catchError(() => of([] as Presupuesto[])))
      .subscribe((pres) => {
        const p = (pres ?? []).find(
          (x) => Number(x.usuarioId) === Number(usuarioId) && String(x.mes) === mesNombre
        );

        this.presupuestoMonto = p?.monto ?? null;
        this.presupuestoId = p?.id ?? null;

        // gastos por usuario + mes/año (por fecha) + mascotaId
        this.http
          .get<Gasto[]>('/api/petcare/allgastos', { headers: this.authHeaders() })
          .pipe(catchError(() => of([] as Gasto[])))
          .subscribe((gas) => {
            const filtrados = (gas ?? []).filter((g) => {
              if (Number(g.usuarioId) !== Number(usuarioId)) return false;
              if (mascotaId && Number(g.mascotaId) !== mascotaId) return false;

              const d = this.toDate(g.fecha);
              if (!d) return false;

              return d.getMonth() + 1 === mesNum && d.getFullYear() === anio;
            });

            filtrados.sort((a, b) => {
              const da = this.toDate(a.fecha)?.getTime() ?? 0;
              const db = this.toDate(b.fecha)?.getTime() ?? 0;
              return db - da;
            });

            this.gastos = filtrados.map((g) => ({
              idGasto: Number(g.id),
              categoria: String(g.categoria),
              monto: Number(g.monto),
              descripcion: g.proveedor ? String(g.proveedor) : '',
            }));

            this.recalcular();
          });
      });
  }

  // -----------------------
  // ✅ MODALES (lo que te faltaba)
  // -----------------------
  abrirModalPresupuesto() {
    if (!this.mascotaSeleccionadaId) {
      this.showToast('Selecciona una mascota primero.', 'err');
      return;
    }
    this.formPresupuesto = { monto: this.presupuestoMonto };
    this.modalPresupuesto = true;
    this.modalGasto = false;
  }

  abrirModalGasto() {
    if (!this.mascotaSeleccionadaId) {
      this.showToast('Selecciona una mascota primero.', 'err');
      return;
    }
    this.formGasto = { monto: null, categoria: 'Alimento', descripcion: '' };
    this.modalGasto = true;
    this.modalPresupuesto = false;
  }

  cerrarModales() {
    this.modalPresupuesto = false;
    this.modalGasto = false;
  }

  // -----------------------
  // Guardar presupuesto
  // -----------------------
  guardarPresupuesto() {
    const usuarioId = this.getUserIdOrNull();
    if (!usuarioId) return;

    const monto = Number(this.formPresupuesto.monto);
    if (!monto || monto <= 0) {
      this.showToast('Pon un monto válido.', 'err');
      return;
    }

    const payload = {
      usuarioId,
      mes: this.nombreMes(Number(this.mesSeleccionado)),
      monto,
    };

    this.loading = true;

    if (this.presupuestoId) {
      this.http
        .put(`/api/petcare/update-presupuesto/${this.presupuestoId}`, payload, {
          headers: this.authHeaders(),
        })
        .subscribe({
          next: () => {
            this.loading = false;
            this.cerrarModales();
            this.showToast('Presupuesto actualizado ✅', 'ok');
            this.onContextChange();
          },
          error: (err) => {
            this.loading = false;
            this.showToast(this.errorMsg(err), 'err');
          },
        });
      return;
    }

    this.http
      .post('/api/petcare/create-presupuesto', payload, { headers: this.authHeaders() })
      .subscribe({
        next: () => {
          this.loading = false;
          this.cerrarModales();
          this.showToast('Presupuesto guardado ✅', 'ok');
          this.onContextChange();
        },
        error: (err) => {
          this.loading = false;
          this.showToast(this.errorMsg(err), 'err');
        },
      });
  }

  // -----------------------
  // Guardar gasto
  // -----------------------
  guardarGasto() {
    const usuarioId = this.getUserIdOrNull();
    if (!usuarioId) return;

    if (!this.mascotaSeleccionadaId) {
      this.showToast('Selecciona una mascota.', 'err');
      return;
    }

    const monto = Number(this.formGasto.monto);
    if (!monto || monto <= 0) {
      this.showToast('Pon un monto válido.', 'err');
      return;
    }

    const mes = Number(this.mesSeleccionado);
    const anio = Number(this.anioSeleccionado);

    // fecha dentro del mes seleccionado para que aparezca en el filtro
    const fecha = new Date(anio, mes - 1, 1, 12, 0, 0);

    const payload = {
      usuarioId,
      mascotaId: Number(this.mascotaSeleccionadaId),
      categoria: this.formGasto.categoria,
      monto,
      fecha,
      proveedor: (this.formGasto.descripcion || '').trim() || null,
    };

    this.loading = true;

    this.http
      .post('/api/petcare/create-gasto', payload, { headers: this.authHeaders() })
      .subscribe({
        next: () => {
          this.loading = false;
          this.cerrarModales();
          this.showToast('Gasto guardado ✅', 'ok');
          this.onContextChange();
        },
        error: (err) => {
          this.loading = false;
          this.showToast(this.errorMsg(err), 'err');
        },
      });
  }
}

// ✅ Alias para evitar errores de routes si importan FinanzasComponent
export { Finanzas as FinanzasComponent };
