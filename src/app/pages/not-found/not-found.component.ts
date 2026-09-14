import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

/**
 * Rota coringa (`**`) dentro do grupo autenticado — ver `app.routes.ts`. Só é alcançada depois do
 * `authGuard` já ter deixado passar (um visitante sem sessão numa URL inválida vai pro /login
 * antes de chegar aqui), então sempre renderiza com a nav normal ao redor (`AppComponent` decide o
 * chrome pela URL, não por esta rota especificamente).
 */
@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './not-found.component.html',
  styleUrl: './not-found.component.scss',
})
export class NotFoundComponent {}
