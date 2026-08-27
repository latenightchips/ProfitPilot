import type { NextResponse } from 'next/server';

import { buildDiagnosticEvent, captureError, logDiagnosticEvent } from '@/services/observability';

/**
 * Unexpected-exception boundary for the three public Aave API routes —
 * R2-1 ("Harden Aave API Routes Against Unexpected Exceptions"). Every
 * expected failure mode these routes can produce is already a typed,
 * classified `Result`/`ApplicationError`/`AaveAdapterError` returned
 * (never thrown) from `infrastructure/protocols/aave/*`'s own
 * `classifyError` — request validation, RPC timeouts/network errors,
 * contract reverts, unsupported assets all already reach the client as
 * a stable JSON body with an appropriate status. This boundary exists
 * for what's genuinely left over: something the classification layer
 * itself didn't anticipate — a bug, a truly malformed upstream response
 * `classifyError` doesn't recognize, an out-of-memory condition, or
 * similar — actually throwing and escaping all the way up to the route
 * handler.
 *
 * **`_shared/` (Next.js's own underscore-prefixed "not a route"
 * convention)** — this needs `NextResponse`'s type and the two
 * `services/observability` primitives together, so it can't live under
 * `services/` (`tests/unit/services/serviceFoundation.test.ts`'s M3-001
 * regression check forbids any Next.js import there — the same boundary
 * `middleware.ts`'s own header comment already documents for the
 * identical reason), but it also must never become a route of its own.
 *
 * **One shared function across all three routes, not three copies** —
 * the try/catch, diagnostic logging, and Sentry capture are byte-for-
 * byte identical in every route; only the route's own name, its own
 * fallback error code, and its own existing handler body differ, so
 * those are the only three things each call site supplies.
 *
 * **Diagnostic path chosen deliberately: both `captureError` and
 * `logDiagnosticEvent`, not just one.** `captureError` is this
 * codebase's own established primitive for exactly "Unhandled
 * exceptions"/"Route failures" (`services/observability/errorMonitoring.ts`'s
 * own M9-049 Capture list) — the semantic category this boundary exists
 * for — and its `captureException` call preserves the real exception
 * object/stack for a live Sentry project to actually debug from,
 * something a text-message capture cannot give back. But `captureError`
 * alone is a silent no-op whenever Sentry isn't configured
 * (`isErrorMonitoringConfigured()`) — the common case for this
 * self-hosted-first application (no live Sentry project exists for
 * Version 1, per `docs/DEPLOYMENT_DISPOSITION.md`) — which would leave
 * an operator with genuinely nothing to look at for exactly the
 * failures hardest to reproduce. `logDiagnosticEvent` closes that: it
 * always writes to the console regardless of Sentry configuration
 * (`services/observability/diagnosticEvent.ts`'s own "the one real,
 * always-available structured log this local-first application has"),
 * the same established primitive `app/settings/SettingsPageClient.tsx`'s
 * import/export failure paths already use for an identical "a real
 * failure boundary needs operator-visible diagnostics" need. Using both
 * together is not a new/parallel logging framework — it's this
 * repository's own two existing telemetry primitives, applied together
 * because this boundary genuinely spans both of their established
 * purposes.
 *
 * **Never reaches for `error.message`, a stack trace, or the raw
 * thrown value when building anything sent to the client** — only
 * `fallback()`'s own caller-supplied, static, pre-written response ever
 * reaches `NextResponse.json`. `captureError`/`logDiagnosticEvent` still
 * receive the real `error` value, but that only ever leaves this
 * process via Sentry's own transport (when configured) or the server's
 * own console — never serialized into the HTTP response body a client
 * receives.
 *
 * **Does not touch classified failures at all.** Every existing
 * `if (!result.ok) return NextResponse.json(...)` branch in each route
 * stays completely outside this boundary's `try` — only a genuine
 * `throw` reaches the `catch` below, so an ordinary, already-expected
 * RPC timeout or validation failure never generates diagnostic noise
 * through this path.
 */
export async function withUnexpectedErrorBoundary<T>(
  routeName: string,
  fallbackCode: string,
  handler: () => Promise<NextResponse<T>>,
  fallback: () => NextResponse<T>,
): Promise<NextResponse<T>> {
  try {
    return await handler();
  } catch (error) {
    captureError(error, { feature: 'api', operation: routeName, code: fallbackCode });
    logDiagnosticEvent(
      buildDiagnosticEvent({
        category: 'provider',
        code: fallbackCode,
        feature: 'api',
        operation: routeName,
        outcome: 'failure',
      }),
    );
    return fallback();
  }
}
