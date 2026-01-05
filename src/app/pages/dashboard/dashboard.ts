import { Component, computed, inject, signal } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { Comment, Like, Post, PostImage, Usuario } from '../../models/api.models';
import { Modal } from '../../components/modal/modal';
import { formatFriendlyDate, toLocalDateString } from '../../utils/date';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [NgFor, NgIf, ReactiveFormsModule, Modal],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);

  busy = signal(false);
  showCreate = signal(false);
  expandedComments = signal<Record<number, boolean>>({});

  posts = signal<Post[]>([]);
  users = signal<Usuario[]>([]);
  likes = signal<Like[]>([]);
  comments = signal<Comment[]>([]);
  images = signal<PostImage[]>([]);

  feed = computed(() =>
    [...this.posts()].sort((a, b) => {
      const da = new Date(a.createdAt || 0).getTime();
      const db = new Date(b.createdAt || 0).getTime();
      return db - da;
    })
  );

  createForm = new FormGroup({
    contenido: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(2)] }),
    imagen: new FormControl('', { nonNullable: true }),
    extraImages: new FormControl('', { nonNullable: true }),
  });

  commentForms = signal<Record<number, FormGroup>>({});

  constructor() {
    this.reload();
  }

  /** Obtiene el id del usuario logueado aunque venga como idUsuario/usuarioId */
  private meId(): number {
    try {
      const me: any = this.auth.requireUser();
      const id = Number(me?.id ?? me?.idUsuario ?? me?.usuarioId ?? 0);
      return Number.isFinite(id) ? id : 0;
    } catch {
      return 0;
    }
  }

  reload(): void {
    this.busy.set(true);
    const done = () => this.busy.set(false);

    this.api.getPosts().subscribe({
      next: (v) => this.posts.set(v || []),
      error: () => this.toast.show('No se pudieron cargar los posts.', 'danger'),
    });
    this.api.getUsers().subscribe({ next: (v) => this.users.set(v || []) });
    this.api.getLikes().subscribe({ next: (v) => this.likes.set(v || []) });
    this.api.getComments().subscribe({ next: (v) => this.comments.set(v || []) });
    this.api.getPostImages().subscribe({ next: (v) => this.images.set(v || []), complete: done, error: done });
  }

  private userIdOf(u: Usuario): number {
    const anyU: any = u as any;
    return Number(anyU.id ?? anyU.idUsuario ?? anyU.usuarioId ?? 0);
  }

  userName(userId: number): string {
    const me = this.meId();
    if (me && userId === me) return 'Tú';
    const u = this.users().find((x) => this.userIdOf(x) === userId);
    const anyU: any = u as any;
    return anyU?.nombre ?? `Usuario #${userId}`;
  }

  userPhoto(userId: number): string | undefined {
    const u = this.users().find((x) => this.userIdOf(x) === userId);
    const anyU: any = u as any;
    return (anyU?.fotoPerfil || anyU?.foto || anyU?.avatarUrl) ?? undefined;
  }

  postImages(postId?: number): PostImage[] {
    if (!postId) return [];
    return this.images().filter((im) => im.postId === postId);
  }

  likesCount(postId?: number): number {
    if (!postId) return 0;
    return this.likes().filter((l) => l.postId === postId).length;
  }

  isLikedByMe(postId?: number): boolean {
    if (!postId) return false;
    const uid = this.meId();
    if (!uid) return false;
    return this.likes().some((l) => l.postId === postId && l.userId === uid);
  }

  commentsFor(postId?: number): Comment[] {
    if (!postId) return [];
    return this.comments().filter((c) => c.postId === postId).slice(-50);
  }

  toggleComments(postId?: number): void {
    if (!postId) return;
    this.expandedComments.update((m) => ({ ...m, [postId]: !m[postId] }));
    if (!this.commentForms()[postId]) {
      this.commentForms.update((m) => ({
        ...m,
        [postId]: new FormGroup({
          contenido: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(1)] }),
        }),
      }));
    }
  }

  format(dateLike?: string): string {
    return formatFriendlyDate(dateLike);
  }

  async toggleLike(post: Post): Promise<void> {
    if (!post.id) return;

    const uid = this.meId();
    if (!uid) {
      this.toast.show('Sesión inválida: no se encontró idUsuario.', 'danger');
      return;
    }

    const existing = this.likes().find((l) => l.postId === post.id && l.userId === uid);

    // Quitar like
    if (existing?.id) {
      this.api.deleteLike(existing.id).subscribe({
        next: () => {
          this.likes.update((arr) => arr.filter((x) => x.id !== existing.id));
        },
        error: () => this.toast.show('No se pudo quitar el like.', 'danger'),
      });
      return;
    }

    // Dar like
    this.api.createLike({ postId: post.id, userId: uid }).subscribe({
      next: (created) => {
        this.likes.update((arr) => [created, ...arr]);
      },
      error: () => this.toast.show('No se pudo dar like.', 'danger'),
    });
  }

  submitComment(postId: number): void {
    const form = this.commentForms()[postId];
    if (!form || form.invalid) {
      form?.markAllAsTouched();
      return;
    }

    const uid = this.meId();
    if (!uid) {
      this.toast.show('Sesión inválida: no se encontró idUsuario.', 'danger');
      return;
    }

    const body: Comment = {
      postId,
      userId: uid,
      contenido: form.value.contenido!,
    };

    this.api.createComment(body).subscribe({
      next: (created) => {
        this.comments.update((arr) => [...arr, created]);
        form.reset({ contenido: '' });
      },
      error: () => this.toast.show('No se pudo comentar.', 'danger'),
    });
  }

  openCreate(): void {
    this.createForm.reset({ contenido: '', imagen: '', extraImages: '' });
    this.showCreate.set(true);
  }

  createPost(): void {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }

    const uid = this.meId();
    if (!uid) {
      this.toast.show('Sesión inválida: no se encontró idUsuario.', 'danger');
      return;
    }

    const contenido = this.createForm.value.contenido!;
    const imagen = (this.createForm.value.imagen || '').trim() || null;
    const extra = (this.createForm.value.extraImages || '')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 6);

    const body: Post = {
      contenido,
      imagen,
      usuarioId: uid,
      coloniaId: null,
      createdAt: toLocalDateString(),
    };

    this.api.createPost(body).subscribe({
      next: (created) => {
        this.posts.update((arr) => [created, ...arr]);

        // extra images as post_images
        if (created.id && extra.length) {
          extra.forEach((url) => {
            this.api.createPostImage({ postId: created.id!, usuarioId: uid, imagePath: url }).subscribe({
              next: (im) => this.images.update((arr) => [im, ...arr]),
            });
          });
        }

        this.toast.show('Post publicado.', 'success');
        this.showCreate.set(false);
      },
      error: () => this.toast.show('No se pudo publicar.', 'danger'),
    });
  }
}
