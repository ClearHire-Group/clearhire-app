import { Component } from '@angular/core';

/** Split-screen compartilhado por /login e /registro: painel de marca (escuro) + card de formulário
 * (claro), via `ng-content`. Nenhuma tela autenticada usa isto — só as duas telas fora da sessão. */
@Component({
  selector: 'app-auth-shell',
  standalone: true,
  templateUrl: './auth-shell.component.html',
  styleUrl: './auth-shell.component.scss',
})
export class AuthShellComponent {}
