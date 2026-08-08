/**
 * Server/edge-runtime instrumentation hook — Next.js's own native
 * `register()` convention (stable since Next.js 15, no experimental flag
 * needed), not a Sentry-specific file. 06_TASKS.md M9-049 ("Implement
 * Production Error Monitoring").
 *
 * **Real-world impact is small for this application specifically** —
 * every route in `app/` prerenders statically (confirmed by every
 * `pnpm build` run throughout this engagement: all routes list as
 * "○ (Static)"), and this codebase has no API routes/middleware for a
 * request to fail inside server-side. This hook is still wired for
 * completeness and to match Next.js's own recommended baseline (it also
 * covers the Next.js build process itself and any future server-rendered
 * route) — `initErrorMonitoring()` is the identical, already-gated call
 * `instrumentation-client.ts` makes for the browser; see
 * `services/observability/errorMonitoring.ts` for the shared "dormant
 * until configured" reasoning.
 */
export async function register(): Promise<void> {
  const { initErrorMonitoring } = await import('@/services/observability');
  initErrorMonitoring();
}
