import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../environments/environment';

export const apiBaseInterceptor: HttpInterceptorFn = (req, next) => {
  const apiHost = environment.apiUrl.replace(/\/$/, '');

  // Si alguien hizo la llamada relativa, la convertimos a absoluta al backend
  if (req.url.startsWith('/api/petcare')) {
    req = req.clone({ url: `${apiHost}${req.url}` });
  }

  return next(req);
};
