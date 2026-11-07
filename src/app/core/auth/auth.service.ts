import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, finalize, map, of, shareReplay, switchMap, tap } from 'rxjs';
import { LoginRequest, UserDto } from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly userState = signal<UserDto | null>(null);
  readonly user = this.userState.asReadonly();
  private checkingSession$: Observable<boolean> | null = null;

  /** On refresh, the browser sends HttpOnly cookie automatically to /api/auth/me. */
  ensureSession(): Observable<boolean> {
    if (this.userState()) return of(true);
    if (!this.checkingSession$) {
      this.checkingSession$ = this.http.get<UserDto>('/api/auth/me').pipe(
        tap(user => this.userState.set(user)),
        map(() => true),
        catchError(() => { this.userState.set(null); return of(false); }),
        finalize(() => { this.checkingSession$ = null; }),
        shareReplay({ bufferSize: 1, refCount: true })
      );
    }
    return this.checkingSession$;
  }

  login(request: LoginRequest): Observable<UserDto> {
    // Backend returns JSON containing a JWT as well as setting the cookie.
    // We intentionally type the response as unknown and do not persist, display or log it.
    return this.http.post<unknown>('/api/auth/login', request).pipe(
      switchMap(() => this.http.get<UserDto>('/api/auth/me')),
      tap(user => this.userState.set(user))
    );
  }

  logout(): Observable<void> {
    return this.http.post<unknown>('/api/auth/logout', {}).pipe(
      map(() => undefined),
      tap(() => this.userState.set(null))
    );
  }

  clearLocal(): void { this.userState.set(null); }
}
