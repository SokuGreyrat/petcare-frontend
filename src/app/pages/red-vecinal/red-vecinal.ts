import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { forkJoin, Observable } from 'rxjs';

interface Colonia {
  id: number;
  nombre: string;
  codigoInvitacion: string;
  userId: number; // dueño/creador (backend colonias)
}

interface UsuarioColonia {
  id: number;
  usuarioId: number; // backend usuarios_colonias
  coloniaId: number;
  fechaRegistro: string;
}

interface Usuario {
  idUsuario: number;
  nombre: string;
  email: string;
  fotoPerfil?: string | null;
}

interface PostColonia {
  id: number;
  usuarioId: number; // backend posts_colonia
  coloniaId: number;
  contenido: string;
  fechaCreacion: string;
  esAlerta?: boolean | null;
}

interface LikeColonia {
  id: number;
  userId: number; // backend likes_colonia
  postColoniaId: number;
  fechaCreacion: string;
}

interface CommentColonia {
  id: number;
  postColoniaId: number;
  userId: number;
  contenido: string;
  fechaCreacion: string;
}

type PostVM = PostColonia & {
  autorNombre: string;
  likesCount: number;
  commentsCount: number;
  yoLike: boolean;
};

@Component({
  selector: 'app-red-vecinal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './red-vecinal.html',
  styleUrl: './red-vecinal.css',
})
export class RedVecinal implements OnInit {
  private readonly base = '/api/petcare';

  // sesión
  userId: number | null = null;
  userNombre = 'Usuario';

  // loading
  loading = true;

  // data
  colonias: Colonia[] = [];
  usuariosColonias: UsuarioColonia[] = [];
  users: Usuario[] = [];

  postsAll: PostColonia[] = [];
  likesAll: LikeColonia[] = [];
  commentsAll: CommentColonia[] = [];

  // derivados
  misColonias: Colonia[] = [];
  coloniaActivaId: number | null = null;
  coloniaActiva: Colonia | null = null;

  posts: PostVM[] = [];

  // UI
  toastVisible = false;
  toastMsg = '';

  modalCrearColonia = false;
  modalUnirme = false;
  modalNuevoPost = false;

  // forms
  crearNombre = '';
  crearCodigo = '';

  unirmeCodigo = '';

  postContenido = '';
  postEsAlerta = false;

  // comentarios
  mostrarComentarios: Record<number, boolean> = {};
  nuevoComentario: Record<number, string> = {};

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    const u = this.getUserFromStorage();
    if (!u?.id) {
      this.loading = false;
      this.toast('No detecté sesión (idUsuario). Revisa tu login/localStorage.');
      return;
    }

    this.userId = u.id;
    this.userNombre = u.nombre || 'Usuario';

    this.crearCodigo = this.generarCodigoInvitacion();

    const last = localStorage.getItem('rv_colonia_activa');
    this.coloniaActivaId = last ? Number(last) : null;

