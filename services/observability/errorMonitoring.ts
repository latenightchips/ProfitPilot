/**
 * Production Error Monitoring — 06_TASKS.md M9-049 ("Implement
 * Production Error Monitoring"). Dependencies: M9-043. Description:
 * "Configure privacy-conscious production error monitoring." Capture:
 * "Unhandled exceptions, Failed critical workflows, Route failures,
 * Provider failures, Synchronization failures, Import and migration
 * failures." Requirements: "Do not send portfolio balances or sensitive
 * user data unnecessarily." DoD: "Critical production failures can be
 * detected without exposing private financial information."
 *
 * **Genuine, full gap — confirmed empty before this batch.**
 * `docs/DOD_COMPLIANCE_AUDIT.md`'s own re-check (Batch 1) and
 * `docs/SECURITY_REVIEW.md`'s own M9-029 section both found
 * `@sentry/nextjs` installed but completely unwired — zero `Sentry.*`
 * calls anywhere, no init file. This module is that wiring.
 *
 * **No live Sentry project exists in this environment** — the same
 * "dormant, fully-functional-with-zero-configuration" pattern
 * `services/auth/` already established for Supabase.
 * `isErrorMonitoringConfigured()` gates every function below on
 * `NEXT_PUBLIC_SENTRY_DSN` actually being set; with it unset (this
 * sandbox's real state), `initErrorMonitoring`/`captureError` are no-ops
 * — never throw, never contact any network endpoint, never buffer
 * anything to send later. A future deployer who sets the DSN gets a
 * fully working integration with no code change.
 *
 * **`@sentry/nextjs` is loaded via a dynamic `import()`, not a static
 * one — a genuine, measured fix, not a stylistic preference.** A first
 * implementation used a static `import * as Sentry from '@sentry/nextjs'`
 * at the top of this file; because this file is reached from
 * `instrumentation-client.ts` (unconditionally executed on every page
 * load, per Next.js's own convention), a real `rm -rf .next && pnpm
 * build` showed that pulled the entire Sentry client SDK into the shared
 * bundle *every route pays for*, regardless of whether a DSN is ever
 * configured — a measured ~76 kB shared-bundle regression, the exact
 * class of unjustified cost Milestone 9 Batch 7 (M9-038) already
 * establishes this codebase rejects. Since `isErrorMonitoringConfigured()`
 * is a genuine runtime branch (Next.js inlines `NEXT_PUBLIC_*` values,
 * but the surrounding `if` is still resolved at runtime, not eliminated
 * at build time), a static import cannot be tree-shaken away for the
 * common "not configured" case — only a dynamic `import()`, which the
 * bundler can split into its own chunk, actually defers that cost until
 * a deployer opts in. See `docs/PERFORMANCE_BASELINE.md`'s Batch 9
 * addendum for the "before"/"after" bundle numbers this fix produced.
 *
 * **"Do not send portfolio balances or sensitive user data
 * unnecessarily" is satisfied two ways, deliberately layered:**
 * 1. **Structural (primary guarantee).** `captureError`'s own
 *    `ErrorMonitoringContext` parameter is a narrow, fully-typed shape —
 *    four short string tags (`feature`/`operation`/`code`/`category`).
 *    There is no field, and no code path anywhere in this codebase, that
 *    can pass a `Portfolio`/`LoopStrategy`/other financial-data object
 *    through this function's own type signature. This is stronger than
 *    a runtime scrub of an open-ended object, which can always be
 *    bypassed by a future careless call site — the type system itself
 *    is the guarantee here.
 * 2. **Runtime scrub (defense in depth).** `beforeSend`/`beforeBreadcrumb`
 *    still redact any string value under a credential-shaped key name
 *    (reusing `services/shared/sensitiveFields.ts`'s own
 *    `SENSITIVE_FIELD_NAMES` detection), in case a future Sentry
 *    integration (e.g. a third-party integration that inspects
 *    `localStorage`) ever introduces one. `sendDefaultPii: false` is set
 *    explicitly rather than relying on the SDK's own current default,
 *    since a documented, explicit choice cannot silently change under a
 *    future SDK upgrade the way a default value could.
 *
 * **Explicit, honest scope boundary: `scrubEvent` does not touch
 * `event.exception` (the captured `Error`'s own `message`/stack trace),
 * only `extra`/`contexts`/`request`.** `scrubForTelemetry` redacts by
 * *object key name*; an `Error.message` is free text, not a keyed
 * object, so the identical technique cannot apply to it the same way.
 * This is safe under this codebase's own real call sites, not merely
 * assumed: `captureError` only ever receives a genuine uncaught
 * React-render exception (`app/error.tsx`/`app/global-error.tsx`) — a
 * generic engine/browser message (e.g. "Cannot read properties of
 * undefined"), never an application-authored one, since every
 * application-authored failure path returns an `ApplicationError`
 * instead of throwing (`services/shared/errors.ts`'s own DoD, confirmed
 * by M9-044's own repository-wide audit: zero bound `catch` blocks
 * anywhere in the non-test source tree ever surface a raw exception's
 * `.message`). This application's own domain model also has no wallet/
 * address field anywhere (`types/`, `services/persistence/schemas/`)
 * — Manual Mode never connects a real wallet (`01_PRD.md` REQ-010) — so
 * there is no address-shaped value for an exception message to ever
 * contain in the first place. A free-text pattern scrubber (regex over
 * `event.exception` for balance/address-shaped substrings) was
 * deliberately not built: there is no confirmed leak vector it would
 * close today, and a pattern scrubber's own false-positive/false-negative
 * tradeoffs are a real cost this task's own DoD does not require paying
 * for a risk that doesn't currently exist.
 *
 * **Captures "Unhandled exceptions"/"Route failures"** — wired into
 * `app/error.tsx`/`app/global-error.tsx` (M9-043's own boundaries,
 * this task's own named Dependency) — see those files for the call
 * sites. **"Import and migration failures"** — wired into the Settings
 * import handler, the one place these failures already reach a real,
 * tested user-facing surface (M9-046). **"Provider failures"** and
 * "Synchronization failures" are N/A for the identical reasons
 * `services/market/quote.ts`/`services/protocol/quote.ts`'s own header
 * comments established for M9-045, and Cloud Sync's own cancellation
 * established throughout Milestone 8/9 — there is no provider network
 * client or sync mechanism in this application version to fail. "Failed
 * critical workflows" beyond the above would mean instrumenting dozens
 * of individual Service call sites for failure modes that already
 * surface safely to the user via the existing `ApplicationError`/
 * `role="alert"` convention (M9-044's own audit) — deliberately not done
 * as a speculative, checklist-driven expansion; the two wired call sites
 * above are the ones this task's own Capture list names with a real,
 * reachable, already-tested failure path behind them.
 */
