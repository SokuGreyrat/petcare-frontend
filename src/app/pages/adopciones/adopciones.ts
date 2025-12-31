import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';

type Vista = 'explorar' | 'misPublicaciones' | 'misSolicitudes';

interface Adopcion {
  id: number;
  mascotaId: number;
  usuarioPublicadorId: number;
  disponible: boolean;
  fechaPublicacion?: string;

  // si tu backend ya regresa algunos datos “enriquecidos”
  mascotaNombre?: string;
  mascotaTipo?: string;
  mascotaRaza?: string;
}

interface SolicitudAdopcion {
  id: number;
  adopcionId: number;
  solicitanteId: number;
  mensaje?: string | null;
  estado: 'pendiente' | 'aceptada' | 'rechazada';
  fechaSolicitud?: string;
}

interface Mascota {
  id: number;
  nombre?: string;
  tipo?: string;
  raza?: string;

  // posibles campos extra:
  edad?: number | string;
  sexo?: string;
  descripcion?: string;

  // foto / imagen (intentamos varias llaves)
  foto?: string;
  fotoUrl?: string;
  imagen?: string;
  imagenUrl?: string;
  urlImagen?: string;
  photoUrl?: string;

  // dueño (distintas variantes)
  usuarioId?: number;
  idUsuario?: number;
  usuario?: { id?: number; usuarioId?: number; nombre?: string; nombreCompleto?: string; email?: string };
}

interface Usuario {
  id: number;
  nombre?: string;
  apellido?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  nombreCompleto?: string;
  username?: string;
  email?: string;
}

@Component({
  selector: 'app-adopciones',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './adopciones.html',
  styleUrls: ['./adopciones.css']
})
export class AdopcionesComponent implements OnInit {
  private readonly API = '/api/petcare';

  vista: Vista = 'explorar';
  userId: number | null = null;

  cargando = false;

  adopciones: Adopcion[] = [];
  misPublicaciones: Adopcion[] = [];
  misSolicitudes: SolicitudAdopcion[] = [];
  inventario: Mascota[] = [];

  // Mapas para “enriquecer” UI
  private mascotasById = new Map<number, Mascota>();
  private usuariosById = new Map<number, Usuario>();

  // Para marcar “ya solicitaste” (adopcionId -> solicitud)
  private solicitudByAdopcionId = new Map<number, SolicitudAdopcion>();

  // Para marcar en inventario si está “en adopción”
  private adopcionByMascotaId = new Map<number, Adopcion>();

  // Modal Solicitud
  modalSolicitudOpen = false;
  selectedAdopcion: Adopcion | null = null;
  mensajeSolicitud = '';

  // Modal Publicar
  modalPublicarOpen = false;
  selectedMascotaId: number | null = null;

