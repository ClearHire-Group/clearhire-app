import { environment } from '../../environments/environment';

/**
 * Single toggle point for switching the data layer from mocked data to a real backend.
 * Flip `useMockApi` to `false` once the endpoints below exist — no component changes needed,
 * every page consumes data through the `DataApi` contract (see data-api.ts).
 */
export const APP_CONFIG = {
  /** Relativo nos dois ambientes, de propósito: do ponto de vista do browser a API é sempre mesma
   * origem. Em dev, o proxy do `ng serve` (`proxy.conf.json`) encaminha pro backend em
   * localhost:8080; em produção, o rewrite `/api/*` do `vercel.json` encaminha pro Railway. Sem
   * isso o cookie de refresh token (SameSite=Lax) não iria nas chamadas cross-site e a sessão
   * cairia a cada reload. Prefixo `/api/v1` bate com `router.go` do backend nos dois casos. */
  apiBaseUrl: environment.apiBaseUrl,
  useMockApi: false,
  /** Simulated network latency for the mock API, so loading states are visible during development. */
  mockLatencyMs: 300,
};
