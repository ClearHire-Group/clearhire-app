import { ErrorHandler, Injectable, inject } from '@angular/core';
import { RuntimeErrorService } from './runtime-error.service';

/**
 * Substitui o `ErrorHandler` default do Angular (que só loga no console) — sem isso, uma exceção
 * de runtime depois do bootstrap (bug de template, `undefined` inesperado etc.) deixa a tela
 * quebrada/em branco sem nenhum aviso pro usuário. Continua logando no console (não perde nada pra
 * depuração) e além disso liga `RuntimeErrorService.hasError`, que `AppComponent` usa pra trocar
 * todo o conteúdo por `FatalErrorComponent` — um "Recarregar página" sempre resolve, já que o
 * estado quebrado é só em memória (nada persistido fica inconsistente).
 */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private runtimeError = inject(RuntimeErrorService);

  handleError(error: unknown): void {
    console.error(error);
    this.runtimeError.setError();
  }
}
