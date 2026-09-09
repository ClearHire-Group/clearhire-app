/**
 * Single toggle point for switching the data layer from mocked data to a real backend.
 * Flip `useMockApi` to `false` once the endpoints below exist — no component changes needed,
 * every page consumes data through the `DataApi` contract (see data-api.ts).
 */
export const APP_CONFIG = {
  /** Relativo de propósito: em dev o proxy do `ng serve` (`proxy.conf.json`) encaminha pro backend
   * real em localhost:8080 — do ponto de vista do browser é tudo mesma origem, o que também evita
   * fricção de CORS/cookie no fluxo de refresh token. Prefixo `/api/v1` bate com `router.go` do backend. */
  apiBaseUrl: '/api/v1',
  useMockApi: false,
  /** Simulated network latency for the mock API, so loading states are visible during development. */
  mockLatencyMs: 300,
};
