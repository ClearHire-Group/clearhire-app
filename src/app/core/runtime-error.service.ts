import { Injectable, signal } from '@angular/core';

/** Estado do fallback de erro fatal — ver `GlobalErrorHandler` e `FatalErrorComponent`. */
@Injectable({ providedIn: 'root' })
export class RuntimeErrorService {
  readonly hasError = signal(false);

  setError(): void {
    this.hasError.set(true);
  }
}