  // Toast
  toastMsg = '';
  toastVisible = false;
  private toastTimer?: any;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.userId = this.getCurrentUserId();
    if (this.userId != null) localStorage.setItem('userId', String(this.userId));
    this.refrescarTodo();
  }

  // --------------------------
  // CARGAS
  // --------------------------
  refrescarTodo(): void {
    this.cargando = true;

    // 1) Adopciones (explorar)
    this.http.get<any>(`${this.API}/alladopciones`).subscribe({
      next: (data) => {
        this.adopciones = this.normalizeList<Adopcion>(data);
        this.recalcularDerivados();
        this.cargando = false;
      },
      error: (err) => {
        this.cargando = false;
        console.error(err);
        this.showToast('No se pudieron cargar las adopciones.');
      }
    });

    // 2) Solicitudes (para marcar “ya solicitaste”)
    this.http.get<any>(`${this.API}/allsolicitudes-adopcion`).subscribe({
      next: (data) => {
        const all = this.normalizeList<SolicitudAdopcion>(data);
        this.misSolicitudes = this.userId == null ? [] : all.filter(s => Number(s.solicitanteId) === this.userId);
        this.reconstruirSolicitudMap();
      },
      error: (err) => {
        console.error(err);
        this.showToast('No se pudieron cargar tus solicitudes.');
      }
    });

    // 3) Mascotas (para nombre/foto/características + inventario)
    this.cargarMascotas();

    // 4) Usuarios (para nombre del dueño)
    this.cargarUsuarios();
  }

  private cargarMascotas(): void {
    const url1 = `${this.API}/allmascotas`;
    const url2 = `${this.API}/allmascota`;

    this.http.get<any>(url1).subscribe({
      next: (data) => this.procesarMascotas(data),
      error: () => {
        this.http.get<any>(url2).subscribe({
          next: (data) => this.procesarMascotas(data),
          error: (err2) => {
            console.error('❌ Error cargando mascotas:', err2);
            this.mascotasById.clear();
            this.inventario = [];
          }
        });
      }
    });
  }

  private procesarMascotas(data: any): void {
    const list = this.normalizeList<Mascota>(data);

    this.mascotasById.clear();
    for (const m of list) this.mascotasById.set(Number(m.id), m);

    // Inventario = mascotas del usuario logueado
    if (this.userId == null) {
      this.inventario = [];
      return;
    }

    this.inventario = list.filter(m => this.getMascotaOwnerId(m) === this.userId);
    this.recalcularDerivados();
  }

  private cargarUsuarios(): void {
    const candidates = [
      `${this.API}/allusuarios`,
      `${this.API}/allusers`,
      `${this.API}/allusuario`,
      `${this.API}/usuarios`
    ];

    const tryNext = (idx: number) => {
      if (idx >= candidates.length) return;

      this.http.get<any>(candidates[idx]).subscribe({
        next: (data) => {
          const list = this.normalizeList<Usuario>(data);
          this.usuariosById.clear();
          for (const u of list) this.usuariosById.set(Number((u as any).id), u);
        },
        error: () => tryNext(idx + 1)
      });
    };

    tryNext(0);
  }

  private recalcularDerivados(): void {
    // Mis publicaciones
    this.misPublicaciones =
      this.userId == null ? [] : this.adopciones.filter(a => Number(a.usuarioPublicadorId) === this.userId);

    // Mapa mascotaId -> adopcion (solo las mías, para marcar inventario)
    this.adopcionByMascotaId.clear();
    for (const ad of this.misPublicaciones) {
      this.adopcionByMascotaId.set(Number(ad.mascotaId), ad);
    }
  }

  private reconstruirSolicitudMap(): void {
    this.solicitudByAdopcionId.clear();

    // si por alguna razón hay más de una solicitud para misma adopción,
    // nos quedamos con la “más reciente” por id
    for (const s of this.misSolicitudes) {
      const key = Number(s.adopcionId);
      const prev = this.solicitudByAdopcionId.get(key);
      if (!prev || Number(s.id) > Number(prev.id)) this.solicitudByAdopcionId.set(key, s);
    }
  }

  // --------------------------
  // VISTAS
  // --------------------------
  setVista(v: Vista): void {
    this.vista = v;
  }

  // --------------------------
  // SOLICITAR ADOPCIÓN
  // --------------------------
  abrirModalSolicitud(adopcion: Adopcion): void {
    // No pedir tu propia publicación
    if (this.userId != null && Number(adopcion.usuarioPublicadorId) === this.userId) {
      this.showToast('No puedes solicitar tu propia publicación.');
      return;
    }

    // Si ya solicitaste, no abrir modal
    if (this.yaSolicite(adopcion)) {
      this.showToast('Ya solicitaste esta adopción.');
      return;
    }

    this.selectedAdopcion = adopcion;
    this.mensajeSolicitud = '';
    this.modalSolicitudOpen = true;
  }

  cerrarModalSolicitud(): void {
    this.modalSolicitudOpen = false;
    this.selectedAdopcion = null;
    this.mensajeSolicitud = '';
  }

  enviarSolicitud(): void {
    if (!this.selectedAdopcion) return;
    if (this.userId == null) {
      this.showToast('No se encontró tu usuario (sesión).');
      return;
    }

    const body = {
      adopcionId: Number(this.selectedAdopcion.id),
      solicitanteId: Number(this.userId),
      mensaje: this.mensajeSolicitud.trim() || null
    };

    this.http.post(`${this.API}/create-solicitud-adopcion`, body).subscribe({
      next: () => {
        this.showToast('Solicitud enviada.');
        this.cerrarModalSolicitud();
        this.refrescarTodo();
      },
      error: (err: HttpErrorResponse) => {
        console.error(err);
        this.showToast('No se pudo enviar la solicitud.');
      }
    });
  }

  cancelarSolicitud(solicitud: SolicitudAdopcion): void {
    this.http.delete(`${this.API}/delete-solicitud-adopcion/${solicitud.id}`).subscribe({
      next: () => {
        this.showToast('Solicitud cancelada.');
        this.refrescarTodo();
      },
      error: (err) => {
        console.error(err);
        this.showToast('No se pudo cancelar la solicitud.');
      }
    });
  }

  // --------------------------
  // PUBLICAR ADOPCIÓN
  // --------------------------
  abrirModalPublicar(): void {
    this.selectedMascotaId = null;
    this.modalPublicarOpen = true;

    // refresca inventario por si cambió
    this.cargarMascotas();
  }

  cerrarModalPublicar(): void {
    this.modalPublicarOpen = false;
    this.selectedMascotaId = null;
  }

  publicarDesdeInventario(): void {
    if (this.userId == null) {
      this.showToast('No se encontró tu usuario (sesión).');
      return;
    }
    if (!this.selectedMascotaId) {
      this.showToast('Selecciona una mascota para publicar.');
      return;
    }

    // si ya está en adopción, bloquear
    if (this.adopcionByMascotaId.has(Number(this.selectedMascotaId))) {
      this.showToast('Esa mascota ya está publicada en adopción.');
      return;
    }

    const body = {
      mascotaId: Number(this.selectedMascotaId),
      usuarioPublicadorId: Number(this.userId),
      disponible: true
    };

    this.http.post(`${this.API}/create-adopcion`, body).subscribe({
      next: () => {
        this.showToast('Publicación creada.');
        this.cerrarModalPublicar();
        this.refrescarTodo();
      },
      error: (err) => {
        console.error(err);
        this.showToast('No se pudo crear la publicación.');
      }
    });
  }

  toggleDisponibilidad(adopcion: Adopcion): void {
    const body = { ...adopcion, disponible: !adopcion.disponible };

    this.http.put(`${this.API}/update-adopcion/${adopcion.id}`, body).subscribe({
      next: () => {
        this.showToast('Actualizado.');
        this.refrescarTodo();
      },
      error: (err) => {
        console.error(err);
        this.showToast('No se pudo actualizar.');
      }
    });
  }

  eliminarPublicacion(adopcion: Adopcion): void {
    this.http.delete(`${this.API}/delete-adopcion/${adopcion.id}`).subscribe({
      next: () => {
        this.showToast('Publicación eliminada.');
        this.refrescarTodo();
      },
      error: (err) => {
        console.error(err);
        this.showToast('No se pudo eliminar.');
      }
    });
  }

  // --------------------------
  // HELPERS UI (lo que te pidieron)
  // --------------------------
  yaSolicite(ad: Adopcion): boolean {
    return this.solicitudByAdopcionId.has(Number(ad.id));
  }

  getSolicitudDe(ad: Adopcion): SolicitudAdopcion | null {
    return this.solicitudByAdopcionId.get(Number(ad.id)) ?? null;
  }

  getMascotaDeAdopcion(ad: Adopcion): Mascota | null {
    const m = this.mascotasById.get(Number(ad.mascotaId));
    if (m) return m;

    // fallback si solo viene “enriquecido” desde adopción
    return {
      id: Number(ad.mascotaId),
      nombre: ad.mascotaNombre,
      tipo: ad.mascotaTipo,
      raza: ad.mascotaRaza
    };
  }

  getNombreMascota(ad: Adopcion): string {
    const m = this.getMascotaDeAdopcion(ad);
    return m?.nombre?.trim() || `Mascota #${ad.mascotaId}`;
  }

  getCaracteristicasMascota(ad: Adopcion): string {
    const m = this.getMascotaDeAdopcion(ad);
    if (!m) return '';

    const parts: string[] = [];
    if (m.tipo) parts.push(String(m.tipo));
    if (m.raza) parts.push(String(m.raza));
    if (m.edad !== undefined && m.edad !== null && String(m.edad) !== '') parts.push(`${m.edad} años`);
    if (m.sexo) parts.push(String(m.sexo));

    return parts.join(' · ');
  }

  getFotoMascota(ad: Adopcion): string | null {
    const m = this.getMascotaDeAdopcion(ad);
    if (!m) return null;

    const raw =
      m.fotoUrl || m.imagenUrl || m.urlImagen || m.photoUrl || m.foto || m.imagen || null;

    if (!raw) return null;

    // si viene en base64 sin prefijo
    if (raw.length > 200 && !raw.startsWith('data:image')) {
      return `data:image/jpeg;base64,${raw}`;
    }

    return raw;
  }

  getNombreDueno(ad: Adopcion): string {
    const u = this.usuariosById.get(Number(ad.usuarioPublicadorId));
    if (!u) return `Usuario #${ad.usuarioPublicadorId}`;

    const full =
      u.nombreCompleto ||
      this.joinNonEmpty(u.nombre, u.apellidoPaterno, u.apellidoMaterno) ||
      this.joinNonEmpty(u.nombre, u.apellido) ||
      u.username ||
      u.email;

    return full?.trim() || `Usuario #${ad.usuarioPublicadorId}`;
  }

  mascotaEnAdopcion(mascotaId: number): Adopcion | null {
    return this.adopcionByMascotaId.get(Number(mascotaId)) ?? null;
  }

  formatEstado(estado: SolicitudAdopcion['estado']): string {
    return estado.charAt(0).toUpperCase() + estado.slice(1);
  }

  // --------------------------
  // HELPERS BASE
  // --------------------------
  private showToast(msg: string): void {
    this.toastMsg = msg;
    this.toastVisible = true;
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => (this.toastVisible = false), 2500);
  }

  private normalizeList<T>(data: any): T[] {
    if (Array.isArray(data)) return data as T[];
    if (Array.isArray(data?.content)) return data.content as T[];
    if (Array.isArray(data?.data)) return data.data as T[];
    if (Array.isArray(data?.items)) return data.items as T[];
    return [];
  }

  private joinNonEmpty(...vals: (string | undefined)[]): string {
    return vals.filter(v => !!v && v.trim()).join(' ');
  }

  private getMascotaOwnerId(m: any): number | null {
    const candidates = [
      m?.usuarioId,
      m?.idUsuario,
      m?.usuario?.id,
      m?.usuario?.usuarioId
    ];

    for (const c of candidates) {
      if (c !== undefined && c !== null && c !== '') {
        const n = Number(c);
        if (!Number.isNaN(n)) return n;
      }
    }
    return null;
  }

  // --------------------------
  // SESSION: lee userId desde localStorage (petcare.session.v1)
  // --------------------------
  private getCurrentUserId(): number | null {
    const directKeys = ['userId', 'usuarioId', 'idUsuario', 'id_usuario', 'idUser'];
    for (const k of directKeys) {
      const v = localStorage.getItem(k);
      if (!v) continue;
      const n = Number(v);
      if (!Number.isNaN(n)) return n;
    }

    const sessionRaw = localStorage.getItem('petcare.session.v1');
    if (sessionRaw) {
      try {
        const s = JSON.parse(sessionRaw);

        const candidates = [
          s?.user?.id,
          s?.user?.userId,
          s?.user?.usuarioId,
          s?.usuario?.id,
          s?.usuario?.usuarioId,
          s?.session?.userId,
          s?.session?.usuarioId,
          s?.data?.user?.id,
          s?.data?.usuario?.id,
        ];

        for (const v of candidates) {
          if (v === undefined || v === null || v === '') continue;
          const n = Number(v);
          if (!Number.isNaN(n)) return n;
        }

        const token = s?.token ?? s?.accessToken ?? s?.jwt ?? s?.authToken;
        const fromJwt = this.getUserIdFromJwt(token);
        if (fromJwt != null) return fromJwt;

        const deep = this.deepFindId(s);
        if (deep != null) return deep;
      } catch {
        // ignore
      }
    }

    return null;
  }

  private getUserIdFromJwt(token?: string): number | null {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    try {
      const payload = JSON.parse(atob(parts[1]));
      const id = payload?.userId ?? payload?.usuarioId ?? payload?.id ?? payload?.sub;
      const n = Number(id);
      return Number.isNaN(n) ? null : n;
    } catch {
      return null;
    }
  }

  private deepFindId(obj: any): number | null {
    const wantedKeys = new Set(['userId', 'usuarioId', 'idUsuario', 'id_user', 'id']);
    const seen = new Set<any>();

    const walk = (x: any): number | null => {
      if (!x || typeof x !== 'object') return null;
      if (seen.has(x)) return null;
      seen.add(x);

      for (const k of Object.keys(x)) {
        if (wantedKeys.has(k)) {
          const n = Number((x as any)[k]);
          if (!Number.isNaN(n) && n > 0) return n;
        }
      }

      for (const v of Object.values(x)) {
        const found = walk(v);
        if (found != null) return found;
      }
      return null;
    };

    return walk(obj);
  }
}
