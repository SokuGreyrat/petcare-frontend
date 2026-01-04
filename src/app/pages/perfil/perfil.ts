import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

type Usuario = {
  idUsuario: number;
  nombre: string;
  email: string;
  password: string;

  curp?: string | null;
  telefonoCelular?: string | null;

  fotoPerfil?: string | null;
  fotoPortada?: string | null;

  tipo?: string | null;
  verificado?: boolean | null;
  fechaRegistro?: string | null;
};

type UsuariosColonia = {
  id: number;
  usuarioId: number;
  coloniaId: number;
  fechaRegistro?: string; // a veces puede venir como ISO
};

type Colonia = {
  id: number;
  nombre: string;
  codigoInvitacion: string;
  userId: number;
};

type ModalKind = 'none' | 'success' | 'error';

type SummaryRow = {
  label: string;
  value: string;
  tone?: 'ok' | 'warn' | 'neutral';
};

type MascotaLite = { usuarioId?: number | string | null };
type PostLite = { usuarioId?: number | string | null };
type AdopcionLite = { usuarioPublicadorId?: number | string | null };
type SolicitudLite = { solicitanteId?: number | string | null; estado?: string | null };

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './perfil.html',
  styleUrl: './perfil.css',
})
export class Perfil implements OnInit {
  // Si NO usas proxy, cambia a: 'http://localhost:8080/api/petcare'
  private readonly API_BASE = '/api/petcare';

  loading = false;
  savingProfile = false;
  savingPhoto = false;

  toastVisible = false;
  toastMsg = '';
  toastType: 'ok' | 'bad' = 'ok';

  modal: ModalKind = 'none';
  modalTitle = '';
  modalText = '';

  userId: number | null = null;

  user: Usuario = {
    idUsuario: 0,
    nombre: '',
    email: '',
    password: '',
    curp: '',
    telefonoCelular: '',
    fotoPerfil: '',
  };

  photoUrl = '';

  // Resumen: datos del usuario
  summaryRows: SummaryRow[] = [];

  // Resumen: recuadros
  stats: { mascotas: number | null; posts: number | null; adopciones: number | null; solicitudes: number | null } = {
    mascotas: null,
    posts: null,
    adopciones: null,
    solicitudes: null,
  };

  // ✅ colonia real (sale de usuarios_colonias + colonias)
  coloniaNombre: string = '—';
  coloniaCodigo: string = '—';

  ngOnInit(): void {
    this.userId = this.getLoggedUserId();

    if (!this.userId) {
      this.showModal('error', 'Sesión no encontrada', 'No pude detectar tu id de usuario. Vuelve a iniciar sesión.');
      return;
    }

    this.loadUser();
  }

  async loadUser(): Promise<void> {
    if (!this.userId) return;

    this.loading = true;
    try {
      const u = await this.fetchJson<Usuario>(`${this.API_BASE}/user/${this.userId}`);

      this.user = {
        idUsuario: u.idUsuario,
        nombre: u.nombre ?? '',
        email: u.email ?? '',
        password: u.password ?? '',
        curp: u.curp ?? '',
        telefonoCelular: u.telefonoCelular ?? '',
        fotoPerfil: (u as any).fotoPerfil ?? '',
        fotoPortada: (u as any).fotoPortada ?? '',
        tipo: (u as any).tipo ?? null,
        verificado: (u as any).verificado ?? null,
        fechaRegistro: (u as any).fechaRegistro ?? null,
      };

      this.photoUrl = (this.user as any).fotoPerfil ?? '';

      // ✅ aquí está la corrección real
      await this.loadColoniaFromRelacion();

      this.buildSummary();
      await this.loadCounts();
    } catch (e: any) {
      this.showModal('error', 'Error cargando perfil', this.humanError(e));
    } finally {
      this.loading = false;
    }
  }

