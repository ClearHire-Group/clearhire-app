import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

/**
 * Bloco de erro reusado dentro do conteúdo normal da página (mesma nav/chrome ao redor) — duas
 * variantes:
 * - 'not-found': o recurso pedido (campanha/candidato/talento/vaga) não existe. Sem retry — tentar
 *   de novo não muda nada, a ação certa é voltar. Ver `HttpApiService.undefinedOnNotFound`: só um
 *   404 real vira esse estado, nunca um 500/timeout/rede fora do ar.
 * - 'error': falha genérica ao carregar (rede, backend fora do ar, 500). Tem retry — por padrão
 *   recarrega a página inteira (sempre correto, nenhuma tela precisa saber como se refazer);
 *   páginas com um jeito mais barato de tentar de novo podem passar `(retry)` pra sobrescrever.
 */
@Component({
  selector: 'app-error-state',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './error-state.component.html',
  styleUrl: './error-state.component.scss',
})
export class ErrorStateComponent {
  @Input() kind: 'not-found' | 'error' = 'error';
  @Input() title?: string;
  @Input() message?: string;
  @Input() actionLabel?: string;
  @Input() actionRoute?: string | string[];
  @Output() retry = new EventEmitter<void>();

  get resolvedTitle(): string {
    if (this.title) return this.title;
    return this.kind === 'not-found' ? 'Não encontrado' : 'Não foi possível carregar';
  }

  get resolvedMessage(): string {
    if (this.message) return this.message;
    return this.kind === 'not-found'
      ? 'O que você está procurando não existe ou foi removido.'
      : 'Algo deu errado ao buscar essas informações. Verifique sua conexão e tente novamente.';
  }

  onRetry(): void {
    if (this.retry.observed) {
      this.retry.emit();
    } else {
      location.reload();
    }
  }
}
