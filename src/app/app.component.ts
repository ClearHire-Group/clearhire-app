import { Component, inject } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { SidebarNavComponent } from './layout/sidebar-nav/sidebar-nav.component';
import { TopBarComponent } from './layout/top-bar/top-bar.component';
import { FatalErrorComponent } from './layout/fatal-error/fatal-error.component';
import { RuntimeErrorService } from './core/runtime-error.service';

/** Rotas fora de sessão — sem sidebar/top-bar, que dependem de empresa/usuário autenticado. */
const CHROMELESS_PREFIXES = ['/login', '/registro', '/esqueci-senha', '/redefinir-senha', '/aceitar-convite', '/vagas', '/landing'];

function hasChrome(url: string): boolean {
  const path = url.split('?')[0].split('#')[0];
  // `/` exata só é alcançada com chrome quando o apexHostGuard casa (landing no domínio raiz) —
  // o fluxo autenticado sempre redireciona `/` para `/dashboard` (ou `/login`) antes do
  // NavigationEnd, nunca fica parado em `/`.
  if (path === '/') return false;
  return !CHROMELESS_PREFIXES.some((prefix) => path.startsWith(prefix));
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, SidebarNavComponent, TopBarComponent, FatalErrorComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  private router = inject(Router);
  readonly runtimeError = inject(RuntimeErrorService);

  readonly showChrome = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => hasChrome(e.urlAfterRedirects)),
    ),
    { initialValue: hasChrome(this.router.url) },
  );

  title = 'clearhire';
}