  // =========================
  // ✅ Colonia: usuarios_colonias -> colonia/{id}
  // =========================
  private async loadColoniaFromRelacion(): Promise<void> {
    if (!this.userId) return;

    // por defecto
    this.coloniaNombre = '—';
    this.coloniaCodigo = '—';

    // 1) trae relaciones user-colonia
    const rels = await this.safeFetchList<UsuariosColonia>(`${this.API_BASE}/allusuarios-colonias`);
    const mine = rels.filter(r => Number(r?.usuarioId) === Number(this.userId));

    if (!mine.length) return;

    // si hay varias, agarra la más reciente por fechaRegistro (si viene)
    const pick = mine
      .slice()
      .sort((a, b) => this.toTime(b.fechaRegistro) - this.toTime(a.fechaRegistro))[0];

    const coloniaId = Number(pick?.coloniaId);
    if (!Number.isFinite(coloniaId) || coloniaId <= 0) return;

    // 2) trae la colonia
    const col = await this.safeFetchJson<Colonia>(`${this.API_BASE}/colonia/${coloniaId}`);
    if (!col) return;

    this.coloniaNombre = (col.nombre ?? '').trim() || '—';
    this.coloniaCodigo = (col.codigoInvitacion ?? '').trim() || '—';
  }

  private toTime(v?: string): number {
    if (!v) return 0;
    const d = new Date(v);
    const t = d.getTime();
    return Number.isFinite(t) ? t : 0;
  }

  private buildSummary(): void {
    const ver = this.user.verificado === true;
    const fecha = this.formatDate(this.user.fechaRegistro);

    this.summaryRows = [
      { label: 'ID de usuario', value: String(this.user.idUsuario || '—') },
      { label: 'Nombre', value: this.user.nombre?.trim() || '—' },
      { label: 'Correo', value: this.user.email?.trim() || '—' },
      { label: 'Teléfono', value: (this.user.telefonoCelular ?? '').trim() || '—' },
      { label: 'CURP', value: (this.user.curp ?? '').trim() || '—' },
      { label: 'Tipo de cuenta', value: (this.user.tipo ?? '').trim() || '—' },
      { label: 'Verificado', value: ver ? 'Sí' : 'No', tone: ver ? 'ok' : 'warn' },
      { label: 'Registro', value: fecha || '—' },

      // ✅ ya sale bien
      { label: 'Colonia', value: this.coloniaNombre || '—' },

      // ✅ bonus: también viene del back y se ve cool en “Datos rápidos”
      { label: 'Código invitación', value: this.coloniaCodigo || '—' },
    ];
  }

  // =========================
  // Conteos recuadros
  // =========================
  private async loadCounts(): Promise<void> {
    if (!this.userId) return;
    const uid = Number(this.userId);

    this.stats = { mascotas: null, posts: null, adopciones: null, solicitudes: null };

    try {
      const [mascotas, posts, adopciones, solicitudes] = await Promise.all([
        this.safeFetchList<MascotaLite>(`${this.API_BASE}/allmascotas`),
        this.safeFetchList<PostLite>(`${this.API_BASE}/allposts`),
        this.safeFetchList<AdopcionLite>(`${this.API_BASE}/alladopciones`),
        this.safeFetchList<SolicitudLite>(`${this.API_BASE}/allsolicitudes-adopcion`),
      ]);

      this.stats.mascotas = mascotas.filter(m => Number(m?.usuarioId) === uid).length;
      this.stats.posts = posts.filter(p => Number(p?.usuarioId) === uid).length;
      this.stats.adopciones = adopciones.filter(a => Number(a?.usuarioPublicadorId) === uid).length;
      this.stats.solicitudes = solicitudes.filter(s => Number(s?.solicitanteId) === uid).length;
    } catch {
      this.stats = { mascotas: null, posts: null, adopciones: null, solicitudes: null };
    }
  }

