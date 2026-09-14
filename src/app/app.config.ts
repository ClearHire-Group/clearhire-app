import { ApplicationConfig, ErrorHandler, inject, provideAppInitializer, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withRouterConfig } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { DataApi } from './core/data-api';
import { MockApiService } from './core/mock-api.service';
import { HttpApiService } from './core/http-api.service';
import { APP_CONFIG } from './core/app-config';
import { AuthService } from './core/auth.service';
import { authInterceptor } from './core/auth.interceptor';
import { envelopeInterceptor } from './core/envelope.interceptor';
import { GlobalErrorHandler } from './core/global-error-handler';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    // 'always': as sub-telas de campanha (funil/candidatos/visão geral/configurações) são rotas
    // filhas de `campanhas/:campaignId` e precisam ler `campaignId` do pai — sem isso o Router só
    // propaga params do pai pra filhos com path vazio (estratégia default 'emptyOnly').
    provideRouter(routes, withRouterConfig({ paramsInheritanceStrategy: 'always' })),
    provideHttpClient(withInterceptors([envelopeInterceptor, authInterceptor])),
    { provide: DataApi, useClass: APP_CONFIG.useMockApi ? MockApiService : HttpApiService },
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    // Tenta restaurar a sessão a partir do cookie httpOnly de refresh antes do router/guards
    // rodarem — AuthService.bootstrap() nunca dá erro (ver comentário lá), então isto nunca
    // impede a app de renderizar, mesmo pra um visitante sem sessão nenhuma.
    provideAppInitializer(() => inject(AuthService).bootstrap()),
  ],
};
