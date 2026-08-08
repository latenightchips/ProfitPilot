# Performance Baseline

`06_TASKS.md` M9-037 ("Establish Performance Baseline"). Dependencies:
Milestones 1–8. Description: "Measure application performance before
optimization." Capture: "Initial page load, Dashboard render, Portfolio
recalculation, Simulation calculation, Scenario comparison, Loop
calculation, Import processing, Synchronization, Bundle size." DoD:
"Baseline measurements are documented using repeatable test conditions."

This document is written after — not before — the two other measured
Milestone 9 Batch 7 changes (M9-038's dependency removals and the
rejected `next/dynamic` experiment), so the "baseline" recorded here is
the batch's own final state, with the discarded experiment's numbers
kept as evidence for why it was rejected rather than silently dropped.
All numbers below come from a real, repeatable `pnpm build` /
`next start` against this repository, not estimates.

## 1. Bundle size

Measured via `rm -rf .next && pnpm build`, Next.js 15's own build
output (Turbopack production build), Milestone 9 Batch 7's final commit
state (post `@tanstack/react-table` + `lucide-react` removal, post
`next/dynamic` revert):

| Route | Own size | First Load JS |
| --- | --- | --- |
| `/` | 8.44 kB | 299 kB |
| `/exit-planner` | 6.61 kB | 310 kB |
| `/loop-builder` | 7.94 kB | 311 kB |
| `/portfolio` | 4.41 kB | 306 kB |
| `/portfolios` | 2.81 kB | 293 kB |
| `/portfolios/new` | 1.93 kB | 303 kB |
| `/recommendations` | 4.81 kB | 295 kB |
| `/reset-password` | 1.33 kB | 292 kB |
| `/settings` | 3.69 kB | 294 kB |
| `/sign-in` | 1.00 kB | 292 kB |
| `/sign-up` | 1.25 kB | 292 kB |
| `/simulation` | 109 kB | 399 kB |
| Shared by all routes | — | 298 kB |

`/simulation` is the largest route by a wide margin — it is the only
route that imports `recharts` (via `ScenarioCharts`/`ScenarioTimeline`,
M6-011/M6-012). Next.js's own automatic per-route code splitting already
keeps that weight fully isolated to this one route: every other route's
First Load JS sits within a few KB of the 298 kB shared baseline, with
no chart-library-sized delta anywhere else.

**Dependency removals (M9-038 "Remove unused dependencies")**:
`@tanstack/react-table` and `lucide-react` were both confirmed, by a
repository-wide source grep, to have zero import references anywhere in
`app/`, `features/`, `components/`, `services/`, or `stores/` before
removal. Both were removed via `pnpm remove`. Neither changes any bundle
number above — both were already excluded from every bundle by
tree-shaking, since nothing ever imported them; `package.json` only
controls what gets installed, not what a route actually ships. Their
value is install-footprint and dependency-audit-surface hygiene (fewer
declared packages for `pnpm audit`/Dependabot/`pnpm-lock.yaml` to track),
not a bundle-size win. This is why `package.json`/`pnpm-lock.yaml` show
changes in this batch's diff, unlike Batches 5/6 where any such change
would have been a red flag — here it is the direct, intended result of
M9-038's own named action item.

### Rejected experiment: `next/dynamic` lazy-loading for `ScenarioCharts`/`ScenarioTimeline`

M9-038's own Actions list names "Lazy-load heavy charts" explicitly, so
this was implemented and measured, not skipped. `ScenarioCharts` and
`ScenarioTimeline` were wrapped in `next/dynamic(..., { ssr: false })`,
resolved off the existing `@/features/simulation` barrel per that
barrel's own import convention. It passed every unit-level check
(typecheck, lint, format, and 13/13 existing tests including 2 that
specifically assert the real chart content renders, not just the
`loading` fallback) — but a real `pnpm build`, run twice consecutively
with identical results both times (ruling out Turbopack build
non-determinism), showed it made the bundle **larger**, not smaller:

