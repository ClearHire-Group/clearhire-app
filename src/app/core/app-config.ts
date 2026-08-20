/**
 * Single toggle point for switching the data layer from mocked data to a real backend.
 * Flip `useMockApi` to `false` once the endpoints below exist — no component changes needed,
 * every page consumes data through the `DataApi` contract (see data-api.ts).
 */
export const APP_CONFIG = {
  apiBaseUrl: '/api',
  useMockApi: true,
  /** Simulated network latency for the mock API, so loading states are visible during development. */
  mockLatencyMs: 300,
};
