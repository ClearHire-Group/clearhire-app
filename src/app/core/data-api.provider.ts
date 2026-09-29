import { Provider } from '@angular/core';
import { DataApi } from './data-api';
import { APP_CONFIG } from './app-config';
import { HttpApiService } from './http-api.service';
import { MockApiService } from './mock-api.service';

/**
 * Escolhe a implementação de DataApi. Existe como arquivo próprio (em vez de ficar inline no
 * app.config.ts) por causa do build de produção: o `angular.json` troca este arquivo pelo
 * `data-api.provider.prod.ts`, que NÃO importa o MockApiService.
 *
 * Sem essa troca, o mock ia para o bundle mesmo com `useMockApi: false` — a decisão é em tempo de
 * execução, então o bundler não consegue eliminar o import estático, e `mock-data.ts` (com
 * credencial de demonstração e ~25 candidatos fictícios) ficava legível para qualquer visitante.
 */
export const dataApiProvider: Provider = {
  provide: DataApi,
  useClass: APP_CONFIG.useMockApi ? MockApiService : HttpApiService,
};
