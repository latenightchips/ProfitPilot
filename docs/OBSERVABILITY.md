# Observability

`06_TASKS.md` M9-049 ("Implement Production Error Monitoring"), M9-050
("Implement Structured Diagnostic Logging"), and M9-051 ("Implement
Release Health Metrics") — Milestone 9 Batch 9. This document covers all
three together since they share one implementation
(`services/observability/`) and one governing constraint: **no live
Sentry project exists in this environment**, the same "dormant, fully-
functional-with-zero-configuration" posture `services/auth/` already
established for Supabase. Every function below is a real, tested no-op
until a deployer sets `NEXT_PUBLIC_SENTRY_DSN` — nothing here was
verified against a live backend, only against a mocked `@sentry/nextjs`
module (`tests/unit/services/observability/`).

## M9-049 — Production Error Monitoring

**Genuine, full gap, confirmed empty before this batch.**
`docs/DOD_COMPLIANCE_AUDIT.md`'s own Batch 1 re-check and
`docs/SECURITY_REVIEW.md`'s own M9-029 section both found `@sentry/nextjs`
installed but completely unwired. `services/observability/errorMonitoring.ts`
is that wiring: `isErrorMonitoringConfigured()`, `initErrorMonitoring()`,
`captureError(error, context)`.

### Wiring

- `instrumentation-client.ts` (project root) — calls `initErrorMonitoring()`
  for the browser runtime. This application is almost entirely client-
  rendered (every route prerenders statically), so this is the
  meaningful integration point.
- `instrumentation.ts` (project root) — Next.js's own native `register()`
  hook, calls the identical function for the server/edge runtime, for
  completeness (this codebase has no API routes/middleware for a
  request to fail inside).
- `next.config.ts` — wrapped with `withSentryConfig`, with source-map
  upload and telemetry explicitly disabled (`sourcemaps: { disable: true }`,
  `telemetry: false`, `silent: true`) — the build-time equivalent of the
  same "never contact a real backend with no credential" constraint.
- `app/error.tsx` / `app/global-error.tsx` (M9-043, this task's own named
  Dependency) — call `captureError` alongside their existing
  `console.error`. This is the "Unhandled exceptions"/"Route failures"
  Capture item.
- `app/settings/SettingsPageClient.tsx` — calls `logDiagnosticEvent`
  (M9-050) on both import failure paths. This is the "Import and
  migration failures" Capture item.

### N/A Capture items

- **"Provider failures"**: no live `PriceProvider`/`ProtocolProvider`
  adapter exists anywhere (Manual Mode, `01_PRD.md` REQ-010) — documented
  directly in `services/market/quote.ts`/`services/protocol/quote.ts`'s
  own header comments, citing this task by number.
- **"Synchronization failures"**: Cloud Sync is cancelled
  (`docs/MILESTONE_8_SCOPE_CHANGE.md`) — there is no sync mechanism to
  fail.
- **"Failed critical workflows" beyond the two wired call sites**: every
  other calculation/persistence path already returns a
  `FormulaResult`/`MappingResult` discriminated union and surfaces safely
  via the existing `ApplicationError`/`role="alert"` convention
  (M9-044's own audit) — instrumenting dozens of additional Service call
  sites for failure modes that already have a working, tested display
  path would be exactly the "change merely to satisfy a checklist item"
  this batch's own governing instruction rules out.

### Privacy ("Do not send portfolio balances or sensitive user data unnecessarily")

Two deliberately layered guarantees:

1. **Structural (primary).** `captureError`'s `ErrorMonitoringContext`
   parameter is a narrow, fully-typed shape — four short string tags
   (`feature`/`operation`/`code`/`category`). `buildDiagnosticEvent`'s
   `context` parameter (`DiagnosticContext`) is flat, primitive-values-
   only (`Record<string, string | number | boolean>`) — a deliberate
   tightening during this batch's own pre-commit review, not the
   original design (an earlier `Record<string, unknown>` shape could
   structurally accept a nested object, e.g. an entire `Portfolio`).
   Neither signature can structurally accept a `Portfolio`/`LoopStrategy`/
   other financial-data *object* anywhere in this codebase; a future call
   site could still choose an ill-advised primitive value (no type system
   prevents that), which is exactly what layer 2 below exists for.
2. **Runtime scrub (defense in depth).** `services/observability/scrub.ts`'s
   `scrubForTelemetry` redacts any value reachable under a credential-
   shaped key name (reusing `services/shared/sensitiveFields.ts`'s own
   `isSensitiveFieldName`), applied to every Sentry event's `extra`/
   `contexts`/breadcrumb `data`, and to every `DiagnosticEvent.context`
   before it is ever logged or forwarded. `sendDefaultPii: false` is set
   explicitly on `Sentry.init()` rather than relying on the SDK's current
   default. `event.request` is stripped entirely (no URL/header data is
   ever sent).

**Explicit scope boundary, not an oversight: the scrub does not touch
`event.exception` (the captured `Error`'s own `message`/stack trace).**
`scrubForTelemetry` redacts by object *key name*; an `Error.message` is
free text, not a keyed object, so the same technique does not apply to
it. This is safe under this codebase's own real call sites, verified via
M9-044's own repository-wide audit (zero bound `catch` blocks anywhere
surface a raw exception's `.message` — every application-authored
failure path returns an `ApplicationError` instead of throwing) — every
exception `captureError` actually receives is a generic React/browser
message, never one built from application data. This application's own
domain model also has no wallet/address field anywhere, so there is no
address-shaped value an exception message could contain in the first
place. A free-text pattern scrubber over `event.exception` was
deliberately not built — there is no confirmed leak vector it would
close today, and its own false-positive/false-negative tradeoffs are a
real cost not justified by a risk that doesn't currently exist. See
`services/observability/errorMonitoring.ts`'s own header comment for the
full reasoning, and its own test suite's "does not scrub
event.exception" case for the behavior locked in as a regression test.

### A real, measured bundle-size fix

A first implementation used a static `import * as Sentry from '@sentry/nextjs'`
in `errorMonitoring.ts`. Because that file is reached from
`instrumentation-client.ts` (unconditionally executed on every page
load), a real `rm -rf .next && pnpm build` showed this pulled the entire
Sentry client SDK into the **shared bundle every route pays for**,
regardless of whether a DSN is ever configured:

| State | Shared bundle |
| --- | --- |
| Before Sentry wiring (Batch 8 baseline) | ~299 kB |
| Static `import * as Sentry` (rejected) | ~375 kB |
| Dynamic `import('@sentry/nextjs')` (shipped) | ~302–303 kB |

`isErrorMonitoringConfigured()` is a genuine runtime branch — Next.js
inlines `NEXT_PUBLIC_*` values, but the surrounding `if` is still
resolved at runtime, not eliminated at build time — so a static import
cannot be tree-shaken away for the common "not configured" case. Every
function in `errorMonitoring.ts`/`diagnosticEvent.ts` that needs the real
SDK now loads it via a cached dynamic `import()`, deferring that cost to
an async chunk that never loads in this environment (no DSN configured)
and only loads for a deployer who actually opts in — the same class of
fix Milestone 9 Batch 7 (M9-038) already established this codebase's own
performance discipline requires, applied here to infrastructure that
happens to be conditional in the same way. The remaining ~4 kB delta is
the thin, always-loaded wrapper code itself (`instrumentation-client.ts`,
the configuration check, the two boundary call sites) — an unavoidable,
minimal cost of having this infrastructure available at all.

`app/settings/SettingsPageClient.tsx`'s own `import-in-the-middle`/
`require-in-the-middle` build warnings are a known, accepted limitation,
not a functional break: `@sentry/nextjs`'s server-side OpenTelemetry
auto-instrumentation depends on these packages being resolvable as
`serverExternalPackages`, which pnpm's strict (non-hoisted) `node_modules`
layout doesn't expose from the project root. The build still succeeds;
this only affects *automatic* instrumentation of server code this
near-fully-static application barely has — the explicit `captureException`/
`captureMessage` calls this batch actually wires work regardless. Adding
the two packages as direct dependencies purely to silence this warning
was deliberately not done — no genuine Capture item depends on it.

## M9-050 — Structured Diagnostic Logging

`services/observability/diagnosticEvent.ts`'s `DiagnosticEvent` carries
every field M9-050's own Include list names: `category`, `code` (or
`null`), `appVersion` (`services/persistence/envelope.ts`'s real
`APP_VERSION`), `engineVersion`/`formulaVersion` (genuinely optional —
"where relevant" — populated only when a caller has an actual
`FormulaResult.metadata` to pass through; an app-level event like an
import failure correctly omits them rather than fabricating a value),
`feature`, `operation`, `outcome` (`'success' | 'failure'`), and
`context` (sanitized per the privacy section above).

`logDiagnosticEvent` **always** writes to the console (`console.error`
for a failure, `console.info` for success) — this is the one real,
always-available "structured log" a purely local-first, client-only
application has; there is no separate logging backend in scope. When
Sentry *is* configured, the same event is also forwarded: a failure
becomes a captured message (level `warning`, tagged by
feature/category/code, the event's own context attached as `extra`); a
success becomes a breadcrumb. This feeds M9-051 directly — see below.

## M9-051 — Release Health Metrics

**No new code** — this task's own DoD ("Release health can be evaluated
without collecting unnecessary financial data") is about what M9-049/
M9-050 already provide once a deployer configures a real Sentry project,
not a second, independently-built local analytics system. This
application has no backend to aggregate metrics across sessions/devices
except Sentry itself once configured; building a redundant local
counter with nowhere durable to report it would be exactly the kind of
speculative infrastructure this engagement's own standing instruction
against manufacturing unjustified code rules out.

Mapping each named example metric to what actually provides it:

| Example metric | Source |
| --- | --- |
| Application error rate | Sentry's own Issues dashboard, populated automatically by every `captureError`/`captureException` call once a live project exists — no custom code needed. |
| Failed import rate | `logDiagnosticEvent`'s own Sentry-message forwarding (`category: 'import'`, `outcome: 'failure'`) — aggregable via Sentry's own Discover/Issues search once live. |
| Critical workflow completion rate | The same `logDiagnosticEvent` mechanism, for any future workflow a deployer wants tracked — the infrastructure exists; no specific workflow beyond import is wired yet (see M9-049's own "deliberately not done" reasoning above). |
| Failed synchronization rate | **N/A** — Cloud Sync is cancelled; there is no synchronization to measure. |
| Provider fallback rate | **N/A** — no live price/protocol provider adapter exists (Manual Mode); `services/market/quote.ts`'s own Fresh/Stale/Unavailable classification is a Service-layer concern already covered by its own 16 unit tests, not a production telemetry concern. |

Sentry's own SDK also tracks session/release health (crash-free
sessions, adoption) automatically once initialized in a browser context
— this is default SDK behavior in the installed `@sentry/nextjs@10.67.0`
version (there is no `autoSessionTracking` option to configure in this
version; it is simply how the client SDK behaves), requiring no
additional code from this application beyond the `initErrorMonitoring()`
call M9-049 already wires.
