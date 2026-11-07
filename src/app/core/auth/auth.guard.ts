import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.ensureSession().pipe(map(valid => valid ? true : router.createUrlTree(['/login'])));
};

// A navigation guard is a UX boundary; the server must enforce the same authorization.
export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.ensureSession().pipe(map(valid => valid && auth.user()?.role?.toLowerCase() === 'admin' ? true : router.createUrlTree(['/dashboard'])));
};
