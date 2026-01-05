import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { environment } from  '../../../environments/environment';

type Vista = 'explorar' | 'misPublicaciones' | 'misSolicitudes';

interface Adopcion {
  id: number;
  mascotaId: number;
  usuarioPublicadorId: number;
  disponible: boolean;
  fechaPublicacion?: string;

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

  edad?: number | string;
  sexo?: string;
  descripcion?: string;

  foto?: any;
  fotoUrl?: string;
  imagen?: any;
  imagenUrl?: string;
  urlImagen?: string;
  photoUrl?: string;

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

interface ImagenMascota {
  id?: number;
  mascotaId: number;
  url: string; // url o ruta o base64 normalizada
}

@Component({
  selector: 'app-adopciones',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './adopciones.html',
  styleUrls: ['./adopciones.css']
})
export class AdopcionesComponent implements OnInit {
  private readonly API = `${environment.apiUrl}/api/petcare`;

  // Placeholder para cuando no haya foto
  private readonly IMG_PLACEHOLDER =
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="140" height="140" viewBox="0 0 140 140">
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#2b3558"/>
            <stop offset="1" stop-color="#101628"/>
          </linearGradient>
        </defs>
        <rect width="140" height="140" rx="24" fill="url(#g)"/>
        <circle cx="70" cy="60" r="26" fill="rgba(255,255,255,.08)"/>
        <path d="M50 96c4-10 36-10 40 0 3 7-4 14-20 14s-23-7-20-14z" fill="rgba(255,255,255,.08)"/>
        <text x="70" y="66" text-anchor="middle" font-family="system-ui,Segoe UI,Arial" font-size="20" fill="rgba(255,255,255,.55)">🐾</text>
      </svg>
    `);

  vista: Vista = 'explorar';
  userId: number | null = null;

  cargando = false;

  adopciones: Adopcion[] = [];
  misPublicaciones: Adopcion[] = [];
  misSolicitudes: SolicitudAdopcion[] = [];
  inventario: Mascota[] = [];

  private mascotasById = new Map<number, Mascota>();
  private usuariosById = new Map<number, Usuario>();

  private solicitudByAdopcionId = new Map<number, SolicitudAdopcion>();
  private adopcionByMascotaId = new Map<number, Adopcion>();

  // ✅ AQUÍ guardamos la foto real por mascotaId
  private fotoByMascotaId = new Map<number, string>();

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
  private toastTimer?: ReturnType<typeof setTimeout>;

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

    // 1) Adopciones
    this.http.get<any>(`${this.API}/alladopciones`).subscribe({
      next: (data) => {
        this.adopciones = this.normalizeList<any>(data).map((x) => this.normalizeAdopcion(x));
        this.recalcularDerivados();
        this.cargando = false;
      },
      error: (err) => {
        this.cargando = false;
        console.error(err);
        this.showToast('No se pudieron cargar las adopciones.');
      }
    });

    // 2) Solicitudes
    this.http.get<any>(`${this.API}/allsolicitudes-adopcion`).subscribe({
      next: (data) => {
        const all = this.normalizeList<any>(data).map((x) => this.normalizeSolicitud(x));
        this.misSolicitudes = this.userId == null ? [] : all.filter((s) => Number(s.solicitanteId) === this.userId);
        this.reconstruirSolicitudMap();
      },
      error: (err) => {
        console.error(err);
        this.showToast('No se pudieron cargar tus solicitudes.');
      }
    });

    // 3) Mascotas
    this.cargarMascotas();

    // 4) Usuarios
    this.cargarUsuarios();

    // 5) ✅ Imágenes de mascotas (CLAVE)
    this.cargarImagenesMascotas();
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
    const list = this.normalizeList<any>(data).map((x) => this.normalizeMascota(x));

    this.mascotasById.clear();
    for (const m of list) this.mascotasById.set(Number(m.id), m);

    if (this.userId == null) {
      this.inventario = [];
      this.recalcularDerivados();
      return;
    }

    this.inventario = list.filter((m) => this.getMascotaOwnerId(m) === this.userId);
    this.recalcularDerivados();
  }

  private cargarUsuarios(): void {
    // ✅ Pon primero los que sí existen para evitar el 404 molesto
    const candidates = [
      `${this.API}/allusers`,
      `${this.API}/allusuarios`,
      `${this.API}/allusuario`,
      `${this.API}/usuarios`,
      `${this.API}/users`
    ];

    const tryNext = (idx: number) => {
      if (idx >= candidates.length) return;

      this.http.get<any>(candidates[idx]).subscribe({
        next: (data) => {
          const list = this.normalizeList<any>(data).map((x) => this.normalizeUsuario(x));
          this.usuariosById.clear();
          for (const u of list) this.usuariosById.set(Number(u.id), u);
        },
        error: () => tryNext(idx + 1)
      });
    };

    tryNext(0);
  }

  /**
   * ✅ CLAVE PARA LAS FOTOS:
   * en tu app de “mis-mascotas” el back responde a /allimagenesmascotas
   */
  private cargarImagenesMascotas(): void {
    const candidates = [
      `${this.API}/allimagenesmascotas`,
      `${this.API}/allimagenesmascota`,
      `${this.API}/imagenesmascotas`,
      `${this.API}/imagenes-mascotas`
    ];

    const tryNext = (idx: number) => {
      if (idx >= candidates.length) return;

      this.http.get<any>(candidates[idx]).subscribe({
        next: (data) => {
          const list = this.normalizeList<any>(data).map((x) => this.normalizeImagenMascota(x));

          // reconstruimos mapa
          this.fotoByMascotaId.clear();
          for (const img of list) {
            const key = Number(img.mascotaId);
            if (!key) continue;

            // si hay varias, nos quedamos con la primera
            if (!this.fotoByMascotaId.has(key)) {
              this.fotoByMascotaId.set(key, img.url);
            }
          }
        },
        error: () => tryNext(idx + 1)
      });
    };

    tryNext(0);
  }

  private recalcularDerivados(): void {
    this.misPublicaciones =
      this.userId == null ? [] : this.adopciones.filter((a) => Number(a.usuarioPublicadorId) === this.userId);

    this.adopcionByMascotaId.clear();
    for (const ad of this.misPublicaciones) this.adopcionByMascotaId.set(Number(ad.mascotaId), ad);
  }

  private reconstruirSolicitudMap(): void {
    this.solicitudByAdopcionId.clear();
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
    if (this.userId != null && Number(adopcion.usuarioPublicadorId) === this.userId) {
      this.showToast('No puedes solicitar tu propia publicación.');
      return;
    }

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
  // HELPERS UI
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

  /**
   * ✅ AQUÍ YA SALE LA FOTO:
   * 1) Primero busca en /allimagenesmascotas (mapa por mascotaId)
   * 2) Si no, fallback a campos directos en Mascota (por si existe)
   * 3) Si no, placeholder
   */
  getFotoMascota(ad: Adopcion): string {
    const mascotaId = Number(ad.mascotaId);

    const fromMap = this.fotoByMascotaId.get(mascotaId);
    if (fromMap) return fromMap;

    // fallback por si algún back devuelve foto dentro de Mascota
    const m = this.getMascotaDeAdopcion(ad);
    if (m) {
      const raw =
        m.fotoUrl || m.imagenUrl || m.urlImagen || m.photoUrl || m.foto || m.imagen || null;
      const resolved = this.resolveImageUrl(raw);
      if (resolved) return resolved;
    }

    return this.IMG_PLACEHOLDER;
  }

  onImgError(ev: Event): void {
    const el = ev.target as HTMLImageElement | null;
    if (!el) return;
    if (el.src === this.IMG_PLACEHOLDER) return;
    el.src = this.IMG_PLACEHOLDER;
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
  // NORMALIZADORES
  // --------------------------
  private normalizeAdopcion(x: any): Adopcion {
    const id = this.pickNumber(x, ['id', 'adopcionId', 'idAdopcion']) ?? 0;
    const mascotaId = this.pickNumber(x, ['mascotaId', 'idMascota', 'petId']) ?? 0;
    const usuarioPublicadorId =
      this.pickNumber(x, ['usuarioPublicadorId', 'publicadorId', 'usuarioId', 'idUsuario', 'userId']) ?? 0;

    return {
      id,
      mascotaId,
      usuarioPublicadorId,
      disponible: Boolean(x?.disponible ?? x?.available ?? x?.estatus ?? true),
      fechaPublicacion: x?.fechaPublicacion ?? x?.fecha ?? x?.createdAt,
      mascotaNombre: x?.mascotaNombre ?? x?.nombreMascota,
      mascotaTipo: x?.mascotaTipo ?? x?.tipoMascota,
      mascotaRaza: x?.mascotaRaza ?? x?.razaMascota
    };
  }

  private normalizeSolicitud(x: any): SolicitudAdopcion {
    const id = this.pickNumber(x, ['id', 'solicitudId', 'idSolicitud']) ?? 0;
    const adopcionId = this.pickNumber(x, ['adopcionId', 'idAdopcion']) ?? 0;
    const solicitanteId = this.pickNumber(x, ['solicitanteId', 'usuarioId', 'idUsuario', 'userId']) ?? 0;

    const estadoRaw = String(x?.estado ?? x?.status ?? 'pendiente').toLowerCase();
    const estado: SolicitudAdopcion['estado'] =
      estadoRaw === 'aceptada' || estadoRaw === 'aceptado'
        ? 'aceptada'
        : estadoRaw === 'rechazada' || estadoRaw === 'rechazado'
          ? 'rechazada'
          : 'pendiente';

    return {
      id,
      adopcionId,
      solicitanteId,
      mensaje: x?.mensaje ?? x?.message ?? null,
      estado,
      fechaSolicitud: x?.fechaSolicitud ?? x?.fecha ?? x?.createdAt
    };
  }

  private normalizeMascota(x: any): Mascota {
    const id = this.pickNumber(x, ['id', 'idMascota', 'mascotaId', 'petId']) ?? 0;
    const usuarioId = this.pickNumber(x, ['usuarioId', 'idUsuario', 'ownerId', 'userId']) ?? undefined;

    return {
      ...x,
      id,
      usuarioId,
      nombre: x?.nombre ?? x?.name,
      tipo: x?.tipo ?? x?.type,
      raza: x?.raza ?? x?.breed,
      edad: x?.edad ?? x?.age,
      sexo: x?.sexo ?? x?.gender,
      descripcion: x?.descripcion ?? x?.description
    };
  }

  private normalizeUsuario(x: any): Usuario {
    const id = this.pickNumber(x, ['id', 'idUsuario', 'usuarioId', 'userId', 'id_user']) ?? 0;
    return {
      ...x,
      id,
      nombre: x?.nombre ?? x?.name,
      apellido: x?.apellido ?? x?.lastName,
      apellidoPaterno: x?.apellidoPaterno ?? x?.apellido_paterno,
      apellidoMaterno: x?.apellidoMaterno ?? x?.apellido_materno,
      nombreCompleto: x?.nombreCompleto ?? x?.fullName,
      username: x?.username ?? x?.userName,
      email: x?.email
    };
  }

  private normalizeImagenMascota(x: any): ImagenMascota {
    const mascotaId =
      this.pickNumber(x, ['mascotaId', 'idMascota', 'petId', 'id_pet']) ??
      0;

    // intentamos muchas llaves para la url
    const rawUrl =
      x?.url ||
      x?.urlImagen ||
      x?.imagenUrl ||
      x?.fotoUrl ||
      x?.path ||
      x?.ruta ||
      x?.link ||
      x?.imagen ||
      x?.foto ||
      '';

    const url = this.resolveImageUrl(rawUrl) ?? this.IMG_PLACEHOLDER;

    return { id: this.pickNumber(x, ['id', 'idImagen', 'imageId']) ?? undefined, mascotaId, url };
  }

  private pickNumber(obj: any, keys: string[]): number | null {
    for (const k of keys) {
      const v = obj?.[k];
      if (v === undefined || v === null || v === '') continue;
      const n = Number(v);
      if (!Number.isNaN(n)) return n;
    }
    return null;
  }

  // --------------------------
  // RESOLVER URL/BASE64
  // --------------------------
  private resolveImageUrl(raw: any): string | null {
    if (raw === undefined || raw === null) return null;
    let v = String(raw).trim();
    if (!v) return null;

    if (v.startsWith('data:image')) return v;
    if (/^https?:\/\//i.test(v)) return v;

    // base64 pelón
    if (v.length > 200 && !v.includes('/') && !v.includes('\\') && !v.includes('.')) {
      return `data:image/jpeg;base64,${v}`;
    }

    // normaliza slashes
    v = v.replace(/\\/g, '/').replace(/^"+|"+$/g, '').replace(/^'+|'+$/g, '');
    if (!v) return null;

    // si llega filename suelto
    if (!v.includes('/')) {
      // por si tu back sirve como “ver imagen”
      return `${this.API}/urs/images/${encodeURIComponent(v)}`;
    }

    // si viene ya con /api
    if (v.startsWith('/api/')) return v;

    // si viene como /urs/images/archivo
    if (v.includes('/urs/images/')) {
      const file = v.substring(v.lastIndexOf('/urs/images/') + '/urs/images/'.length);
      if (!file) return null;
      return `${this.API}/urs/images/${encodeURIComponent(file)}`;
    }

    // si viene como /images/archivo
    if (v.includes('/images/')) {
      const file = v.substring(v.lastIndexOf('/images/') + '/images/'.length);
      if (!file) return null;
      return `${this.API}/images/${encodeURIComponent(file)}`;
    }

    // fallback: agarra el último segmento
    const last = v.substring(v.lastIndexOf('/') + 1).trim();
    if (!last) return null;
    return `${this.API}/urs/images/${encodeURIComponent(last)}`;
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
    const candidates = [m?.usuarioId, m?.idUsuario, m?.ownerId, m?.userId, m?.usuario?.id, m?.usuario?.usuarioId];

    for (const c of candidates) {
      if (c !== undefined && c !== null && c !== '') {
        const n = Number(c);
        if (!Number.isNaN(n)) return n;
      }
    }
    return null;
  }

  // --------------------------
  // SESSION
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
          s?.data?.usuario?.id
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
