import { Component, computed, inject, signal } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import {
  Colonia,
  CommentColonia,
  LikeColonia,
  PostColonia,
  PostColoniaImage,
  Usuario,
  UsuarioColonia,
} from '../../models/api.models';
import { Modal } from '../../components/modal/modal';
import { formatFriendlyDate, toLocalDateString } from '../../utils/date';
import { randomCode } from '../../utils/random';

@Component({
  selector: 'app-red-vecinal',
  standalone: true,
  imports: [NgFor, NgIf, ReactiveFormsModule, Modal],
  templateUrl: './red-vecinal.html',
  styleUrl: './red-vecinal.css',
})
export class RedVecinal {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);

  busy = signal(false);
  showCreate = signal(false);
  showJoin = signal(false);

  colonias = signal<Colonia[]>([]);
  usuariosColonias = signal<UsuarioColonia[]>([]);
  usuarios = signal<Usuario[]>([]);

  posts = signal<PostColonia[]>([]);
  postImages = signal<PostColoniaImage[]>([]);
  comments = signal<CommentColonia[]>([]);
  likes = signal<LikeColonia[]>([]);

  selectedColoniaId = signal<number | null>(null);
  expandedComments = signal<Record<number, boolean>>({});
  commentForms = signal<Record<number, FormGroup>>({});

  me = computed(() => this.auth.requireUser());

  myColonias = computed(() => {
    const me = this.me();
    const memberIds = new Set(this.usuariosColonias().filter((uc) => uc.usuarioId === me.id).map((uc) => uc.coloniaId));
    const ownedIds = new Set(this.colonias().filter((c) => c.userId === me.id).map((c) => c.id));
    const ids = new Set<number>();
    for (const id of memberIds) ids.add(id);
    for (const id of ownedIds) if (id) ids.add(id);
    return this.colonias().filter((c) => c.id && ids.has(c.id));
  });

  selectedColonia = computed(() => this.myColonias().find((c) => c.id === this.selectedColoniaId()) || null);

  feed = computed(() => {
    const id = this.selectedColoniaId();
    if (!id) return [];
    return [...this.posts().filter((p) => p.coloniaId === id)].sort((a, b) => {
      const da = new Date(a.fechaCreacion || 0).getTime();
      const db = new Date(b.fechaCreacion || 0).getTime();
      return db - da;
    });
  });

  createColoniaForm = new FormGroup({
    nombre: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    codigoInvitacion: new FormControl(randomCode(8), { nonNullable: true, validators: [Validators.required] }),
  });

  joinForm = new FormGroup({
    codigoInvitacion: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  postForm = new FormGroup({
    contenido: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(2)] }),
    esAlerta: new FormControl(false, { nonNullable: true }),
    imageUrls: new FormControl('', { nonNullable: true }),
  });

  constructor() {
    this.reload();
  }

  reload(): void {
    this.busy.set(true);
    const done = () => this.busy.set(false);

    this.api.getColonias().subscribe({ next: (v) => this.colonias.set(v || []) });
    this.api.getUsuariosColonias().subscribe({ next: (v: UsuarioColonia[]) => this.usuariosColonias.set(v || []) });
    this.api.getUsers().subscribe({ next: (v) => this.usuarios.set(v || []) });

    this.api.getPostsColonia().subscribe({ next: (v) => this.posts.set(v || []) });
    this.api.getPostColoniaImages().subscribe({ next: (v) => this.postImages.set(v || []) });
    this.api.getCommentsColonia().subscribe({ next: (v) => this.comments.set(v || []) });
    this.api.getLikesColonia().subscribe({ next: (v) => this.likes.set(v || []), complete: done, error: done });

    // ensure selection
    setTimeout(() => {
      if (!this.selectedColoniaId() && this.myColonias().length) {
        this.selectedColoniaId.set(this.myColonias()[0].id!);
      }
    });
  }

  format(d?: string): string {
    return formatFriendlyDate(d);
  }

  userName(userId: number): string {
    return this.usuarios().find((u) => u.id === userId)?.nombre || `Usuario #${userId}`;
  }

  imagesForPost(postColoniaId?: number): PostColoniaImage[] {
    if (!postColoniaId) return [];
    return this.postImages().filter((x) => x.postColoniaId === postColoniaId);
  }

  likesCount(postId?: number): number {
    if (!postId) return 0;
    return this.likes().filter((l) => l.postColoniaId === postId).length;
  }

  isLikedByMe(postId?: number): boolean {
    if (!postId) return false;
    const me = this.me();
    return this.likes().some((l) => l.postColoniaId === postId && l.userId === me.id);
  }

  toggleComments(postId?: number): void {
    if (!postId) return;
    this.expandedComments.update((m) => ({ ...m, [postId]: !m[postId] }));
    if (!this.commentForms()[postId]) {
      this.commentForms.update((m) => ({
        ...m,
        [postId]: new FormGroup({
          contenido: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
        }),
      }));
    }
  }

  commentsFor(postId?: number): CommentColonia[] {
    if (!postId) return [];
    return this.comments().filter((c) => c.postColoniaId === postId).slice(-50);
  }

  toggleLike(p: PostColonia): void {
    if (!p.id) return;
    const me = this.me();
    const existing = this.likes().find((l) => l.postColoniaId === p.id && l.userId === me.id);
    if (existing?.id) {
      this.api.deleteLikeColonia(existing.id).subscribe({
        next: () => this.likes.update((arr) => arr.filter((x) => x.id !== existing.id)),
        error: () => this.toast.show('No se pudo quitar el like.', 'danger'),
      });
      return;
    }

    this.api
      .createLikeColonia({ postColoniaId: p.id, userId: me.id!, fechaCreacion: toLocalDateString() })
      .subscribe({
        next: (created) => this.likes.update((arr) => [...arr, created]),
        error: () => this.toast.show('No se pudo dar like.', 'danger'),
      });
  }

  submitComment(postId: number): void {
    const form = this.commentForms()[postId];
    if (!form || form.invalid) {
      form?.markAllAsTouched();
      return;
    }
    const me = this.me();
    this.api
      .createCommentColonia({
        postColoniaId: postId,
        userId: me.id!,
        contenido: form.value.contenido!,
        fechaCreacion: toLocalDateString(),
      })
      .subscribe({
        next: (created) => {
          this.comments.update((arr) => [...arr, created]);
          form.reset({ contenido: '' });
        },
        error: () => this.toast.show('No se pudo comentar.', 'danger'),
      });
  }

  openCreateColonia(): void {
    this.createColoniaForm.reset({ nombre: '', codigoInvitacion: randomCode(8) });
    this.showCreate.set(true);
  }

  createColonia(): void {
    if (this.createColoniaForm.invalid) {
      this.createColoniaForm.markAllAsTouched();
      return;
    }
    const me = this.me();
    this.api
      .createColonia({
        nombre: this.createColoniaForm.value.nombre!,
        codigoInvitacion: this.createColoniaForm.value.codigoInvitacion!,
        userId: me.id!,
      })
      .subscribe({
        next: (created) => {
          this.colonias.update((arr) => [...arr, created]);
          this.selectedColoniaId.set(created.id || null);
          this.toast.show('Colonia creada.', 'success');
          this.showCreate.set(false);
        },
        error: () => this.toast.show('No se pudo crear la colonia.', 'danger'),
      });
  }

  openJoin(): void {
    this.joinForm.reset({ codigoInvitacion: '' });
    this.showJoin.set(true);
  }

  join(): void {
    if (this.joinForm.invalid) {
      this.joinForm.markAllAsTouched();
      return;
    }
    const code = this.joinForm.value.codigoInvitacion!.trim();
    const col = this.colonias().find((c) => c.codigoInvitacion === code);
    if (!col?.id) {
      this.toast.show('Código no encontrado.', 'warning');
      return;
    }

    const me = this.me();
    const exists = this.usuariosColonias().some((uc) => uc.coloniaId === col.id && uc.usuarioId === me.id);
    if (exists) {
      this.toast.show('Ya estás en esa colonia.', 'info');
      this.selectedColoniaId.set(col.id);
      this.showJoin.set(false);
      return;
    }

    this.api
      .createUsuarioColonia({ coloniaId: col.id, usuarioId: me.id!, fechaRegistro: toLocalDateString() })
      .subscribe({
        next: (created) => {
          this.usuariosColonias.update((arr) => [...arr, created]);
          this.selectedColoniaId.set(col.id!);
          this.toast.show('Te uniste a la colonia.', 'success');
          this.showJoin.set(false);
        },
        error: () => this.toast.show('No se pudo unir.', 'danger'),
      });
  }

  publishPost(): void {
    if (this.postForm.invalid) {
      this.postForm.markAllAsTouched();
      return;
    }
    const col = this.selectedColonia();
    if (!col?.id) return;

    const me = this.me();
    const urls = (this.postForm.value.imageUrls || '')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 6);

    this.api
      .createPostColonia({
        coloniaId: col.id,
        usuarioId: me.id!,
        contenido: this.postForm.value.contenido!,
        esAlerta: !!this.postForm.value.esAlerta,
        fechaCreacion: toLocalDateString(),
      })
      .subscribe({
        next: (created) => {
          this.posts.update((arr) => [created, ...arr]);
          if (created.id && urls.length) {
            urls.forEach((url) => {
              this.api
                .createPostColoniaImage({ postColoniaId: created.id!, usuarioId: me.id!, imagePath: url, fechaCreacion: toLocalDateString() })
                .subscribe({ next: (img) => this.postImages.update((arr) => [img, ...arr]) });
            });
          }
          this.toast.show('Publicado en la colonia.', 'success');
          this.postForm.reset({ contenido: '', esAlerta: false, imageUrls: '' });
        },
        error: () => this.toast.show('No se pudo publicar.', 'danger'),
      });
  }
}
