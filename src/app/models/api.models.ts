export interface Usuario {
  id?: number;
  nombre: string;
  email: string;
  password: string;
  curp?: string;
  telefonoCelular?: string;
  fotoPerfil?: string;
}

export interface Post {
  id?: number;
  coloniaId?: number | null;
  contenido: string;
  imagen?: string | null;
  usuarioId: number;
  likesCount?: number | null;
  createdAt?: string; // LocalDate in backend
}

export interface PostImage {
  id?: number;
  postId: number;
  imagePath: string;
  usuarioId: number;
  fechaCreacion?: string;
}

export interface Comment {
  id?: number;
  postId: number;
  userId: number;
  contenido: string;
  fechaCreacion?: string;
}

export interface Like {
  id?: number;
  postId: number;
  userId: number;
}

export interface Mascota {
  id?: number;
  usuarioId: number;
  nombre: string;
  especie?: string;
  raza?: string;
  genero?: string;
  peso?: number;
  vacunado?: boolean;
  esterilizado?: boolean;
  descripcion?: string;
  tieneSeguro?: boolean;
}

export interface ImagenMascota {
  id?: number;
  mascotaId: number;
  ruta: string;
  fechaSubida?: string;
}

export interface Tratamiento {
  id?: number;
  usuarioId: number;
  mascotaId: number;
  tipoTratamiento: string;
  fecha: string; // LocalDate
  veterinario?: string;
  descripcion?: string;
  costo?: number;
  createdAt?: string;
}

export interface RastreoGPS {
  id?: number;
  mascotaId: number;
  latitud: number;
  longitud: number;
  timestamp?: string;
}

export interface Adopcion {
  id?: number;
  mascotaId: number;
  usuarioPublicadorId: number;
  disponible: boolean;
  fechaPublicacion?: string;
}

export interface SolicitudAdopcion {
  id?: number;
  adopcionId: number;
  solicitanteId: number;
  estado: string;
  mensaje?: string;
  fechaSolicitud?: string;
  createdAt?: string;
}

export interface Gasto {
  id?: number;
  usuarioId: number;
  mascotaId?: number | null;
  categoria: string;
  monto: number;
  fecha: string; // Date
  proveedor?: string;
  fechaRecordatorio?: string;
  fechaCreacion?: string;
}

export interface Presupuesto {
  id?: number;
  usuarioId: number;
  mes: string; // YYYY-MM
  monto: number;
  createdAt?: string;
}

export interface Colonia {
  id?: number;
  nombre: string;
  codigoInvitacion: string;
  userId: number;
}

export interface UsuarioColonia {
  id?: number;
  usuarioId: number;
  coloniaId: number;
  fechaRegistro?: string;
}

export interface PostColonia {
  id?: number;
  usuarioId: number;
  coloniaId: number;
  contenido: string;
  esAlerta?: boolean;
  fechaCreacion?: string;
}

export interface PostColoniaImage {
  id?: number;
  postColoniaId: number;
  usuarioId: number;
  imagePath: string;
  fechaCreacion?: string;
}

export interface CommentColonia {
  id?: number;
  postColoniaId: number;
  userId: number;
  contenido: string;
  fechaCreacion?: string;
}

export interface LikeColonia {
  id?: number;
  postColoniaId: number;
  userId: number;
  fechaCreacion?: string;
}
