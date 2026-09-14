import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, map, of, shareReplay, tap } from 'rxjs';
import { DataApi } from './data-api';
import { AuthSession, LoginCredentials, RegisterCompanyInput, RegisterCompanyResult } from './models';

/** Renova o access token ~1min antes dos 15min de expiração (`token.AccessTokenTTL` no backend),
 * enquanto a aba ficar aberta — evita bater um 401 em uso normal. */
const PROACTIVE_REFRESH_MS = 14 * 60 * 1000;

/**
 * Sessão da aplicação. Access token vive só em memória (nunca localStorage/sessionStorage) — se
 * vazar via XSS, expira em 15min e não sobrevive a um reload. O refresh token nunca aparece aqui:
 * é um cookie httpOnly que o backend seta/lê sozinho (ver `auth.interceptor.ts`,
 * `withCredentials: true` nas chamadas do `HttpApiService`) — o Angular não tem acesso a ele.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = inject(DataApi);
  private router = inject(Router);

  private _accessToken = signal<string | null>(null);
  readonly accessToken = this._accessToken.asReadonly();
  readonly isAuthenticated = computed(() => this._accessToken() !== null);

  private refreshInFlight$: Observable<AuthSession> | null = null;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;

  registerCompany(input: RegisterCompanyInput): Observable<RegisterCompanyResult> {
    return this.api.registerCompany(input);
  }

  login(credentials: LoginCredentials): Observable<AuthSession> {
    return this.api.login(credentials).pipe(tap((session) => this.applySession(session)));
  }

  /**
   * Chamado uma vez no bootstrap da app (`provideAppInitializer`) pra restaurar a sessão a partir
   * do cookie httpOnly, sem nunca ter guardado nada em storage. NUNCA pode deixar o Observable dar
   * erro: o caso normal de um visitante anônimo é exatamente um 401 aqui (sem cookie ainda), e um
   * erro de app initializer derruba o bootstrap da aplicação inteira, não só desloga esse usuário.
   */
  bootstrap(): Observable<void> {
    return this.refresh().pipe(
      map(() => undefined),
      catchError(() => of(undefined)),
    );
  }

  /**
   * Troca o refresh token (cookie, enviado automaticamente) por uma sessão nova. Compartilha uma
   * única chamada em voo entre chamadores concorrentes — várias 401 simultâneas no interceptor não
   * disparam N refreshes. `finalize` roda ANTES do `shareReplay`: garante que o guard de "em voo"
   * é liberado exatamente uma vez, quando a chamada compartilhada de fato termina.
   */
  refresh(): Observable<AuthSession> {
    if (!this.refreshInFlight$) {
      this.refreshInFlight$ = this.api.refresh().pipe(
        tap((session) => this.applySession(session)),
        finalize(() => {
          this.refreshInFlight$ = null;
        }),
        shareReplay(1),
      );
    }
    return this.refreshInFlight$;
  }

  /** Sempre limpa a sessão local, mesmo se a revogação no servidor falhar — do ponto de vista do
   * usuário, "sair" tem que funcionar na hora, independente de rede. */
  logout(): void {
    this.clearSession();
    this.api
      .logout()
      .pipe(catchError(() => of(undefined)))
      .subscribe();
  }

  /**
   * Chamado quando descobrimos que a sessão não é mais válida sem o usuário ter pedido — o refresh
   * falhou de verdade (cookie expirado/revogado), seja no ciclo reativo do interceptor (401 numa
   * chamada) ou no proativo (~1min antes do access token expirar). Diferente de `logout()`: não
   * revoga nada no servidor (o refresh já falhou, não há sessão válida lá pra revogar) e manda o
   * usuário pro login com um aviso — sem isso ele ficava "preso" numa app que parecia autenticada
   * mas não era, vendo erro silencioso em cada chamada até recarregar a página por conta própria.
   */
  forceLogout(): void {
    if (!this.isAuthenticated()) return; // já deslogado — evita navegação/aviso duplicados
    this.clearSession();
    this.router.navigate(['/login'], { queryParams: { sessionExpired: 1 } });
  }

  private applySession(session: AuthSession): void {
    this._accessToken.set(session.accessToken);
    this.scheduleProactiveRefresh();
  }

  private clearSession(): void {
    this._accessToken.set(null);
    this.clearProactiveRefresh();
  }

  private scheduleProactiveRefresh(): void {
    this.clearProactiveRefresh();
    this.refreshTimer = setTimeout(() => {
      this.refresh().subscribe({ error: () => this.forceLogout() }); // erro aqui só significa sessão expirada de verdade
    }, PROACTIVE_REFRESH_MS);
  }

  private clearProactiveRefresh(): void {
    if (this.refreshTimer !== null) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }
}
