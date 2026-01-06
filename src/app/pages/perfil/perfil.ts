import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AuthService } from '../../services/auth.service';

type Usuario = {
  // el backend a veces manda idUsuario o id
  idUsuario: number;
  id?: number;
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

  private auth = inject(AuthService);
  private readonly LS_SESSION = 'petcare.session.v1';

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
    // ✅ SOLO usamos la sesión general / AuthService. NO creamos userId/idUsuario en localStorage.
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
      const session = this.readSessionUser();
      const sessionPassword = this.pickString(session?.password, (session as any)?.pass);
      const sessionFoto = this.pickString(session?.fotoPerfil, (session as any)?.foto_perfil, (session as any)?.photo);

      const u = await this.fetchJson<Usuario>(`${this.API_BASE}/user/${this.userId}`);

      this.user = {
        idUsuario: (u as any).idUsuario ?? (u as any).id ?? this.userId,
        nombre: u.nombre ?? '',
        email: u.email ?? '',
        // muchos backends NO regresan password por seguridad → lo conservamos de sesión
        password: (u as any).password ?? sessionPassword ?? '',
        curp: u.curp ?? '',
        telefonoCelular: u.telefonoCelular ?? '',
        fotoPerfil:
          this.pickString(
            (u as any).fotoPerfil,
            (u as any).foto_perfil,
            (u as any).photoProfile,
            (u as any).photo,
            sessionFoto,
          ) ?? '',
        fotoPortada: (u as any).fotoPortada ?? '',
        tipo: (u as any).tipo ?? null,
        verificado: (u as any).verificado ?? null,
        fechaRegistro: (u as any).fechaRegistro ?? null,
      };

      this.photoUrl = (this.user as any).fotoPerfil ?? '';

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

    this.coloniaNombre = '—';
    this.coloniaCodigo = '—';

    const rels = await this.safeFetchList<UsuariosColonia>(`${this.API_BASE}/allusuarios-colonias`);
    const mine = rels.filter((r) => Number(r?.usuarioId) === Number(this.userId));
    if (!mine.length) return;

    const pick = mine
      .slice()
      .sort((a, b) => this.toTime(b.fechaRegistro) - this.toTime(a.fechaRegistro))[0];

    const coloniaId = Number(pick?.coloniaId);
    if (!Number.isFinite(coloniaId) || coloniaId <= 0) return;

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

    const idMostrado = this.userId ?? (this.user as any)?.id ?? this.user.idUsuario;

    this.summaryRows = [
      { label: 'ID de usuario', value: String(idMostrado || '—') },
      { label: 'Nombre', value: this.user.nombre?.trim() || '—' },
      { label: 'Correo', value: this.user.email?.trim() || '—' },
      { label: 'Teléfono', value: (this.user.telefonoCelular ?? '').trim() || '—' },
      { label: 'CURP', value: (this.user.curp ?? '').trim() || '—' },
      { label: 'Tipo de cuenta', value: (this.user.tipo ?? '').trim() || '—' },
      { label: 'Verificado', value: ver ? 'Sí' : 'No', tone: ver ? 'ok' : 'warn' },
      { label: 'Registro', value: fecha || '—' },
      { label: 'Colonia', value: this.coloniaNombre || '—' },
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

      this.stats.mascotas = mascotas.filter((m) => Number(m?.usuarioId) === uid).length;
      this.stats.posts = posts.filter((p) => Number(p?.usuarioId) === uid).length;
      this.stats.adopciones = adopciones.filter((a) => Number(a?.usuarioPublicadorId) === uid).length;
      this.stats.solicitudes = solicitudes.filter((s) => Number(s?.solicitanteId) === uid).length;
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

    // el back puede no regresar password; lo tomamos de sesión si falta
    if (!this.user.password) {
      const session = this.readSessionUser();
      const sessionPassword = this.pickString(session?.password, (session as any)?.pass);
      if (sessionPassword) this.user.password = sessionPassword;
    }

    if (!this.user.password) {
      return this.toast('No tengo tu password para guardar cambios. Cierra sesión e inicia de nuevo.', 'bad');
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

      const merged: any = { ...this.user, ...updated };
      merged.idUsuario = merged.idUsuario ?? merged.id ?? this.userId;
      merged.fotoPerfil =
        this.pickString(merged.fotoPerfil, merged.foto_perfil, (updated as any)?.fotoPerfil) ?? this.user.fotoPerfil;
      merged.password = this.user.password; // no sobreescribimos con vacío

      this.user = merged as Usuario;

      this.patchSessionUser({
        id: (this.user as any).id ?? this.user.idUsuario,
        nombre: this.user.nombre,
        email: this.user.email,
        password: this.user.password,
        curp: this.user.curp ?? '',
        telefonoCelular: this.user.telefonoCelular ?? '',
        fotoPerfil: (this.user as any).fotoPerfil ?? '',
      });

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

    // Asegura password si el backend lo exige en update-user
    if (!this.user.password) {
      const session = this.readSessionUser();
      const sessionPassword = this.pickString(session?.password, (session as any)?.pass);
      if (sessionPassword) this.user.password = sessionPassword;
    }

    if (!this.user.password) {
      return this.toast('No tengo tu password para guardar la foto. Cierra sesión e inicia de nuevo.', 'bad');
    }

    this.savingPhoto = true;
    try {
      // ✅ En vez de create-user/photo-profile (que te daba 403), lo guardamos con update-user
      const payload: Partial<Usuario> = {
        password: this.user.password,
        fotoPerfil: url,
      };

      const updated = await this.fetchJson<Usuario>(`${this.API_BASE}/update-user/${this.userId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      const foto = this.pickString(
        (updated as any)?.fotoPerfil,
        (updated as any)?.foto_perfil,
        (updated as any)?.photoProfile,
        url,
      );

      (this.user as any).fotoPerfil = foto ?? url;
      this.photoUrl = (this.user as any).fotoPerfil ?? url;

      this.patchSessionUser({ fotoPerfil: (this.user as any).fotoPerfil ?? url });

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

  // ✅ SOLO sesión general / auth. Sin leer userId/idUsuario “viejos”.
  private getLoggedUserId(): number | null {
    // 1) AuthService (si existe)
    try {
      const u: any = (this.auth as any)?.user?.();
      const id = Number(u?.id ?? u?.idUsuario);
      if (Number.isFinite(id) && id > 0) return id;
    } catch {
      // ignore
    }

    // 2) localStorage petcare.session.v1
    const session = this.readSessionUser();
    const sid = Number((session as any)?.id ?? (session as any)?.idUsuario);
    return Number.isFinite(sid) && sid > 0 ? sid : null;
  }

  private readSessionUser(): any | null {
    try {
      const raw = localStorage.getItem(this.LS_SESSION);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }

  private patchSessionUser(patch: Record<string, any>): void {
    try {
      const current = this.readSessionUser();
      if (!current) return;
      const next = { ...current, ...patch };
      localStorage.setItem(this.LS_SESSION, JSON.stringify(next));

      // también actualiza el AuthService para que todo el app vea el cambio
      const id = Number(next?.id ?? next?.idUsuario);
      if (Number.isFinite(id) && id > 0) {
        this.auth.setUser(next);
      }
    } catch {
      // ignore
    }
  }

  private pickString(...vals: any[]): string | null {
    for (const v of vals) {
      if (v === undefined || v === null) continue;
      const s = String(v).trim();
      if (s) return s;
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