    this.cargarTodo();
  }

  // =======================
  // API (todo aquí mismo)
  // =======================
  private apiGetColonias(): Observable<Colonia[]> {
    return this.http.get<Colonia[]>(`${this.base}/allcolonias`);
  }

  private apiCreateColonia(payload: Pick<Colonia, 'nombre' | 'codigoInvitacion' | 'userId'>): Observable<Colonia> {
    // IMPORTANTE: backend colonias exige userId (NOT NULL)
    return this.http.post<Colonia>(`${this.base}/create-colonia`, payload);
  }

  private apiGetUsuariosColonias(): Observable<UsuarioColonia[]> {
    return this.http.get<UsuarioColonia[]>(`${this.base}/allusuarios-colonias`);
  }

  private apiCreateUsuarioColonia(payload: { usuarioId: number; coloniaId: number }): Observable<UsuarioColonia> {
    return this.http.post<UsuarioColonia>(`${this.base}/create-usuarios-colonias`, payload);
  }

  private apiGetAllUsers(): Observable<Usuario[]> {
    return this.http.get<Usuario[]>(`${this.base}/allusers`);
  }

  private apiGetPosts(): Observable<PostColonia[]> {
    return this.http.get<PostColonia[]>(`${this.base}/allposts-colonia`);
  }

  private apiCreatePost(payload: { usuarioId: number; coloniaId: number; contenido: string; esAlerta: boolean }): Observable<PostColonia> {
    return this.http.post<PostColonia>(`${this.base}/create-post-colonia`, payload);
  }

  private apiGetLikes(): Observable<LikeColonia[]> {
    return this.http.get<LikeColonia[]>(`${this.base}/alllikes-colonia`);
  }

  private apiCreateLike(payload: { userId: number; postColoniaId: number }): Observable<LikeColonia> {
    return this.http.post<LikeColonia>(`${this.base}/create-likes-colonia`, payload);
  }

  private apiDeleteLike(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/delete-likes-colonia/${id}`);
  }

  private apiGetComments(): Observable<CommentColonia[]> {
    return this.http.get<CommentColonia[]>(`${this.base}/allcomments-colonia`);
  }

  private apiCreateComment(payload: { userId: number; postColoniaId: number; contenido: string }): Observable<CommentColonia> {
    return this.http.post<CommentColonia>(`${this.base}/create-comment-colonia`, payload);
  }

  // =======================
  // Carga
  // =======================
  cargarTodo(): void {
    this.loading = true;

    forkJoin({
      colonias: this.apiGetColonias(),
      usuariosColonias: this.apiGetUsuariosColonias(),
      users: this.apiGetAllUsers(),
      posts: this.apiGetPosts(),
      likes: this.apiGetLikes(),
      comments: this.apiGetComments(),
    }).subscribe({
      next: (r) => {
        this.colonias = r.colonias ?? [];
        this.usuariosColonias = r.usuariosColonias ?? [];
        this.users = r.users ?? [];
        this.postsAll = r.posts ?? [];
        this.likesAll = r.likes ?? [];
        this.commentsAll = r.comments ?? [];

        this.recalcularMisColonias();
        this.setColoniaActivaInicial();
        this.recalcularFeed();

        this.loading = false;
      },
      error: (err) => {
        console.error(err);
        this.loading = false;
        this.toast('Error cargando Red Vecinal. Revisa consola/backend.');
      },
    });
  }

  recalcularMisColonias(): void {
    const uid = this.userId;
    if (uid == null) return;

    const ids = new Set<number>();

    // colonias donde soy dueño
    for (const c of this.colonias) {
      if (c.userId === uid) ids.add(c.id);
    }

    // colonias donde estoy unido
    for (const uc of this.usuariosColonias) {
      if (uc.usuarioId === uid) ids.add(uc.coloniaId);
    }

    this.misColonias = this.colonias.filter((c) => ids.has(c.id));
  }

  setColoniaActivaInicial(): void {
    if (this.coloniaActivaId != null && this.misColonias.some((c) => c.id === this.coloniaActivaId)) {
      this.coloniaActiva = this.misColonias.find((c) => c.id === this.coloniaActivaId) || null;
      return;
    }

    if (this.misColonias.length > 0) {
      this.setColoniaActiva(this.misColonias[0].id);
    } else {
      this.coloniaActivaId = null;
      this.coloniaActiva = null;
    }
  }

  setColoniaActiva(id: number): void {
    this.coloniaActivaId = id;
    localStorage.setItem('rv_colonia_activa', String(id));
    this.coloniaActiva = this.misColonias.find((c) => c.id === id) || null;
    this.recalcularFeed();
  }

  recalcularFeed(): void {
    const uid = this.userId;
    const coloniaId = this.coloniaActivaId;

    if (uid == null || coloniaId == null) {
      this.posts = [];
      return;
    }

    const userMap = new Map<number, string>();
    for (const u of this.users) userMap.set(u.idUsuario, u.nombre);

    const posts = this.postsAll
      .filter((p) => p.coloniaId === coloniaId)
      .sort((a, b) => (b.id ?? 0) - (a.id ?? 0));

    const likesByPost = new Map<number, LikeColonia[]>();
    for (const l of this.likesAll) {
      const arr = likesByPost.get(l.postColoniaId) || [];
      arr.push(l);
      likesByPost.set(l.postColoniaId, arr);
    }

    const commentsByPost = new Map<number, CommentColonia[]>();
    for (const c of this.commentsAll) {
      const arr = commentsByPost.get(c.postColoniaId) || [];
      arr.push(c);
      commentsByPost.set(c.postColoniaId, arr);
    }

    this.posts = posts.map((p) => {
      const likes = likesByPost.get(p.id) || [];
      const comms = commentsByPost.get(p.id) || [];

      return {
        ...p,
        autorNombre: userMap.get(p.usuarioId) || `Usuario #${p.usuarioId}`,
        likesCount: likes.length,
        commentsCount: comms.length,
        yoLike: likes.some((l) => l.userId === uid),
      };
    });
  }

  // =======================
  // Crear / Unirme
  // =======================
  abrirCrearColonia(): void {
    this.crearNombre = '';
    this.crearCodigo = this.generarCodigoInvitacion();
    this.modalCrearColonia = true;
  }

  abrirUnirme(): void {
    this.unirmeCodigo = '';
    this.modalUnirme = true;
  }

  crearColonia(): void {
    const uid = this.userId;
    if (uid == null) return;

    const nombre = (this.crearNombre || '').trim();
    if (!nombre) return this.toast('Ponle un nombre a la colonia.');

    let codigo = (this.crearCodigo || '').trim().toUpperCase();
    if (!codigo) codigo = this.generarCodigoInvitacion();

    // evitar código repetido (UNIQUE)
    const usados = new Set(this.colonias.map((c) => (c.codigoInvitacion || '').toUpperCase()));
    let intentos = 0;
    while (usados.has(codigo) && intentos < 10) {
      codigo = this.generarCodigoInvitacion();
      intentos++;
    }

    this.apiCreateColonia({ nombre, codigoInvitacion: codigo, userId: uid }).subscribe({
      next: (col) => {
        this.toast('Colonia creada ✅');
        this.modalCrearColonia = false;

        this.colonias = [col, ...this.colonias];
        this.recalcularMisColonias();
        this.setColoniaActiva(col.id);

        // (opcional) crear membresía si no existe
        const ya = this.usuariosColonias.some((uc) => uc.usuarioId === uid && uc.coloniaId === col.id);
        if (!ya) {
          this.apiCreateUsuarioColonia({ usuarioId: uid, coloniaId: col.id }).subscribe({
            next: (uc) => {
              this.usuariosColonias = [uc, ...this.usuariosColonias];
              this.recalcularMisColonias();
            },
            error: () => {},
          });
        }
      },
      error: (err) => {
        console.error(err);
        this.toast('No se pudo crear. Asegúrate que mandas userId y que el código no se repite.');
      },
    });
  }

  unirmeColonia(): void {
    const uid = this.userId;
    if (uid == null) return;

    const codigo = (this.unirmeCodigo || '').trim().toUpperCase();
    if (!codigo) return this.toast('Escribe el código de invitación.');

    const col = this.colonias.find((c) => (c.codigoInvitacion || '').toUpperCase() === codigo);
    if (!col) return this.toast('Ese código no existe.');

    const yaSoyDuenio = col.userId === uid;
    const yaEstoy = this.usuariosColonias.some((uc) => uc.usuarioId === uid && uc.coloniaId === col.id);

    this.modalUnirme = false;

    if (yaSoyDuenio || yaEstoy) {
      this.toast('Ya estás en esa colonia 👍');
      this.recalcularMisColonias();
      this.setColoniaActiva(col.id);
      return;
    }

    this.apiCreateUsuarioColonia({ usuarioId: uid, coloniaId: col.id }).subscribe({
      next: (uc) => {
        this.toast('Te uniste ✅');
        this.usuariosColonias = [uc, ...this.usuariosColonias];
        this.recalcularMisColonias();
        this.setColoniaActiva(col.id);
      },
      error: (err) => {
        console.error(err);
        this.toast('No se pudo unir. Revisa el backend/DB.');
      },
    });
  }

  // =======================
  // Posts
  // =======================
  abrirNuevoPost(): void {
    if (this.coloniaActivaId == null) return this.toast('Primero selecciona una colonia.');
    this.postContenido = '';
    this.postEsAlerta = false;
    this.modalNuevoPost = true;
  }

  publicarPost(): void {
    const uid = this.userId;
    const coloniaId = this.coloniaActivaId;

    if (uid == null || coloniaId == null) return;

    const contenido = (this.postContenido || '').trim();
    if (!contenido) return this.toast('Escribe algo antes de publicar.');

    this.apiCreatePost({
      usuarioId: uid,
      coloniaId: coloniaId,
      contenido,
      esAlerta: !!this.postEsAlerta,
    }).subscribe({
      next: (p) => {
        this.toast('Publicado ✅');
        this.modalNuevoPost = false;
        this.postsAll = [p, ...this.postsAll];
        this.recalcularFeed();
      },
      error: (err) => {
        console.error(err);
        this.toast('No se pudo publicar. Revisa que mandas usuarioId/coloniaId.');
      },
    });
  }

  // =======================
  // Likes
  // =======================
  toggleLike(postId: number): void {
    const uid = this.userId;
    if (uid == null) return;

    const existente = this.likesAll.find((l) => l.postColoniaId === postId && l.userId === uid);

    if (existente) {
      this.apiDeleteLike(existente.id).subscribe({
        next: () => {
          this.likesAll = this.likesAll.filter((l) => l.id !== existente.id);
          this.recalcularFeed();
        },
        error: (err) => {
          console.error(err);
          this.toast('No se pudo quitar like.');
        },
      });
      return;
    }

    this.apiCreateLike({ userId: uid, postColoniaId: postId }).subscribe({
      next: (l) => {
        this.likesAll = [l, ...this.likesAll];
        this.recalcularFeed();
      },
      error: (err) => {
        console.error(err);
        this.toast('No se pudo dar like.');
      },
    });
  }

  // =======================
  // Comentarios
  // =======================
  toggleComentarios(postId: number): void {
    this.mostrarComentarios[postId] = !this.mostrarComentarios[postId];
  }

  getComentariosDe(postId: number): CommentColonia[] {
    return this.commentsAll
      .filter((c) => c.postColoniaId === postId)
      .sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
  }

  nombreDeUser(id: number): string {
    const u = this.users.find((x) => x.idUsuario === id);
    return u?.nombre || `Usuario #${id}`;
  }

  comentar(postId: number): void {
    const uid = this.userId;
    if (uid == null) return;

    const texto = (this.nuevoComentario[postId] || '').trim();
    if (!texto) return;

    this.apiCreateComment({ userId: uid, postColoniaId: postId, contenido: texto }).subscribe({
      next: (c) => {
        this.nuevoComentario[postId] = '';
        this.commentsAll = [...this.commentsAll, c];
        this.recalcularFeed();
      },
      error: (err) => {
        console.error(err);
        this.toast('No se pudo comentar.');
      },
    });
  }

  // =======================
  // UI helpers
  // =======================
  closeModals(): void {
    this.modalCrearColonia = false;
    this.modalUnirme = false;
    this.modalNuevoPost = false;
  }

  toast(msg: string): void {
    this.toastMsg = msg;
    this.toastVisible = true;
    setTimeout(() => (this.toastVisible = false), 2500);
  }

  generarCodigoInvitacion(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let out = '';
    for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  }

  private getUserFromStorage(): { id: number; nombre?: string } | null {
    // ajusta aquí si tu login guarda con otro key/estructura
    const keys = ['user', 'usuario', 'currentUser', 'sessionUser'];
    for (const k of keys) {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      try {
        const obj = JSON.parse(raw);
        const id = Number(obj?.idUsuario ?? obj?.id ?? obj?.userId ?? obj?.usuarioId);
        if (!Number.isFinite(id) || id <= 0) continue;
        const nombre = obj?.nombre ?? obj?.name ?? obj?.username ?? '';
        return { id, nombre };
      } catch {}
    }

    const rawId = localStorage.getItem('userId') || localStorage.getItem('idUsuario');
    if (rawId && Number(rawId) > 0) return { id: Number(rawId), nombre: '' };

    return null;
  }
}