import type * as Sentry from '@sentry/nextjs';

import { env } from '@/utils/env';

import { scrubForTelemetry } from './scrub';

export interface ErrorMonitoringContext {
  feature?: string;
  operation?: string;
  code?: string;
  category?: string;
}

let sentryModulePromise: Promise<typeof Sentry> | null = null;
let initStarted = false;

/** Loads and caches the real Sentry module — only ever fetched once, and only when actually configured (every call site below already gates on `isErrorMonitoringConfigured()` first). */
function loadSentry(): Promise<typeof Sentry> {
  sentryModulePromise ??= import('@sentry/nextjs');
  return sentryModulePromise;
}

export function isErrorMonitoringConfigured(): boolean {
  return env.NEXT_PUBLIC_SENTRY_DSN !== undefined && env.NEXT_PUBLIC_SENTRY_DSN !== '';
}

function scrubEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  if (event.extra) event.extra = scrubForTelemetry(event.extra) as Sentry.ErrorEvent['extra'];
  if (event.contexts) {
    event.contexts = scrubForTelemetry(event.contexts) as Sentry.ErrorEvent['contexts'];
  }
  if (event.request) delete event.request;
  return event;
}

function scrubBreadcrumb(breadcrumb: Sentry.Breadcrumb): Sentry.Breadcrumb {
  if (breadcrumb.data) {
    breadcrumb.data = scrubForTelemetry(breadcrumb.data) as Sentry.Breadcrumb['data'];
  }
  return breadcrumb;
}

/**
 * Initializes Sentry once, only when configured. Safe to call from
 * every runtime entry point (`instrumentation-client.ts`,
 * `instrumentation.ts`) — a second call is a deliberate no-op, not a
 * re-initialization, since Sentry's own SDK does not itself guard
 * against a duplicate `init()` call. **`initStarted` is checked and set
 * synchronously, before the dynamic import resolves — found the hard
 * way, by a failing test**: caching only the `import()` promise
 * (`sentryModulePromise`) is not enough on its own, since two
 * synchronous calls to this function both read the same cached promise
 * and each attach their own `.then()`, so both still call
 * `SentryModule.init(...)` once the shared import resolves. Fire-and-
 * forget by design: callers are top-level instrumentation hooks with
 * nothing to await this against.
 */
export function initErrorMonitoring(): void {
  if (!isErrorMonitoringConfigured() || initStarted) return;
  initStarted = true;

  void loadSentry()
    .then((SentryModule) => {
      SentryModule.init({
        dsn: env.NEXT_PUBLIC_SENTRY_DSN,
        // No `environment` tag: setting it correctly would mean reading
        // `process.env.NODE_ENV` directly, which `tests/unit/services/serviceFoundation.test.ts`'s
        // own M3-013 regression test correctly forbids anywhere under
        // `services/` ("Avoid hardcoded infrastructure" — Services depend
        // only on `utils/env.ts`'s validated, injectable configuration,
        // never raw `process.env`). Sentry's own dashboard can still
        // separate environments by release/DSN if a deployer needs that;
        // this is optional metadata, not required for M9-049's own DoD.
        //
        // No performance tracing — this task's own scope is error
        // monitoring, not APM; enabling tracing would also mean deciding a
        // whole separate sampling/privacy posture this task does not ask
        // for.
        tracesSampleRate: 0,
        sendDefaultPii: false,
        beforeSend: scrubEvent,
        beforeBreadcrumb: scrubBreadcrumb,
      });
    })
    .catch(() => {
      // A failed dynamic import (or a throw inside Sentry's own `init`)
      // must never surface as an unhandled promise rejection — this
      // function's entire purpose is to never become a second source of
      // noise/failure for whatever code path triggered it.
    });
}

/**
 * Reports an unexpected exception. No-ops when unconfigured — callers
 * never need their own `isErrorMonitoringConfigured()` guard.
 * Fire-and-forget: reporting an error must never become a second point
 * of failure for whatever code path is already handling the first one.
 */
export function captureError(error: unknown, context: ErrorMonitoringContext = {}): void {
  if (!isErrorMonitoringConfigured()) return;

  const tags: Record<string, string> = {};
  if (context.feature !== undefined) tags.feature = context.feature;
  if (context.operation !== undefined) tags.operation = context.operation;
  if (context.code !== undefined) tags.code = context.code;
  if (context.category !== undefined) tags.category = context.category;

  void loadSentry()
    .then((SentryModule) => {
      SentryModule.captureException(error, { tags });
    })
    .catch(() => {
      // See `initErrorMonitoring`'s own identical guard above — a
      // telemetry-loading failure must never surface as an unhandled
      // rejection, and must never propagate back to whatever caller
      // (e.g. an error boundary) is already reporting a real failure.
    });
}
