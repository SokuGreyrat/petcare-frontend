import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';


import { AuthService } from '../../services/auth.service';

import { ChangeDetectorRef } from '@angular/core';


type Usuario = {
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
  fechaRegistro?: string;
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
private readonly API_BASE = `${environment.apiUrl.replace(/\/$/, '')}/api/petcare`;
  private auth = inject(AuthService);
  private readonly LS_SESSION = 'petcare.session.v1';
  private cdr = inject(ChangeDetectorRef);


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

  // ✅ lo que se muestra/edita en el form
  user: Usuario = {
    idUsuario: 0,
    nombre: '',
    email: '',
    password: '',
    curp: '',
    telefonoCelular: '',
    fotoPerfil: '',
  };

  // ✅ RAW desde BD (lo usamos para el resumen)
  private userDbRaw: any | null = null;

  photoUrl = '';

  summaryRows: SummaryRow[] = [];

  stats: { mascotas: number | null; posts: number | null; adopciones: number | null; solicitudes: number | null } = {
    mascotas: null,
    posts: null,
    adopciones: null,
    solicitudes: null,
  };

  coloniaNombre: string = '—';
  coloniaCodigo: string = '—';

  ngOnInit(): void {
    this.userId = this.getLoggedUserId();

    if (!this.userId) {
      this.showModal('error', 'Sesión no encontrada', 'No pude detectar tu id de usuario. Vuelve a iniciar sesión.');
      return;
    }

    this.reloadFromDb();
  }

  loadUser(): void {
  void this.reloadFromDb();
}
  // =====================================================
  // ✅ Cargar TODO desde BD
  // =====================================================
  async reloadFromDb(): Promise<void> {
    if (!this.userId) return;

    this.loading = true;
    try {
      // 1) Usuario desde BD
      const raw = await this.fetchJson<any>(`${this.API_BASE}/user/${this.userId}`);
      this.userDbRaw = raw;

      // 2) Normaliza para el form (sin inventar datos)
      this.user = this.normalizeUserFromDb(raw);

      // 3) Foto en input (solo BD)
      this.photoUrl = (this.user.fotoPerfil ?? '').trim();

      // 4) Colonia desde BD
      await this.loadColoniaFromRelacion();

      // 5) Resumen (solo BD)
      this.buildSummaryFromDb();

      // 6) Conteos
      await this.loadCounts();
    } catch (e: any) {
      this.showModal('error', 'Error cargando perfil', this.humanError(e));
    } finally {
      this.loading = false;
    }
  }

  private normalizeUserFromDb(raw: any): Usuario {
    const idUsuario = Number(raw?.idUsuario ?? raw?.id ?? this.userId ?? 0);

    const nombre = this.pickString(raw?.nombre, raw?.name) ?? '';
    const email = this.pickString(raw?.email, raw?.correo) ?? '';

    // ⚠️ password normalmente NO viene desde BD por seguridad → lo dejamos vacío en UI
    // pero lo tomaremos de sesión SOLO al momento de hacer PUT (guardarCambios/guardarFoto)
    const password = this.pickString(raw?.password) ?? '';

    const curp = this.pickString(raw?.curp) ?? '';
    const tel = this.pickString(raw?.telefonoCelular, raw?.telefono_celular, raw?.telefono, raw?.celular) ?? '';

    const fotoPerfil =
      this.pickString(raw?.fotoPerfil, raw?.foto_perfil, raw?.photoProfile, raw?.photo) ?? '';

    const fotoPortada =
      this.pickString(raw?.fotoPortada, raw?.foto_portada, raw?.cover) ?? '';

    const tipo = this.pickString(raw?.tipo, raw?.rol, raw?.role) ?? null;

    const verificado =
      typeof raw?.verificado === 'boolean'
        ? raw.verificado
        : raw?.verificado === 1 || raw?.verificado === '1'
          ? true
          : raw?.verificado === 0 || raw?.verificado === '0'
            ? false
            : null;

    const fechaRegistro =
      this.pickString(raw?.fechaRegistro, raw?.fecha_registro, raw?.createdAt, raw?.created_at) ?? null;

    return {
      idUsuario: Number.isFinite(idUsuario) ? idUsuario : 0,
      id: raw?.id,
      nombre,
      email,
      password,
      curp,
      telefonoCelular: tel,
      fotoPerfil,
      fotoPortada,
      tipo,
      verificado,
      fechaRegistro,
    };
  }

  // =========================
  // ✅ Colonia (BD)
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

  // =========================
  // ✅ Resumen SOLO con BD
  // =========================
  private buildSummaryFromDb(): void {
    const raw = this.userDbRaw ?? {};
    const idMostrado = Number(raw?.idUsuario ?? raw?.id ?? this.userId ?? 0) || 0;

    const nombre = this.pickString(raw?.nombre, raw?.name) ?? '';
    const email = this.pickString(raw?.email, raw?.correo) ?? '';

    const tel =
      this.pickString(raw?.telefonoCelular, raw?.telefono_celular, raw?.telefono, raw?.celular) ?? '';

    const curp = this.pickString(raw?.curp) ?? '';
    const tipo = this.pickString(raw?.tipo, raw?.rol, raw?.role) ?? '';

    const verificado =
      typeof raw?.verificado === 'boolean'
        ? raw.verificado
        : raw?.verificado === 1 || raw?.verificado === '1'
          ? true
          : false;

    const fechaRegistro = this.pickString(raw?.fechaRegistro, raw?.fecha_registro, raw?.createdAt, raw?.created_at);
    const fecha = this.formatDate(fechaRegistro ?? null);

    this.summaryRows = [
      { label: 'ID de usuario', value: idMostrado ? String(idMostrado) : '—' },
      { label: 'Nombre', value: nombre.trim() || '—' },
      { label: 'Correo', value: email.trim() || '—' },
      { label: 'Teléfono', value: tel.trim() || '—' },
      { label: 'CURP', value: curp.trim() || '—' },
      { label: 'Tipo de cuenta', value: tipo.trim() || '—' },
      { label: 'Verificado', value: verificado ? 'Sí' : 'No', tone: verificado ? 'ok' : 'warn' },
      { label: 'Registro', value: fecha || '—' },
      { label: 'Colonia', value: this.coloniaNombre || '—' },
      { label: 'Código invitación', value: this.coloniaCodigo || '—' },
    ];
    this.cdr.detectChanges();
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

    // ✅ password solo para el PUT (si el backend lo exige)
    const pass = this.ensurePasswordForUpdate();
    if (!pass) return this.toast('No tengo tu password para guardar cambios. Cierra sesión e inicia de nuevo.', 'bad');

    this.savingProfile = true;
    try {
      const payload: Partial<Usuario> = {
        nombre,
        email,
        password: pass,
        curp: (this.user.curp ?? '').trim(),
        telefonoCelular: (this.user.telefonoCelular ?? '').trim(),
      };

      await this.fetchJson<Usuario>(`${this.API_BASE}/update-user/${this.userId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      // ✅ importante: recarga desde BD para que el resumen sea 100% real
      await this.reloadFromDb();

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

  const pass = this.ensurePasswordForUpdate();
  if (!pass) return this.toast('No tengo tu password para guardar la foto. Cierra sesión e inicia de nuevo.', 'bad');

  this.savingPhoto = true;
  try {
    // ✅ manda TODO para que el backend no “borre” campos ni rompa por null
    const payload: any = {
      idUsuario: this.userId,                 // por si el back lo necesita
      nombre: (this.user.nombre ?? '').trim(),
      email: (this.user.email ?? '').trim(),
      password: pass,
      curp: (this.user.curp ?? '').trim(),
      telefonoCelular: (this.user.telefonoCelular ?? '').trim(),
      fotoPerfil: url,

      // opcionales (solo si existen)
      tipo: this.user.tipo ?? undefined,
      verificado: this.user.verificado ?? undefined,
      fechaRegistro: this.user.fechaRegistro ?? undefined,
    };

    // limpia undefined para no ensuciar el JSON
    Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

    await this.fetchJson(`${this.API_BASE}/update-user/${this.userId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });

    // ✅ recarga desde BD para confirmar que quedó guardada
    await this.reloadFromDb();

    this.toast('Foto guardada ✅', 'ok');
    this.showModal('success', 'Foto actualizada', 'Se actualizó tu foto de perfil.');
  } catch (e: any) {
    this.showModal('error', 'No se pudo guardar la foto', this.humanError(e));
  } finally {
    this.savingPhoto = false;
  }
}


  private ensurePasswordForUpdate(): string | null {
    // si ya lo tienes en memoria
    if (this.user?.password?.trim()) return this.user.password.trim();

    // si no, lo tomamos de sesión (solo para PUT)
    const session = this.readSessionUser();
    const sessionPassword = this.pickString(session?.password, (session as any)?.pass);
    if (sessionPassword) return sessionPassword;

    return null;
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

  // ✅ SOLO sesión real / AuthService
  private getLoggedUserId(): number | null {
    // 1) AuthService
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

  private withTs(url: string): string {
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}_ts=${Date.now()}`;
  }

  private async fetchJson<T>(url: string, options: RequestInit = {}): Promise<T> {
    const method = (options.method ?? 'GET').toUpperCase();

    const finalUrl = method === 'GET' ? this.withTs(url) : url;

    const res = await fetch(finalUrl, {
      ...options,
      cache: method === 'GET' ? 'no-store' : options.cache,
      headers: {
        'Content-Type': 'application/json',
        ...(method === 'GET' ? { 'Cache-Control': 'no-store' } : {}),
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
