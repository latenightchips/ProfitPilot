/**
 * Structured Diagnostic Logging — 06_TASKS.md M9-050 ("Implement
 * Structured Diagnostic Logging"). Dependencies: M9-049. Description:
 * "Create structured diagnostic events." Include: "Event category, Error
 * code, Application version, Engine version, Formula version where
 * relevant, Feature, Operation, Success or failure, Sanitized context."
 * DoD: "Logs support investigation without containing prohibited
 * sensitive values."
 *
 * **`engineVersion`/`formulaVersion` are genuinely optional ("where
 * relevant"), not always populated — matching the literal wording, not
 * inventing a value.** `engine/shared/result.ts`'s own `ENGINE_VERSION`
 * constant is private (unexported) by design — it only ever appears as
 * `FormulaResult.metadata.engineVersion`/`formulaVersion` on the result
 * of an actual Engine calculation. A caller that has one (e.g. a Service
 * wrapping a failed `FormulaResult`) passes those two fields through;
 * an app-level event with no Engine call behind it (a route crash, an
 * import failure) correctly omits them rather than fabricating a value.
 *
 * **"Sanitized context" reuses `./scrub.ts`'s `scrubForTelemetry`** —
 * the identical redaction `errorMonitoring.ts` applies to Sentry events,
 * applied here to every event's own `context` field before it is ever
 * logged or forwarded, so this module carries the same "Do not send
 * portfolio balances or sensitive user data unnecessarily" guarantee
 * M9-049 already established, not a second, independently-reasoned one.
 *
 * **`logDiagnosticEvent` always writes to the console, Sentry
 * configured or not** — this is the one real, always-available
 * "structured log" this local-first application has (no separate
 * logging backend exists, or is in scope, for a client-only app); when
 * Sentry *is* configured, the same event is also forwarded as a
 * breadcrumb (`success`) or a captured message with the event attached
 * as extra context (`failure`) — feeding Milestone 9 Batch 9's own
 * M9-051 ("Release Health Metrics") directly, since Sentry's own
 * Issues/Discover dashboards are exactly where "failed import rate" or
 * similar aggregate metrics would actually be computed once a live
 * project exists — see `docs/OBSERVABILITY.md`'s own M9-051 section for
 * the full mapping.
 */
import type * as Sentry from '@sentry/nextjs';

import { APP_VERSION } from '@/services/persistence';

import { scrubForTelemetry } from './scrub';

export type DiagnosticOutcome = 'success' | 'failure';

/**
 * Flat, primitive-values-only — a genuine privacy tightening, not the
 * original design. `context` was originally `Record<string, unknown>`,
 * which could structurally accept a nested object (e.g. an entire
 * `Portfolio`), leaving "no portfolio balances or sensitive data" resting
 * only on `scrubForTelemetry`'s own credential-*name* detection — a real
 * gap for a non-credential-shaped key like `balance`/`collateralValue`,
 * which `services/shared/sensitiveFields.ts`'s own `SENSITIVE_FIELD_NAMES`
 * deliberately does not (and should not) cover, since that list's own
 * scope is "Never store" *credential* fields (M8-051), not financial
 * ones. Restricting `context` to flat primitives closes off "attach a
 * whole object" structurally, the same class of guarantee
 * `ErrorMonitoringContext` already gives `captureError` — a future call
 * site can still choose an ill-advised primitive value (e.g.
 * `{ balance: 50000 }`), which no type system can prevent, but it can no
 * longer smuggle an entire financial record through by accident.
 */
export type DiagnosticContext = Record<string, string | number | boolean>;

export interface DiagnosticEvent {
  category: string;
  code: string | null;
  appVersion: string;
  engineVersion?: string;
  formulaVersion?: string;
  feature: string;
  operation: string;
  outcome: DiagnosticOutcome;
  context: DiagnosticContext;
  timestamp: string;
}

export interface BuildDiagnosticEventInput {
  category: string;
  code?: string;
  engineVersion?: string;
  formulaVersion?: string;
  feature: string;
  operation: string;
  outcome: DiagnosticOutcome;
  /** Raw, unsanitized context — `buildDiagnosticEvent` scrubs it before it ever reaches the returned event. */
  context?: DiagnosticContext;
}

export function buildDiagnosticEvent(input: BuildDiagnosticEventInput): DiagnosticEvent {
  return {
    category: input.category,
    code: input.code ?? null,
    appVersion: APP_VERSION,
    engineVersion: input.engineVersion,
    formulaVersion: input.formulaVersion,
    feature: input.feature,
    operation: input.operation,
    outcome: input.outcome,
    context: scrubForTelemetry(input.context ?? {}) as DiagnosticContext,
    timestamp: new Date().toISOString(),
  };
}

let sentryModulePromise: Promise<typeof Sentry> | null = null;

function loadSentry(): Promise<typeof Sentry> {
  sentryModulePromise ??= import('@sentry/nextjs');
  return sentryModulePromise;
}

/**
 * Logs a structured diagnostic event. Safe to call unconditionally —
 * the console write always happens; the Sentry forward is internally
 * gated on `isErrorMonitoringConfigured()` the same way `captureError`
 * is, via the same dynamic-import path (`errorMonitoring.ts`'s own
 * header comment explains why a static import here would regress every
 * route's bundle size the same way it did before that fix).
 */
export function logDiagnosticEvent(event: DiagnosticEvent): void {
  if (event.outcome === 'failure') {
    console.error('[diagnostic]', event);
  } else {
    console.info('[diagnostic]', event);
  }

  // Local import to avoid a static, always-bundled dependency on
  // `errorMonitoring.ts`'s own gate — see that module for
  // `isErrorMonitoringConfigured`'s definition.
  import('./errorMonitoring')
    .then(({ isErrorMonitoringConfigured }) => {
      if (!isErrorMonitoringConfigured()) return;
      void loadSentry().then((SentryModule) => {
        if (event.outcome === 'failure') {
          SentryModule.captureMessage(`${event.category}: ${event.operation} failed`, {
            level: 'warning',
            tags: { feature: event.feature, category: event.category, code: event.code ?? '' },
            extra: { context: event.context },
          });
        } else {
          SentryModule.addBreadcrumb({
            category: event.category,
            message: `${event.feature}: ${event.operation}`,
            level: 'info',
            data: event.context,
          });
        }
      });
    })
    .catch(() => {
      // Diagnostic logging must never itself become a new failure —
      // the console write above already happened regardless.
    });
}
