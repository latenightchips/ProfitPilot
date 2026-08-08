/**
 * Client-side Sentry initialization — 06_TASKS.md M9-049 ("Implement
 * Production Error Monitoring"). Next.js's own file-based convention for
 * `@sentry/nextjs@10`'s client SDK (this project's installed version —
 * confirmed via `node_modules/@sentry/nextjs`'s own build-time config
 * types, which read `instrumentation-client.(js|ts)` at the project
 * root), the browser-side counterpart to `instrumentation.ts`'s
 * server/edge `register()` hook.
 *
 * All real logic lives in `services/observability/errorMonitoring.ts`
 * (`initErrorMonitoring`) — see that file's own header comment for the
 * full "dormant until `NEXT_PUBLIC_SENTRY_DSN` is configured" reasoning,
 * the privacy-scrubbing this call wires in, and — importantly — why that
 * function loads `@sentry/nextjs` via a *dynamic* `import()` rather than
 * a static one. This file exists only because Next.js requires the init
 * call to live at this exact path for its own build-time instrumentation
 * to find it; it deliberately does not `import` anything from
 * `@sentry/nextjs` itself (not even the optional
 * `captureRouterTransitionStart` router-transition-tracing hook the SDK
 * recommends exporting here) — a static import at this always-executed
 * path is exactly the real, measured bundle-size regression
 * `errorMonitoring.ts`'s own header comment documents fixing; tracing is
 * disabled anyway (`tracesSampleRate: 0`), so there is no tracing signal
 * that hook would have anything to report.
 */
import { initErrorMonitoring } from '@/services/observability';

initErrorMonitoring();
