import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

/** Tela cheia mostrada pelo `AppComponent` quando `GlobalErrorHandler` captura uma exceção de
 * runtime não tratada — substitui a nav/conteúdo inteiros (o app pode estar num estado
 * inconsistente demais pra continuar renderizando ao redor do erro). */
@Component({
  selector: 'app-fatal-error',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './fatal-error.component.html',
  styleUrl: './fatal-error.component.scss',
})
export class FatalErrorComponent {
  reload(): void {
    location.reload();
  }
}
