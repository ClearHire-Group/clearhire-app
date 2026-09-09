import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { DataApi } from './data-api';
import { AuthSession, LoginCredentials, RegisterCompanyInput, RegisterCompanyResult } from './models';

const STORAGE_KEY = 'clearhire.auth.session';

function readStoredSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthSession) : null;
  } catch {
    return null;
  }
}

/** Sessão da aplicação — guarda o par de tokens do login e expõe `isAuthenticated` pro guard de rotas.
 * `login`/`registerCompany` só encaminham pro `DataApi`; a diferença é que `login` também persiste a sessão. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = inject(DataApi);
  private session = signal<AuthSession | null>(readStoredSession());

  readonly isAuthenticated = computed(() => this.session() !== null);

  registerCompany(input: RegisterCompanyInput): Observable<RegisterCompanyResult> {
    return this.api.registerCompany(input);
  }

  login(credentials: LoginCredentials): Observable<AuthSession> {
    return this.api.login(credentials).pipe(tap((session) => this.setSession(session)));
  }

  logout(): void {
    this.setSession(null);
  }

  private setSession(session: AuthSession | null): void {
    this.session.set(session);
    try {
      if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* localStorage indisponível — sessão simplesmente não sobrevive a um reload */
    }
  }
}
