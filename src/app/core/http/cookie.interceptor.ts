import { HttpInterceptorFn } from '@angular/common/http';

/** All frontend API URLs are relative (/api). Dev uses the same-origin CLI reverse proxy;
 * production must serve /api through a same-origin reverse proxy. */
export const cookieInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith('/api/')) return next(request);
  return next(request.clone({ withCredentials: true }));
};