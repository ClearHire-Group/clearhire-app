import { Component, inject } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { SidebarNavComponent } from './layout/sidebar-nav/sidebar-nav.component';
import { TopBarComponent } from './layout/top-bar/top-bar.component';

/** Rotas fora de sessão — sem sidebar/top-bar, que dependem de empresa/usuário autenticado. */
const CHROMELESS_PREFIXES = ['/login', '/registro', '/esqueci-senha', '/redefinir-senha', '/aceitar-convite', '/vagas'];

function hasChrome(url: string): boolean {
  return !CHROMELESS_PREFIXES.some((prefix) => url.startsWith(prefix));
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, SidebarNavComponent, TopBarComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  private router = inject(Router);

  readonly showChrome = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => hasChrome(e.urlAfterRedirects)),
    ),
    { initialValue: hasChrome(this.router.url) },
  );

  title = 'clearhire';
}
