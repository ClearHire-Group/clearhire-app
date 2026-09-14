import { environment } from '../../environments/environment';

/**
 * Single toggle point for switching the data layer from mocked data to a real backend.
 * Flip `useMockApi` to `false` once the endpoints below exist — no component changes needed,
 * every page consumes data through the `DataApi` contract (see data-api.ts).
 */
export const APP_CONFIG = {
  /** Em dev (`environment.ts`) fica relativo de propósito: o proxy do `ng serve`
   * (`proxy.conf.json`) encaminha pro backend real em localhost:8080 — do ponto de vista do
   * browser é tudo mesma origem, o que também evita fricção de CORS/cookie no fluxo de refresh
   * token. Em produção (`environment.prod.ts`, via `fileReplacements` no `angular.json`) é uma
   * URL absoluta — front e API vivem em subdomínios diferentes (app.clearhire.example /
   * api.clearhire.example). Prefixo `/api/v1` bate com `router.go` do backend nos dois casos. */
  apiBaseUrl: environment.apiBaseUrl,
  useMockApi: false,
  /** Simulated network latency for the mock API, so loading states are visible during development. */
  mockLatencyMs: 300,
};
