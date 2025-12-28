import { Component, computed, inject, signal } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { Adopcion, Mascota, SolicitudAdopcion, Usuario } from '../../models/api.models';
import { Modal } from '../../components/modal/modal';
import { formatFriendlyDate, toLocalDateString } from '../../utils/date';

@Component({
  selector: 'app-adopciones',
  standalone: true,
  imports: [NgFor, NgIf, ReactiveFormsModule, Modal],
  templateUrl: './adopciones.html',
  styleUrl: './adopciones.css',
})
export class Adopciones {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);

  tab = signal<'explorar' | 'misPublicaciones' | 'misSolicitudes'>('explorar');
  busy = signal(false);
  showPublish = signal(false);
  showRequest = signal(false);
  requestTarget = signal<Adopcion | null>(null);

  adopciones = signal<Adopcion[]>([]);
  solicitudes = signal<SolicitudAdopcion[]>([]);
  mascotas = signal<Mascota[]>([]);
  usuarios = signal<Usuario[]>([]);

  me = computed(() => this.auth.requireUser());
  myPets = computed(() => this.mascotas().filter((m) => m.usuarioId === this.me().id));

  available = computed(() => this.adopciones().filter((a) => a.disponible));
  myPublications = computed(() => this.adopciones().filter((a) => a.usuarioPublicadorId === this.me().id));
  myRequests = computed(() => this.solicitudes().filter((s) => s.solicitanteId === this.me().id));
  requestsToMe = computed(() => {
    const ids = new Set(this.myPublications().map((a) => a.id));
    return this.solicitudes().filter((s) => ids.has(s.adopcionId));
  });
  requestsForAdopcion(adopcionId?: number | null): SolicitudAdopcion[] {
    if (!adopcionId) return [];
    return this.requestsToMe().filter((s) => s.adopcionId === adopcionId);
  }



  publishForm = new FormGroup({
    mascotaId: new FormControl<number | null>(null, { validators: [Validators.required] }),
    disponible: new FormControl(true, { nonNullable: true }),
  });

  requestForm = new FormGroup({
    mensaje: new FormControl('', { nonNullable: true }),
  });

  constructor() {
    this.reload();
  }

  reload(): void {
    this.busy.set(true);
    const done = () => this.busy.set(false);

    this.api.getAdopciones().subscribe({ next: (v) => this.adopciones.set(v || []) });
    this.api.getSolicitudesAdopcion().subscribe({ next: (v) => this.solicitudes.set(v || []) });
    this.api.getMascotas().subscribe({ next: (v) => this.mascotas.set(v || []) });
    this.api.getUsers().subscribe({ next: (v) => this.usuarios.set(v || []), complete: done, error: done });
  }

  format(d?: string): string {
    return formatFriendlyDate(d);
  }

  petName(id: number): string {
    const p = this.mascotas().find((m) => m.id === id);
    return p?.nombre || `Mascota #${id}`;
  }

  petInfo(id: number): string {
    const p = this.mascotas().find((m) => m.id === id);
    if (!p) return '';
    return `${p.especie || 'Mascota'} · ${p.raza || '—'}`;
  }

  ownerName(userId: number): string {
    const u = this.usuarios().find((x) => x.id === userId);
    return u?.nombre || `Usuario #${userId}`;
  }

  openPublish(): void {
    this.publishForm.reset({ mascotaId: null, disponible: true });
    this.showPublish.set(true);
  }

  publish(): void {
    if (this.publishForm.invalid) {
      this.publishForm.markAllAsTouched();
      return;
    }
    const body: Adopcion = {
      mascotaId: Number(this.publishForm.value.mascotaId),
      usuarioPublicadorId: this.me().id!,
      disponible: !!this.publishForm.value.disponible,
      fechaPublicacion: toLocalDateString(),
    };
    this.api.createAdopcion(body).subscribe({
      next: (created) => {
        this.adopciones.update((arr) => [created, ...arr]);
        this.toast.show('Adopción publicada.', 'success');
        this.showPublish.set(false);
        this.tab.set('misPublicaciones');
      },
      error: () => this.toast.show('No se pudo publicar.', 'danger'),
    });
  }

  toggleDisponible(a: Adopcion): void {
    if (!a.id) return;
    const body: Adopcion = { ...a, disponible: !a.disponible };
    this.api.updateAdopcion(a.id, body).subscribe({
      next: (updated) => {
        this.adopciones.update((arr) => arr.map((x) => (x.id === updated.id ? updated : x)));
      },
      error: () => this.toast.show('No se pudo actualizar.', 'danger'),
    });
  }

  deleteAdopcion(a: Adopcion): void {
    if (!a.id) return;
    if (!confirm('¿Eliminar esta publicación de adopción?')) return;
    this.api.deleteAdopcion(a.id).subscribe({
      next: () => {
        this.adopciones.update((arr) => arr.filter((x) => x.id !== a.id));
        this.toast.show('Publicación eliminada.', 'info');
      },
      error: () => this.toast.show('No se pudo eliminar.', 'danger'),
    });
  }

  openRequest(a: Adopcion): void {
    this.requestTarget.set(a);
    this.requestForm.reset({ mensaje: '' });
    this.showRequest.set(true);
  }

  sendRequest(): void {
    const a = this.requestTarget();
    if (!a?.id) return;

    const body: SolicitudAdopcion = {
      adopcionId: a.id,
      solicitanteId: this.me().id!,
      estado: 'PENDIENTE',
      mensaje: this.requestForm.value.mensaje || undefined,
      fechaSolicitud: toLocalDateString(),
    };

    this.api.createSolicitudAdopcion(body).subscribe({
      next: (created) => {
        this.solicitudes.update((arr) => [...arr, created]);
        this.toast.show('Solicitud enviada.', 'success');
        this.showRequest.set(false);
        this.tab.set('misSolicitudes');
      },
      error: () => this.toast.show('No se pudo enviar la solicitud.', 'danger'),
    });
  }

  setEstadoSolicitud(s: SolicitudAdopcion, estado: string): void {
    if (!s.id) return;
    const body: SolicitudAdopcion = { ...s, estado };
    this.api.updateSolicitudAdopcion(s.id, body).subscribe({
      next: (updated) => {
        this.solicitudes.update((arr) => arr.map((x) => (x.id === updated.id ? updated : x)));
        this.toast.show(`Solicitud actualizada a ${estado}.`, 'success');
      },
      error: () => this.toast.show('No se pudo actualizar la solicitud.', 'danger'),
    });
  }
}
