import { Provider } from '@angular/core';
import { DataApi } from './data-api';
import { HttpApiService } from './http-api.service';

/**
 * Variante de produção, plugada pelo `fileReplacements` do angular.json. A única diferença para
 * `data-api.provider.ts` é o que ela NÃO importa: sem referência ao MockApiService, nem ele nem o
 * `mock-data.ts` (credencial de demonstração, candidatos fictícios) entram no bundle publicado.
 *
 * Em produção não existe modo mock — `APP_CONFIG.useMockApi` nem é consultado aqui, para que
 * ligar a flag por engano não tenha como servir dado falso ao cliente.
 */
export const dataApiProvider: Provider = {
  provide: DataApi,
  useClass: HttpApiService,
};
