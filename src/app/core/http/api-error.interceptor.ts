import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { VendorContextService } from '../state/vendor-context.service';

/** Treat 401 from authenticated business endpoints as an expired/invalid employee session. */
export const apiErrorInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const vendorContext = inject(VendorContextService);
  return next(request).pipe(catchError((error: unknown) => {
    if (request.url.startsWith('/api/') && error instanceof HttpErrorResponse && error.status === 401 &&
        !request.url.endsWith('/api/auth/login') &&
        !request.url.endsWith('/api/auth/logout')) {
      auth.clearLocal();
      vendorContext.clear();
      void router.navigateByUrl('/login');
    }
    return throwError(() => error);
  }));
};