  // =========================
  // Acciones
  // =========================
  async guardarCambios(): Promise<void> {
    if (!this.userId) return;

    const nombre = (this.user.nombre ?? '').trim();
    const email = (this.user.email ?? '').trim();

    if (!nombre) return this.toast('Pon tu nombre para guardar.', 'bad');
    if (!email || !email.includes('@')) return this.toast('Tu correo se ve raro. Revísalo.', 'bad');

    if (!this.user.password) {
      return this.toast('No pude conservar tu password (viene vacío). Dale “Recargar”.', 'bad');
    }

    this.savingProfile = true;
    try {
      const payload: Partial<Usuario> = {
        nombre,
        email,
        password: this.user.password,
        curp: (this.user.curp ?? '').trim(),
        telefonoCelular: (this.user.telefonoCelular ?? '').trim(),
      };

      const updated = await this.fetchJson<Usuario>(`${this.API_BASE}/update-user/${this.userId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      this.user = { ...this.user, ...updated };

      // refresca colonia por si cambió la relación (o se unió a otra)
      await this.loadColoniaFromRelacion();

      this.buildSummary();
      await this.loadCounts();

      this.toast('Cambios guardados ✨', 'ok');
      this.showModal('success', 'Listo', 'Tu información se actualizó correctamente.');
    } catch (e: any) {
      this.showModal('error', 'No se pudo guardar', this.humanError(e));
    } finally {
      this.savingProfile = false;
    }
  }

  async guardarFoto(): Promise<void> {
    if (!this.userId) return;

    const url = (this.photoUrl ?? '').trim();
    if (!url) return this.toast('Pega una URL de imagen primero.', 'bad');

    this.savingPhoto = true;
    try {
      const updated = await this.fetchJson<Usuario>(`${this.API_BASE}/create-user/photo-profile/${this.userId}`, {
        method: 'PUT',
        body: JSON.stringify({ fotoPerfil: url }),
      });

      (this.user as any).fotoPerfil = (updated as any).fotoPerfil ?? url;
      this.photoUrl = (this.user as any).fotoPerfil ?? url;

      this.buildSummary();
      await this.loadCounts();

      this.toast('Foto guardada ✅', 'ok');
      this.showModal('success', 'Foto actualizada', 'Se actualizó tu foto de perfil.');
    } catch (e: any) {
      this.showModal('error', 'No se pudo guardar la foto', this.humanError(e));
    } finally {
      this.savingPhoto = false;
    }
  }

  // =========================
  // UI helpers
  // =========================
  toast(msg: string, type: 'ok' | 'bad' = 'ok'): void {
    this.toastMsg = msg;
    this.toastType = type;
    this.toastVisible = true;

    window.clearTimeout((this as any).__toastTimer);
    (this as any).__toastTimer = window.setTimeout(() => (this.toastVisible = false), 2400);
  }

  showModal(kind: Exclude<ModalKind, 'none'>, title: string, text: string): void {
    this.modal = kind;
    this.modalTitle = title;
    this.modalText = text;
  }

  closeModal(): void {
    this.modal = 'none';
    this.modalTitle = '';
    this.modalText = '';
  }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    if (this.modal !== 'none') this.closeModal();
  }

  getStat(v: number | null): string {
    return v === null ? '—' : String(v);
  }

  private formatDate(iso?: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  private getLoggedUserId(): number | null {
    const direct = localStorage.getItem('userId') || localStorage.getItem('idUsuario');
    if (direct) {
      const n = Number(direct);
      return Number.isFinite(n) && n > 0 ? n : null;
    }

    const json = localStorage.getItem('usuario') || localStorage.getItem('user');
    if (json) {
      try {
        const obj = JSON.parse(json);
        const id = Number(obj?.idUsuario ?? obj?.id ?? obj?.userId);
        return Number.isFinite(id) && id > 0 ? id : null;
      } catch {
        return null;
      }
    }

    return null;
  }

  // =========================
  // fetch helpers
  // =========================
  private async safeFetchList<T>(url: string): Promise<T[]> {
    try {
      const data = await this.fetchJson<T[]>(url);
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  private async safeFetchJson<T>(url: string): Promise<T | null> {
    try {
      return await this.fetchJson<T>(url);
    } catch {
      return null;
    }
  }

  private async fetchJson<T>(url: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers ?? {}),
      },
    });

    const text = await res.text();
    const data = text ? this.safeJson(text) : null;

    if (!res.ok) {
      const msg = (data && (data.message || data.error)) || `HTTP ${res.status} ${res.statusText}`;
      throw new Error(msg);
    }

    return (data ?? ({} as any)) as T;
  }

  private safeJson(text: string): any {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  private humanError(e: any): string {
    if (!e) return 'Error desconocido';
    if (typeof e === 'string') return e;
    if (e.message) return e.message;
    return 'Ocurrió un error inesperado';
  }
}
