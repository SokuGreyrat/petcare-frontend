import { Component, computed, inject, signal } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { ImagenMascota, Mascota, RastreoGPS, Tratamiento } from '../../models/api.models';
import { Modal } from '../../components/modal/modal';
import { formatFriendlyDate, toLocalDateString } from '../../utils/date';

@Component({
  selector: 'app-mis-mascotas',
  standalone: true,
  imports: [NgFor, NgIf, ReactiveFormsModule, Modal],
  templateUrl: './mis-mascotas.html',
  styleUrl: './mis-mascotas.css',
})
export class MisMascotas {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);

  busy = signal(false);
  selectedId = signal<number | null>(null);
  tab = signal<'info' | 'fotos' | 'tratamientos' | 'gps'>('info');
  showCreate = signal(false);
  showEdit = signal(false);

  mascotas = signal<Mascota[]>([]);
  imagenes = signal<ImagenMascota[]>([]);
  tratamientos = signal<Tratamiento[]>([]);
  gps = signal<RastreoGPS[]>([]);

  myMascotas = computed(() => {
    const me = this.auth.requireUser();
    return this.mascotas().filter((m) => m.usuarioId === me.id);
  });

  selected = computed(() => this.myMascotas().find((m) => m.id === this.selectedId()) || null);

  constructor() {
    this.reload();
  }

  reload(): void {
    this.busy.set(true);
    const done = () => this.busy.set(false);

    this.api.getMascotas().subscribe({
      next: (v) => {
        this.mascotas.set(v || []);
        if (!this.selectedId() && (v || []).length) {
          const mine = (v || []).filter((m) => m.usuarioId === this.auth.requireUser().id);
          this.selectedId.set(mine[0]?.id || null);
        }
      },
    });
    this.api.getImagenesMascota().subscribe({ next: (v) => this.imagenes.set(v || []) });
    this.api.getTratamientos().subscribe({ next: (v) => this.tratamientos.set(v || []) });
    this.api.getRastreoGPS().subscribe({ next: (v) => this.gps.set(v || []), complete: done, error: done });
  }

  format(dateLike?: string): string {
    return formatFriendlyDate(dateLike);
  }

  petImages(petId?: number): ImagenMascota[] {
    if (!petId) return [];
    return this.imagenes().filter((x) => x.mascotaId === petId);
  }

  petTratamientos(petId?: number): Tratamiento[] {
    if (!petId) return [];
    return this.tratamientos().filter((x) => x.mascotaId === petId);
  }

  petGPS(petId?: number): RastreoGPS[] {
    if (!petId) return [];
    return [...this.gps().filter((x) => x.mascotaId === petId)].slice(-25).reverse();
  }

  // --- forms
  createForm = new FormGroup({
    nombre: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    especie: new FormControl('', { nonNullable: true }),
    raza: new FormControl('', { nonNullable: true }),
    genero: new FormControl('', { nonNullable: true }),
    peso: new FormControl<number | null>(null),
    vacunado: new FormControl(false, { nonNullable: true }),
    esterilizado: new FormControl(false, { nonNullable: true }),
    tieneSeguro: new FormControl(false, { nonNullable: true }),
    descripcion: new FormControl('', { nonNullable: true }),
  });

  editForm = new FormGroup({
    nombre: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    especie: new FormControl('', { nonNullable: true }),
    raza: new FormControl('', { nonNullable: true }),
    genero: new FormControl('', { nonNullable: true }),
    peso: new FormControl<number | null>(null),
    vacunado: new FormControl(false, { nonNullable: true }),
    esterilizado: new FormControl(false, { nonNullable: true }),
    tieneSeguro: new FormControl(false, { nonNullable: true }),
    descripcion: new FormControl('', { nonNullable: true }),
  });

  imageUrl = new FormControl('', { nonNullable: true });

  tratamientoForm = new FormGroup({
    tipoTratamiento: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    fecha: new FormControl(toLocalDateString(), { nonNullable: true, validators: [Validators.required] }),
    veterinario: new FormControl('', { nonNullable: true }),
    costo: new FormControl<number | null>(null),
    descripcion: new FormControl('', { nonNullable: true }),
  });

  gpsForm = new FormGroup({
    latitud: new FormControl<number | null>(null, { validators: [Validators.required] }),
    longitud: new FormControl<number | null>(null, { validators: [Validators.required] }),
    timestamp: new FormControl('', { nonNullable: true }),
  });

  openCreate(): void {
    this.createForm.reset({
      nombre: '',
      especie: '',
      raza: '',
      genero: '',
      peso: null,
      vacunado: false,
      esterilizado: false,
      tieneSeguro: false,
      descripcion: '',
    });
    this.showCreate.set(true);
  }

  createPet(): void {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }
    const me = this.auth.requireUser();
    const body: Mascota = {
      usuarioId: me.id!,
      nombre: this.createForm.value.nombre!,
      especie: this.createForm.value.especie || undefined,
      raza: this.createForm.value.raza || undefined,
      genero: this.createForm.value.genero || undefined,
      peso: this.createForm.value.peso || undefined,
      vacunado: this.createForm.value.vacunado || false,
      esterilizado: this.createForm.value.esterilizado || false,
      tieneSeguro: this.createForm.value.tieneSeguro || false,
      descripcion: this.createForm.value.descripcion || undefined,
    };

    this.api.createMascota(body).subscribe({
      next: (created) => {
        this.mascotas.update((arr) => [created, ...arr]);
        this.selectedId.set(created.id || null);
        this.toast.show('Mascota registrada.', 'success');
        this.showCreate.set(false);
      },
      error: () => this.toast.show('No se pudo crear la mascota.', 'danger'),
    });
  }

  openEdit(): void {
    const p = this.selected();
    if (!p) return;
    this.editForm.reset({
      nombre: p.nombre,
      especie: p.especie || '',
      raza: p.raza || '',
      genero: p.genero || '',
      peso: p.peso ?? null,
      vacunado: !!p.vacunado,
      esterilizado: !!p.esterilizado,
      tieneSeguro: !!p.tieneSeguro,
      descripcion: p.descripcion || '',
    });
    this.showEdit.set(true);
  }

  saveEdit(): void {
    const p = this.selected();
    if (!p?.id) return;
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }
    const body: Mascota = {
      usuarioId: p.usuarioId,
      nombre: this.editForm.value.nombre!,
      especie: this.editForm.value.especie || undefined,
      raza: this.editForm.value.raza || undefined,
      genero: this.editForm.value.genero || undefined,
      peso: this.editForm.value.peso || undefined,
      vacunado: this.editForm.value.vacunado || false,
      esterilizado: this.editForm.value.esterilizado || false,
      tieneSeguro: this.editForm.value.tieneSeguro || false,
      descripcion: this.editForm.value.descripcion || undefined,
    };
    this.api.updateMascota(p.id, body).subscribe({
      next: (updated) => {
        this.mascotas.update((arr) => arr.map((x) => (x.id === updated.id ? updated : x)));
        this.toast.show('Cambios guardados.', 'success');
        this.showEdit.set(false);
      },
      error: () => this.toast.show('No se pudo guardar.', 'danger'),
    });
  }

  deletePet(): void {
    const p = this.selected();
    if (!p?.id) return;
    if (!confirm(`¿Eliminar a ${p.nombre}?`)) return;
    this.api.deleteMascota(p.id).subscribe({
      next: () => {
        this.mascotas.update((arr) => arr.filter((x) => x.id !== p.id));
        this.selectedId.set(this.myMascotas()[0]?.id || null);
        this.toast.show('Mascota eliminada.', 'info');
      },
      error: () => this.toast.show('No se pudo eliminar.', 'danger'),
    });
  }

  addImage(): void {
    const p = this.selected();
    const url = (this.imageUrl.value || '').trim();
    if (!p?.id || !url) return;
    this.api.createImagenMascota({ mascotaId: p.id, ruta: url }).subscribe({
      next: (created) => {
        this.imagenes.update((arr) => [created, ...arr]);
        this.imageUrl.setValue('');
        this.toast.show('Imagen agregada.', 'success');
      },
      error: () => this.toast.show('No se pudo agregar la imagen.', 'danger'),
    });
  }

  deleteImage(im: ImagenMascota): void {
    if (!im.id) return;
    this.api.deleteImagenMascota(im.id).subscribe({
      next: () => this.imagenes.update((arr) => arr.filter((x) => x.id !== im.id)),
      error: () => this.toast.show('No se pudo eliminar la imagen.', 'danger'),
    });
  }

  addTratamiento(): void {
    const p = this.selected();
    if (!p?.id) return;
    if (this.tratamientoForm.invalid) {
      this.tratamientoForm.markAllAsTouched();
      return;
    }
    const me = this.auth.requireUser();
    const body: Tratamiento = {
      usuarioId: me.id!,
      mascotaId: p.id,
      tipoTratamiento: this.tratamientoForm.value.tipoTratamiento!,
      fecha: this.tratamientoForm.value.fecha!,
      veterinario: this.tratamientoForm.value.veterinario || undefined,
      descripcion: this.tratamientoForm.value.descripcion || undefined,
      costo: this.tratamientoForm.value.costo || undefined,
    };
    this.api.createTratamiento(body).subscribe({
      next: (created) => {
        this.tratamientos.update((arr) => [...arr, created]);
        this.tratamientoForm.reset({
          tipoTratamiento: '',
          fecha: toLocalDateString(),
          veterinario: '',
          costo: null,
          descripcion: '',
        });
        this.toast.show('Tratamiento guardado.', 'success');
      },
      error: () => this.toast.show('No se pudo guardar el tratamiento.', 'danger'),
    });
  }

  deleteTratamiento(t: Tratamiento): void {
    if (!t.id) return;
    this.api.deleteTratamiento(t.id).subscribe({
      next: () => this.tratamientos.update((arr) => arr.filter((x) => x.id !== t.id)),
      error: () => this.toast.show('No se pudo eliminar.', 'danger'),
    });
  }

  addGPS(): void {
    const p = this.selected();
    if (!p?.id) return;
    if (this.gpsForm.invalid) {
      this.gpsForm.markAllAsTouched();
      return;
    }
    const body: RastreoGPS = {
      mascotaId: p.id,
      latitud: Number(this.gpsForm.value.latitud),
      longitud: Number(this.gpsForm.value.longitud),
      timestamp: (this.gpsForm.value.timestamp || '').trim() || undefined,
    };
    this.api.createRastreoGPS(body).subscribe({
      next: (created) => {
        this.gps.update((arr) => [...arr, created]);
        this.gpsForm.reset({ latitud: null, longitud: null, timestamp: '' });
        this.toast.show('Punto GPS agregado.', 'success');
      },
      error: () => this.toast.show('No se pudo agregar el rastreo.', 'danger'),
    });
  }

  deleteGPS(g: RastreoGPS): void {
    if (!g.id) return;
    this.api.deleteRastreoGPS(g.id).subscribe({
      next: () => this.gps.update((arr) => arr.filter((x) => x.id !== g.id)),
      error: () => this.toast.show('No se pudo eliminar.', 'danger'),
    });
  }

  openMap(g: RastreoGPS): void {
    const url = `https://www.google.com/maps?q=${g.latitud},${g.longitud}`;
    window.open(url, '_blank');
  }
}