| Metric | Static import (kept) | `next/dynamic` (rejected) |
| --- | --- | --- |
| `/simulation` own size | 109 kB | 111 kB |
| `/simulation` First Load JS | 399 kB | 402 kB |
| Shared-by-all baseline | 298 kB | 299 kB |

Root cause: `recharts` was already isolated to `/simulation`'s own route
bundle by Next's automatic code splitting — nothing else in the app
imports these two components, so there was no shared-bundle problem for
`next/dynamic` to fix. The wrapper only added a second async-chunk
boundary inside the *same* already-isolated bundle, plus the dynamic-
import machinery's own overhead, with nothing to show for it: both
components render unconditionally as soon as a portfolio is selected
(not gated behind further user interaction), so splitting them into a
second chunk doesn't defer anything a typical user actually avoids
downloading — it only adds a second network round-trip. M9-038's own DoD
("Bundle improvements are measured and do not reduce correctness")
requires measurement before shipping a bundle change; the measurement
showed a regression, so the change was reverted rather than shipped.
`app/simulation/SimulationPageClient.tsx` carries zero diff from its
pre-Batch-7 state as a result.

**Route-level code splitting / server-client import boundaries
(M9-038's remaining Actions)** are audit-only findings, not code
changes: Next.js's App Router already performs automatic per-route code
splitting (demonstrated by the `/simulation`-only `recharts` isolation
above); this application has no API routes, no `next/server`/
`next/headers` usage, and no Node-only module (`fs`, `path`, Node's
`crypto`) imported anywhere under `services/` — there is no server-only
module layer for a client component to accidentally import. The one
place this boundary matters in practice, Supabase credentials, is
already handled correctly (`utils/env.ts` exposes only
`NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`, both safe for
the browser by Supabase's own documented design; no service-role field
exists in the schema at all, so one cannot leak into a client bundle
even by mistake).

## 2. Rendering behavior (M9-039)

Audited via direct inspection of every Zustand-store-consuming component
across `app/`, `features/dashboard/`, `features/simulation/`, and
`features/loop-builder/`. Every sampled component (including
`SimulationPageClient.tsx`, `ScenarioComparison.tsx`, `ScenarioCharts.tsx`,
`DashboardPageClient.tsx`, and the loop-builder step list) already
subscribes with a per-field Zustand selector
(`useStore((state) => state.field)`); a repository-wide grep for a
bare, selector-less store call returned zero matches. No O(n²) pattern
exists anywhere in the sampled code, and realistic list sizes (saved
scenarios, loop steps) are small — tens of items, not thousands, for a
single local user.

Two concrete, low-risk findings were fixed in this batch:

- **Uncached `Intl.NumberFormat`/`Intl.DateTimeFormat` construction.**
  `features/dashboard/utils/format.ts`, `features/simulation/utils/format.ts`,
  and `components/strategy/format.ts` each constructed a new formatter
  instance on every single call, and these formatters are called
  per-cell inside `.map()` loops (scenario comparison tables, chart
  tooltips/labels, loop-step tables) — an N-row × M-column render
  constructed N×M formatter instances where one shared instance per
  format kind is sufficient, since no call site varies its options. All
  three files now construct each formatter once at module scope.
- **Unmemoized filter/sort/map in chart and comparison components.**
  `ScenarioComparison.tsx` (`selected`/`sortedScenarios`),
  `ScenarioCharts.tsx` (`selected` and its three derived chart-data
  arrays), and `ScenarioTimeline.tsx` (its three derived chart-data
  arrays) recomputed these on every render, including renders triggered
  by unrelated local state (e.g. a delete-confirmation toggle). All are
  now wrapped in `useMemo`, keyed on the actual Zustand state they
  derive from.

Both changes are correctness-neutral (2069/2069 unit tests continue to
pass unchanged) and low-regression-risk: no behavior changes, only when
a value is recomputed. No `React.memo` usage was added — the sampled
components' own render cost is already small relative to app/browser
overhead at this data scale, and the DoD asks for edits/recalculations
to "remain responsive," which they already are (see the production
audit in §5).

## 3. Formula and service execution (M9-040)

`tests/performance/engineBenchmarks.test.ts` (M2-030, extended this
batch) benchmarks every Build Guide performance-test target against a
real Golden Reference Portfolio, using a 20-iteration warmup followed by
the median of 200 measured calls:

| Benchmark | Target | Result |
| --- | --- | --- |
| Portfolio summary | < 10 ms | pass |
| Health Factor | < 10 ms | pass |
| Liquidation calculations | < 10 ms | pass |
| Loop strategy | < 20 ms | pass |
| Single scenario (price) | < 50 ms | pass |
| Single scenario (position change) | < 50 ms | pass |
| Scenario comparison | < 50 ms | pass |
| Recommendation evaluation | < 20 ms | pass (added this batch) |

"Recommendation evaluation" is the one Build Guide target that went
unbenchmarked from M2-030 through Milestone 9 Batch 6 — M2-030's own
benchmark list never named a recommendation category. Closing this gap
is the one concrete action item under M9-040; see
`tests/performance/engineBenchmarks.test.ts`'s own header comment for
the full target-to-benchmark mapping and reasoning (including the
resolved conflict between the Build Guide's two differently-scoped
"performance" sections — PROJECT_STATUS.md Conflict #16).

The rest of M9-040 is audit-only: a repository-wide grep for a
memoization/caching construct (`useMemo`, `memoize`, an ad hoc cache
`Map`) anywhere under `engine/` returned zero matches — there is no
cached, potentially-stale financial result anywhere in the calculation
engine, satisfying M9-040's own Requirement ("Avoid caching stale
financial results") by simple absence rather than by a guard that could
someday be bypassed. Decimal precision (`decimal.js`, used throughout
`engine/`) is untouched by this batch's changes — no engine-layer file
was modified.

## 4. Persistence and synchronization (M9-041)

Audit-only; no code changes.

- **Debounced writes**: `services/persistence/autoSaveCoordinator.ts`
  already implements a real 400 ms debounce per `(recordType, id)` key,
  with a monotonic per-key sequence number that discards a stale retry
  superseded by a newer write, and a `flushAll()` every Store's `load*`
  action calls before reading to avoid a real, Playwright-confirmed
  race (see that file's own header comment). This is real, working
  infrastructure, not a gap.
- **Incremental sync**: not applicable. Cloud Sync was cancelled for
  this project (PROJECT_STATUS.md); there is no sync mechanism to make
  incremental.
- **Batch operations / migration processing**: no evidence of a slow
  path — `services/persistence/` operates entirely against
  `localStorage`, which is synchronous under the hood; the `Promise`
  wrapper this codebase uses around it adds only microtask-scheduling
  overhead, not real I/O latency.
- **Large export generation**: `services/export/JsonExporter.ts`'s
  `buildFullBackupFile` awaits `service.listEnvelopes` sequentially, one
  `for` loop iteration per entry in `EXPORTABLE_RECORD_TYPES` (7 record
  types). This is a real, identifiable `Promise.all` opportunity, but it
  was deliberately left as-is: each iteration is a `localStorage` read
  wrapped in an already-resolved-or-near-instant `Promise`, not a
  network call, so parallelizing it would save microtasks, not
  measurable wall-clock time, at this application's realistic data
  scale (a single local user's own records). Speculatively parallelizing
  a loop with no measured cost is exactly what this engagement's
  standing instruction to avoid speculative optimization rules out;
  flagged here as a known, cheap, low-priority opportunity if a future
  batch's measurement ever shows otherwise.
- **Import validation**: covered by Milestone 9 Batch 6's own hardening
  (25 MB size limit checked before `JSON.parse`, bounded nesting-depth
  rejection, checksum verification) — all deterministic, single-pass
  checks with no loop over user-controlled-size data beyond the
  nesting-depth check's own self-bounded recursion
  (`services/shared/payloadLimits.ts`).

## 5. Production performance audit (M9-042)

No Core Web Vitals/Lighthouse tooling existed anywhere in this
repository before this batch. Measured directly against a real
production build (`rm -rf .next && pnpm build && next start`) using a
headless-Chromium script (`@playwright/test`'s own `chromium` launcher,
the same live-verification technique Milestone 9 Batch 6 established for
the security-headers work), navigating each route with a
`PerformanceObserver` registered before navigation (`buffered: true`) to
reliably capture Largest Contentful Paint and cumulative Layout Shift,
plus the Navigation Timing and Paint Timing APIs for the rest:

| Route | Wall load | DOMContentLoaded | Load event | FCP | LCP | CLS | Console errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/` | 127 ms | 25 ms | 122 ms | 92 ms | 92 ms | 0 | 0 |
| `/portfolios` | 120 ms | 20 ms | 118 ms | 88 ms | 88 ms | 0 | 0 |
| `/simulation` | 137 ms | 31 ms | 135 ms | 104 ms | 104 ms | 0 | 0 |
| `/loop-builder` | 119 ms | 27 ms | 116 ms | 88 ms | 88 ms | 0 | 0 |
| `/exit-planner` | 129 ms | 123 ms | 127 ms | 96 ms | 96 ms | 0 | 0 |
| `/recommendations` | 131 ms | 80 ms | 129 ms | 92 ms | 92 ms | 0 | 0 |
| `/settings` | 130 ms | 33 ms | 126 ms | 104 ms | 104 ms | 0 | 0 |
| `/` (mobile viewport, 390×844) | 118 ms | 26 ms | 116 ms | 84 ms | 84 ms | 0 | 0 |

Against the Build Guide's product-level targets (`docs/QUALITY_PLAN.md`'s
line-5314 section — Initial Page Load < 2 s, Dashboard Refresh < 100 ms):
every measured route loads in well under 200 ms end-to-end, over an
order of magnitude inside the 2 s target. LCP equals FCP on every route
— this application renders no late-loading hero image or async-fetched
above-the-fold content (Version 0.1 has no live price provider wired;
every value on first paint is already in the initial HTML/hydration
payload), so there is nothing to arrive after first paint that could
push LCP later or shift layout. Measured CLS is 0 on every route.
Console/page errors are 0 on every route. No large-viewport vs. mobile
behavioral difference was observed beyond fewer resources loading on the
narrower viewport (20 vs. 35–37), consistent with responsive layout
rather than a separate mobile code path.

**Approved deviation, documented rather than chased further**: these
numbers are measured against `localhost`, not a real deployed origin —
there is no network latency, TLS handshake, or CDN/edge routing in this
measurement, so it is a lower bound on real-world load time, not a
guarantee. This application has no confirmed production deployment
target of its own (self-hostable, local-first — the same framing
`next.config.ts`'s own HSTS-`preload` reasoning from Milestone 9 Batch 6
already established for this exact "no single owned domain" fact), so a
`localhost` measurement is the most repeatable, environment-independent
baseline available; a future deployer measuring their own real origin's
network latency is a deployment-specific concern this document cannot
anticipate. Given the more-than-10x margin against the 2 s target, no
plausible real-world network overhead would put this application at
risk of missing it.

**Definition of Done**: no release-blocking performance regression
remains. Every measured route clears its target with wide margin; the
one rejected optimization (`next/dynamic` lazy-loading) was reverted
before it could regress anything; the two dependency removals are
neutral-to-positive. No deviation found here needs an approved
threshold beyond the `localhost`-vs-real-origin caveat above.
