import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';

import { routes } from './app.routes';
import { DataApi } from './core/data-api';
import { MockApiService } from './core/mock-api.service';
import { HttpApiService } from './core/http-api.service';
import { APP_CONFIG } from './core/app-config';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(),
    { provide: DataApi, useClass: APP_CONFIG.useMockApi ? MockApiService : HttpApiService },
  ],
};
