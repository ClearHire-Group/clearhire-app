import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { APP_CONFIG } from './app-config';
import { AuthService } from './auth.service';

/** Chamadas que nunca devem levar Authorization nem entrar no ciclo de retry — são as próprias
 * rotas que criam/renovam/encerram a sessão (login e refresh não têm token ainda pra anexar;
 * retry num 401 de qualquer uma delas seria um loop). */
const AUTH_EXEMPT_PATHS = ['/auth/login', '/auth/refresh', '/auth/logout', '/companies'];

function isApiRequest(url: string): boolean {
  return url.startsWith(APP_CONFIG.apiBaseUrl);
}

function isAuthExempt(url: string): boolean {
  return AUTH_EXEMPT_PATHS.some((path) => url.startsWith(`${APP_CONFIG.apiBaseUrl}${path}`));
}

/**
 * Anexa `Authorization: Bearer <token>` nas chamadas pra API quando há um access token em memória,
 * e `withCredentials: true` pra o cookie httpOnly de refresh viajar (necessário em qualquer
 * topologia cross-origin; inofensivo mesmo-origem via proxy em dev). Numa 401 de uma rota
 * protegida, tenta uma renovação (compartilhada — ver `AuthService.refresh`) e reenvia a request
 * original uma única vez; se o refresh também falhar, propaga o erro original.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isApiRequest(req.url)) {
    return next(req);
  }

  const auth = inject(AuthService);
  const token = auth.accessToken();
  const authorized = req.clone({
    withCredentials: true,
    setHeaders: token ? { Authorization: `Bearer ${token}` } : {},
  });

  return next(authorized).pipe(
    catchError((error: unknown) => {
      const isUnauthorized = error instanceof HttpErrorResponse && error.status === 401;
      if (!isUnauthorized || isAuthExempt(req.url)) {
        return throwError(() => error);
      }
      return auth.refresh().pipe(
        switchMap((session) =>
          next(
            authorized.clone({
              setHeaders: { Authorization: `Bearer ${session.accessToken}` },
            }),
          ),
        ),
        catchError(() => throwError(() => error)), // refresh falhou — propaga o 401 original, não o erro do refresh
      );
    }),
  );
};
