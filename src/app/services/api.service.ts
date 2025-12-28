import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Adopcion,
  Colonia,
  Comment,
  CommentColonia,
  Gasto,
  ImagenMascota,
  Like,
  LikeColonia,
  Mascota,
  Post,
  PostColonia,
  PostColoniaImage,
  PostImage,
  Presupuesto,
  RastreoGPS,
  SolicitudAdopcion,
  Tratamiento,
  Usuario,
  UsuarioColonia,
} from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private base = '/api/petcare';

  constructor(private http: HttpClient) {}

  // --- usuarios ---
  getUsers(): Observable<Usuario[]> {
    return this.http.get<Usuario[]>(`${this.base}/allusers`);
  }

  getUser(id: number): Observable<Usuario> {
    return this.http.get<Usuario>(`${this.base}/user/${id}`);
  }

  createUser(body: Usuario): Observable<Usuario> {
    return this.http.post<Usuario>(`${this.base}/create-user`, body);
  }

  updateUser(id: number, body: Usuario): Observable<Usuario> {
    return this.http.put<Usuario>(`${this.base}/update-user/${id}`, body);
  }

  updateUserPhoto(id: number, fotoPerfil: string): Observable<Usuario> {
    return this.http.put<Usuario>(`${this.base}/create-user/photo-profile/${id}`, { fotoPerfil } as any);
  }

  // --- posts (dashboard) ---
  getPosts(): Observable<Post[]> {
    return this.http.get<Post[]>(`${this.base}/allposts`);
  }

  createPost(body: Post): Observable<Post> {
    return this.http.post<Post>(`${this.base}/create-post`, body);
  }

  updatePost(id: number, body: Post): Observable<Post> {
    return this.http.put<Post>(`${this.base}/update-post/${id}`, body);
  }

  deletePost(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/delete-post/${id}`);
  }

  getPostImages(): Observable<PostImage[]> {
    return this.http.get<PostImage[]>(`${this.base}/allpost-images`);
  }

  createPostImage(body: PostImage): Observable<PostImage> {
    return this.http.post<PostImage>(`${this.base}/create-postimage`, body);
  }

  deletePostImage(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/delete-postimage/${id}`);
  }

  getLikes(): Observable<Like[]> {
    return this.http.get<Like[]>(`${this.base}/alllikes`);
  }

  createLike(body: Like): Observable<Like> {
    return this.http.post<Like>(`${this.base}/create-like`, body);
  }

  deleteLike(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/delete-likes/${id}`);
  }

  getComments(): Observable<Comment[]> {
    return this.http.get<Comment[]>(`${this.base}/allcomments`);
  }

  createComment(body: Comment): Observable<Comment> {
    return this.http.post<Comment>(`${this.base}/create-comment`, body);
  }

  deleteComment(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/delete-comment/${id}`);
  }

  // --- mascotas ---
  getMascotas(): Observable<Mascota[]> {
    return this.http.get<Mascota[]>(`${this.base}/allmascotas`);
  }

  createMascota(body: Mascota): Observable<Mascota> {
    return this.http.post<Mascota>(`${this.base}/create-mascota`, body);
  }

  updateMascota(id: number, body: Mascota): Observable<Mascota> {
    return this.http.put<Mascota>(`${this.base}/update-mascota/${id}`, body);
  }

  deleteMascota(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/delete-mascota/${id}`);
  }

  getImagenesMascota(): Observable<ImagenMascota[]> {
    return this.http.get<ImagenMascota[]>(`${this.base}/allimagenesmascotas`);
  }

  createImagenMascota(body: ImagenMascota): Observable<ImagenMascota> {
    return this.http.post<ImagenMascota>(`${this.base}/create-imagen-mascota`, body);
  }

  deleteImagenMascota(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/delete-imagen-mascota/${id}`);
  }

  getTratamientos(): Observable<Tratamiento[]> {
    return this.http.get<Tratamiento[]>(`${this.base}/alltratamientos`);
  }

  createTratamiento(body: Tratamiento): Observable<Tratamiento> {
    return this.http.post<Tratamiento>(`${this.base}/create-tratamiento`, body);
  }

  deleteTratamiento(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/delete-tratamiento/${id}`);
  }

  getRastreoGPS(): Observable<RastreoGPS[]> {
    return this.http.get<RastreoGPS[]>(`${this.base}/allrastreogps`);
  }

  createRastreoGPS(body: RastreoGPS): Observable<RastreoGPS> {
    return this.http.post<RastreoGPS>(`${this.base}/create-rastreo-gps`, body);
  }

  deleteRastreoGPS(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/delete-rastreo-gps/${id}`);
  }

  // --- adopciones ---
  getAdopciones(): Observable<Adopcion[]> {
    return this.http.get<Adopcion[]>(`${this.base}/alladopciones`);
  }

  createAdopcion(body: Adopcion): Observable<Adopcion> {
    return this.http.post<Adopcion>(`${this.base}/create-adopcion`, body);
  }

  updateAdopcion(id: number, body: Adopcion): Observable<Adopcion> {
    return this.http.put<Adopcion>(`${this.base}/update-adopcion/${id}`, body);
  }

  deleteAdopcion(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/delete-adopcion/${id}`);
  }

  getSolicitudesAdopcion(): Observable<SolicitudAdopcion[]> {
    return this.http.get<SolicitudAdopcion[]>(`${this.base}/allsolicitudes-adopcion`);
  }

  createSolicitudAdopcion(body: SolicitudAdopcion): Observable<SolicitudAdopcion> {
    return this.http.post<SolicitudAdopcion>(`${this.base}/create-solicitud-adopcion`, body);
  }

  updateSolicitudAdopcion(id: number, body: SolicitudAdopcion): Observable<SolicitudAdopcion> {
    return this.http.put<SolicitudAdopcion>(`${this.base}/update-solicitud-adopcion/${id}`, body);
  }

  deleteSolicitudAdopcion(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/delete-solicitud-adopcion/${id}`);
  }

  // --- finanzas ---
  getGastos(): Observable<Gasto[]> {
    return this.http.get<Gasto[]>(`${this.base}/allgastos`);
  }

  createGasto(body: Gasto): Observable<Gasto> {
    return this.http.post<Gasto>(`${this.base}/create-gasto`, body);
  }

  updateGasto(id: number, body: Gasto): Observable<Gasto> {
    return this.http.put<Gasto>(`${this.base}/update-gasto/${id}`, body);
  }

  deleteGasto(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/delete-gasto/${id}`);
  }

  getPresupuestos(): Observable<Presupuesto[]> {
    return this.http.get<Presupuesto[]>(`${this.base}/allpresupuestos`);
  }

  createPresupuesto(body: Presupuesto): Observable<Presupuesto> {
    return this.http.post<Presupuesto>(`${this.base}/create-presupuesto`, body);
  }

  updatePresupuesto(id: number, body: Presupuesto): Observable<Presupuesto> {
    return this.http.put<Presupuesto>(`${this.base}/update-presupuesto/${id}`, body);
  }

  deletePresupuesto(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/delete-presupuesto/${id}`);
  }

  // --- red vecinal ---
  getColonias(): Observable<Colonia[]> {
    return this.http.get<Colonia[]>(`${this.base}/allcolonias`);
  }

  createColonia(body: Colonia): Observable<Colonia> {
    return this.http.post<Colonia>(`${this.base}/create-colonia`, body);
  }

  getUsuariosColonias(): Observable<UsuarioColonia[]> {
    return this.http.get<UsuarioColonia[]>(`${this.base}/allusuarios-colonias`);
  }

  createUsuarioColonia(body: UsuarioColonia): Observable<UsuarioColonia> {
    return this.http.post<UsuarioColonia>(`${this.base}/create-usuarios-colonias`, body);
  }

  deleteUsuarioColonia(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/delete-usuarios-colonias/${id}`);
  }

  getPostsColonia(): Observable<PostColonia[]> {
    return this.http.get<PostColonia[]>(`${this.base}/allposts-colonia`);
  }

  createPostColonia(body: PostColonia): Observable<PostColonia> {
    return this.http.post<PostColonia>(`${this.base}/create-post-colonia`, body);
  }

  deletePostColonia(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/delete-post-colonia/${id}`);
  }

  getPostColoniaImages(): Observable<PostColoniaImage[]> {
    return this.http.get<PostColoniaImage[]>(`${this.base}/allpost-colonia-images`);
  }

  createPostColoniaImage(body: PostColoniaImage): Observable<PostColoniaImage> {
    return this.http.post<PostColoniaImage>(`${this.base}/create-post-colonia-images`, body);
  }

  getLikesColonia(): Observable<LikeColonia[]> {
    return this.http.get<LikeColonia[]>(`${this.base}/alllikes-colonia`);
  }

  createLikeColonia(body: LikeColonia): Observable<LikeColonia> {
    return this.http.post<LikeColonia>(`${this.base}/create-likes-colonia`, body);
  }

  deleteLikeColonia(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/delete-likes-colonia/${id}`);
  }

  getCommentsColonia(): Observable<CommentColonia[]> {
    return this.http.get<CommentColonia[]>(`${this.base}/allcomments-colonia`);
  }

  createCommentColonia(body: CommentColonia): Observable<CommentColonia> {
    return this.http.post<CommentColonia>(`${this.base}/create-comment-colonia`, body);
  }

  deleteCommentColonia(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/delete-comment-colonia/${id}`);
  }
}
