# Changelog

`06_TASKS.md` M9-056 ("Complete Changelog and Version Metadata") and
M9-064 ("Complete Version 1 Quality Sign-Off") — Milestone 9 Batches 10
and 11. This is the first changelog this project has had. It follows the
spirit of [Keep a Changelog](https://keepachangelog.com/). See
`PROJECT_STATUS.md` for the complete, authoritative, task-by-task build
record this file summarizes — this document does not replace it.

**What "released" means here**: Version 1.0.0 completed its Quality
Sign-Off (`06_TASKS.md` M9-064) in Milestone 9 Batch 11 — full regression
suite, smoke tests, manual exploratory testing, migration/rollback
validation, and open-defect review all passed with zero release-blocking
defects (see `docs/DEFECT_CLASSIFICATION.md` §6). **No live deployment
has occurred** — `M1-009` ("Deploy Initial Application") remains
explicitly deferred, unchanged since Milestone 1, and this is a
self-hostable product with no single owned production domain by design.
"Released" below means "the Release Candidate passed its quality gate
and is ready to be deployed," not "is live at a public URL."

## Version metadata

ProfitPilot tracks six **independent** version axes — they measure
different things and are not expected to match each other. Do not read a
difference between them as an inconsistency. This explicitly includes
**Documentation version** (below): a specification document's own
declared revision is a different concept from the Application, Engine,
Formula, or Storage schema version — it tracks that document's own
history, not what has actually been built or how persisted data is
shaped. See `docs/VERSIONING_STRATEGY.md` for the forward-looking policy
each axis follows going forward, not just its current value.

| Axis                        | Current value | Source                                                        |
| ---------------------------- | -------------- | -------------------------------------------------------------- |
| Application version           | `1.1.0`        | `package.json` `"version"`                                    |
| Engine version                 | `1.1.0`        | `ENGINE_VERSION` (`engine/shared/result.ts`)                   |
| Formula version                | `1.0`          | `FORMULA_VERSION`, identical across every `engine/**` calculation file — tracks `docs/02_Formulas.md`'s own document revision, not the application release. **Unchanged by V1.1** — none of the seven V1.1 batches modified a financial formula. |
| Storage schema version         | `1.0.0`        | `STORAGE_SCHEMA_VERSION` (`services/persistence/envelope.ts`). **Unchanged by V1.1** — Portfolio History and Apply-to-Portfolio both persist through the existing envelope/schema, adding no new schema version. |
| Database migration version     | N/A            | Cloud Database was cancelled by product decision (see "Persistence and local-first scope" in `CONTRIBUTING.md`) — there is no cloud database to version. The one migration-versioned system that exists is local storage, already covered by "Storage schema version" above; `REGISTERED_MIGRATIONS` (`services/persistence/migrations/migrate.ts`) is currently empty because schema `1.0.0` is the only version this application has ever shipped. |
| Documentation version          | Inconsistent — see below | Each specification document declares its own `Version` field, independent of the application version (`docs/06_TASKS.md` M10-003 finding, Milestone 10 Batch 1). `02_Formulas.md` through `06_TASKS.md` all declare `1.0`; `README.md` and `01_PRD.md`'s own header both still declare `0.1.0`, while `01_PRD.md`'s own footer declares `1.0` — an inconsistency within that single document, not just across documents. Recorded as `PROJECT_STATUS.md` Conflict #38, not silently corrected — these are frozen, protected specification documents this project's convention does not edit as part of ordinary work. |
| Sign-off completed (1.0.0)     | 2026-08-08     | Milestone 9 Batch 11 (M9-057–M9-064) — see `docs/DEFECT_CLASSIFICATION.md` §6 and `PROJECT_STATUS.md`'s Batch 11 write-up. Not a deployment date — see above. |
| Sign-off completed (1.1.0)     | 2026-08-31     | V1.1 Release Candidate audit (Batches 1–7) — see `docs/DEFECT_CLASSIFICATION.md`'s "V1.1 Release Candidate Review" section and the `[1.1.0]` entry below. Also not a deployment date. |

**Why the Application/Engine version is `1.1.0`, not a new `2.0.0`**:
V1.1 adds seven feature batches on top of Version 1.0.0's already-complete
scope (below) without changing the Engine's calculation surface,
persisted-data shape, or the Manual-Mode-by-default product boundary that
`01_PRD.md` reserves Version 2 for (a real, connected live price
feed/account is still not what this release does — see the `[1.1.0]`
entry below for exactly what "live" means in V1.1's own V3/V4 trust-parity
feature). A minor version bump, not a major one.

**Why the Application/Engine version was `1.0.0`, not `0.1.0`, at first
release**:
`01_PRD.md`'s own REQ-017 "FINAL ACCEPTANCE CRITERIA" defines "Version
1.0" as exactly this feature set (Portfolio Management, Mathematical
Engine, Risk Engine, Simulation Engine, Recommendation Engine, Exit
Planner, Dashboard, Scenario Comparison, State Engine, Testing Framework,
Security Framework, Documentation, CI/CD, AI Development Workspace,
Release Documentation) once quality-hardened — not a future live-price-
feed version (that is Version 2 scope, named separately and repeatedly
throughout `01_PRD.md`). `06_TASKS.md` M9-064's own Quality Sign-Off is
the specification's explicit gate for making that bump, and it has now
passed with zero release-blocking defects (`docs/DEFECT_CLASSIFICATION.md`
§6). "Manual Mode" (no live price feed, no live Aave connection) remains
this version's permanent, intentional functional scope, not something
the version number bump implies has changed — see `docs/USER_GUIDE.md`.

## Known limitations

See `docs/USER_GUIDE.md` for the full user-facing list; summarized here:

- **Manual Mode only.** No live BTC price feed, no live Aave connection —
  every number is only as current as the last time a user updated it by
  hand. This is Version 1.0's permanent, intentional scope, not a
  temporary gap — a live price feed is Version 2 scope.
- **No cloud backup, no cloud sync.** Cloud Database and Cloud Sync were
  cancelled by product decision (Milestone 8). A user's only backup is a
  file they export themselves.
- **No wallet connection, no transaction execution.** ProfitPilot never
  reads a real Aave position and never executes a real transaction.
- **Optional Authentication is dormant by default.** Signing in never
  changes how portfolio data is stored; it requires a deployer to
  configure Supabase, which this project's own default configuration does
  not do.
- **Automated cross-browser coverage is Chromium-only.** Firefox and
  Safari are covered by code-level review, not automated tests — see
  `docs/CROSS_BROWSER_REVIEW.md`.
- **No live Sentry project is configured by default.** Error monitoring
  infrastructure exists (`services/observability/`) but is inert unless a
  deployer sets `NEXT_PUBLIC_SENTRY_DSN` — see `docs/OBSERVABILITY.md`.
- **No persistence migration has ever shipped.** `REGISTERED_MIGRATIONS`
  is empty; the chain-walking mechanism is tested but has never run
  against real prior-version data, because no prior version has existed.
- **CI does not yet run the end-to-end (Playwright) test suite
  automatically.** The 151-test suite (including 43 accessibility tests)
  exists, is current, and is run manually before every release; it is not
  wired into `.github/workflows/ci.yml` yet. Tracked as a non-blocking,
  documented item — see `docs/DEFECT_CLASSIFICATION.md` §6.
- **No live deployment exists.** Self-hostable, no owned production
  domain by design — see "What 'released' means here" above.
- **CI runs a blocking production smoke gate on every PR/push and a
  manual full-suite release gate on demand — not the full suite on
  every push.** See "Post-M10 hardening (R1/R2)" below.
- **1 `pnpm audit --prod` finding remains (`sharp`, confirmed unused,
  tracked)**, down from the original full-tree count. See "Post-M10
  hardening (R1/R2)" below.

## [1.1.0] — 2026-08-31

Seven capability batches built on top of Version 1.0.0 (which already
includes the R1/R2 production-readiness hardening recorded below this
entry, completed before the `v1.0.0` tag was created). Full detail on
every batch's own audit, implementation, and test record lives in
`PROJECT_STATUS.md`'s "V1.1 Release Reconciliation" section; this entry
summarizes what changed for a user.

- **Live-data trust parity (Aave V3).** Before this release, a live V3
  fetch that disagreed with an existing manually entered market price or
  protocol parameter silently overwrote it. V3 now behaves exactly like
  V4 already did: a disagreement is held as a pending candidate and
  surfaced as an explicit "Use Live Data" / "Keep Manual" confirmation on
  the Portfolio page, never applied silently.
- **Portfolio History.** Every portfolio now keeps an automatic,
  append-only timeline of meaningful changes — a snapshot is recorded on
  creation, on an explicit save, and whenever accepted live data or an
  applied change materially moves Health Factor, collateral/debt value,
  LTV, leverage, or borrow APR. Shown as a Health Factor trend chart plus
  a table of before/after deltas (a responsive card list below `sm:` on
  mobile), with the table remaining the accessible primary source.
- **Apply-to-Portfolio.** Simulation, Loop Builder, Exit Planner, and
  Recommendation Detail can now write a proposed outcome directly to the
  tracked portfolio, through one shared review-and-confirm component
  (current vs. proposed Health Factor, leverage, LTV, liquidation price,
  and annual borrowing cost). Never applies silently; refuses outright if
  the portfolio changed since the proposal was generated (a stale-apply
  guard) rather than applying stale assumptions.
- **Full-exit / zero-state robustness.** Hardened the zero-debt,
  zero-collateral, and zero-collateral-plus-zero-debt boundary cases
  across the Engine, History, and Apply paths so a full exit (or a
  freshly created, not-yet-funded portfolio) never produces a fabricated
  number, a `NaN`, or an inconsistent Infinity-Health-Factor rendering
  anywhere it now appears (History rows, Apply review, recommendation
  impact figures).
- **Recommendation explainability.** Each recommendation now shows a
  Quantified Impact (real before/after portfolio figures, reusing the
  same Apply proposal machinery above), a plain-language Risk/Tradeoff
  and Cost Impact statement, and a Data Confidence note — and can be
  applied directly via the same Apply-to-Portfolio review, alongside its
  existing "open in Exit Planner/Simulation" prefill action.
- **Data freshness / live-status UX.** Every place that shows a
  manually-entered value that has a live counterpart (Strategy
  Assumptions, Simulation Assumptions) now states plainly whether that
  value is live, manual, or manual-and-stale, instead of leaving the
  distinction implicit. Simulation's own V4 staleness gate now warns
  rather than blocking the workspace outright.
- **Mobile & responsive product pass.** Closed a real, previously
  accepted gap: primary navigation had no mobile equivalent at all below
  768px (worked around only via Dashboard Quick Actions since Milestone
  9). A mobile navigation panel now reaches every route; Portfolio
  History, the Apply-to-Portfolio review grid, and a real header
  horizontal-overflow bug (found empirically, not assumed) were also
  fixed. No visual redesign — existing desktop layout is pixel-identical.

**Explicitly unchanged in V1.1**: no financial formula (`FORMULA_VERSION`
stays `1.0`), no persisted-data schema (`STORAGE_SCHEMA_VERSION` stays
`1.0.0`), no live wallet/transaction capability, no new external service
dependency, and no change to the Path B (self-hostable, no operated
production deployment) deployment disposition — see
`docs/DEPLOYMENT_DISPOSITION.md`.

**Release-blocking defects at RC sign-off**: zero P0, zero unapproved P1.
See `docs/DEFECT_CLASSIFICATION.md`'s "V1.1 Release Candidate Review"
section for the full review.

## [Unreleased] — Post-M10 hardening (R1/R2)

**No version-axis bump accompanies this section** — none of this work
changes `package.json`'s `"version"`, `APP_VERSION`, `ENGINE_VERSION`,
`FORMULA_VERSION`, or `STORAGE_SCHEMA_VERSION`; Version 1.0.0's own
Quality Sign-Off (below) is unchanged and not reopened. This entry
records production-readiness and security hardening completed *after*
Milestone 10's own closure (`PROJECT_STATUS.md`'s "Post-Milestone-10
Hardening" section has the full task-by-task record) but *before* any
`v1.0.0` tag has been created — see "What 'released' means here" above;
that has still not happened. **No production deployment occurred as
part of this work.**

- **Aave API rate limiting.** The three public `/api/aave/*` routes
  (proxies into RPC infrastructure, previously unthrottled at the
  application level) now return `429` with a machine-readable error and
  a `Retry-After` header once a client identity exceeds 30 requests per
  60-second window. Implemented as a framework-free policy/limiter
  (`services/rateLimit/`) plus a `middleware.ts` glue layer. Documented,
  not glossed over: this is a process-local, in-memory control, not a
  substitute for infrastructure-level/distributed throttling — see
  `docs/PRODUCTION_READINESS.md` §7.
- **CI least-privilege permissions.** `.github/workflows/ci.yml` now
  declares an explicit `permissions: contents: read`, rather than
  inheriting the default (broader) token scope.
- **Node 22 / pnpm 10 runtime pinning.** `package.json`'s `engines`
  field and a committed `.nvmrc` make the supported runtime
  machine-checkable, matching what `04_BUILD_GUIDE.md` already stated in
  prose.
- **Production smoke CI gate.** A small, targeted Playwright spec
  (`tests/e2e/productionSmoke.spec.ts`) now runs in `ci.yml` on every
  PR/push against a real `pnpm build && pnpm start` server, proving the
  built production application actually starts and serves its critical
  routes.
- **Aave API unexpected-exception boundaries.** All three `/api/aave/*`
  route handlers are now wrapped so that an exception escaping the
  existing adapter/error-classification layers still produces a stable
  JSON error contract and an appropriate `5xx` response, never a raw
  stack trace or internal implementation detail, with diagnostics
  captured for operators.
- **Supabase rejected-promise hardening.** Every async
  `services/auth/authService.ts` method now routes its
  `@supabase/supabase-js` call through a shared helper so a genuine
  network/runtime rejection cannot escape as an unhandled promise
  rejection or leave authentication state inconsistent. Does not change
  authentication's dormant-by-default behavior.
- **Permissions-Policy header.** `next.config.ts` now denies eight
  unused browser capabilities (camera, microphone, geolocation, payment,
  usb, magnetometer, gyroscope, accelerometer) by an empty allowlist,
  chosen after a repository-wide search confirmed zero production-code
  use of any of them.
- **Dependency audit remediation and ongoing tracking policy.**
  `pnpm.overrides` closes 8 of 9 `pnpm audit --prod` findings
  (`postcss`/`nanoid`/`brace-expansion`/`fast-uri`); the 1 remaining
  (`sharp`) is confirmed unused and deliberately tracked rather than
  overridden (native-binary risk). `docs/SECURITY_REVIEW.md` and
  `docs/MAINTENANCE_SCHEDULE.md` establish the standing `pnpm audit
  --prod` release-gate policy going forward.
- **Manual full-E2E release workflow.** The existing 150-test Playwright
  suite (all 43 accessibility tests included) now runs via a manual
  `workflow_dispatch` workflow (`.github/workflows/e2e-full.yml`) as a
  release gate, deliberately excluding `productionSmoke.spec.ts` (already
  covered independently in `ci.yml`; running it again inside the full
  suite collides with the rate limiter's documented process-local
  fallback identity in an environment with no reverse proxy).

**Validation**: every item above shipped behind the standing `pnpm
validate` pipeline (typecheck/lint/format/unit tests/production build),
run fresh for each change, with focused regression tests added per
change. See `PROJECT_STATUS.md`'s "Post-Milestone-10 Hardening"
section for the full audit-implement-test-validate record per item, and
`docs/DEPLOYMENT_DISPOSITION.md` for confirmation that none of this
work changes the Path B deployment disposition below.

## [1.0.0] — 2026-08-08

Version 1 Quality Sign-Off complete (`06_TASKS.md` M9-064). Everything
built across Milestones 1–9, summarized by milestone (see
`PROJECT_STATUS.md` for full detail on every task, conflict, and
deviation):

- **Milestone 1 — Project Setup.** Next.js/TypeScript/Turbopack scaffold,
  code quality tooling, testing tooling, application shell, environment
  configuration, CI pipeline, developer documentation.
- **Milestone 2 — Formula Engine.** The pure, deterministic financial
  calculation core (`engine/`) — portfolio, health/risk, liquidation,
  interest, loop, simulation, exit, and recommendation formulas — within
  the documented Version 1 scope (single-asset BTC collateral / one
  stablecoin debt).
- **Milestone 3 — Core Services.** The orchestration layer between the
  Engine and the UI (`services/`).
- **Milestone 4 — Portfolio Management.** Creating, editing, duplicating,
  archiving, and deleting portfolios.
- **Milestone 5 — Dashboard.** The Health Factor / LTV / liquidation /
  net worth summary view, Quick Actions, Data Freshness, risk warnings.
- **Milestone 6 — Simulation Workspace.** "What happens if...?" scenario
  modeling, saved scenarios, comparison, export.
- **Milestone 7 — Strategy Tools.** Loop Builder and Exit Planner.
- **Milestone 8 — Persistence, Authentication, Import/Export.** Local
  storage schema versioning, optional dormant Supabase Authentication,
  full backup/single-record export and import (with 4 merge modes),
  Recovery Snapshots, privacy/security review. Cloud Database and Cloud
  Sync were cancelled by product decision during this milestone and
  remain cancelled.
- **Milestone 9 — Quality, Accessibility, Security, Performance & Release
  Hardening.** Formula/service/workflow verification, accessibility
  hardening (WCAG AA, `docs/ACCESSIBILITY_CONFORMANCE.md`), security
  hardening (headers, dependency audit, `docs/SECURITY_REVIEW.md`),
  performance hardening (`docs/PERFORMANCE_BASELINE.md`), reliability and
  error handling (React error boundaries, `docs/DISASTER_RECOVERY.md`),
  observability (privacy-safe Sentry error monitoring, diagnostic events,
  `docs/OBSERVABILITY.md`, `docs/INCIDENT_RESPONSE.md`), documentation
  hardening (this file, `docs/USER_GUIDE.md`, an extended
  `CONTRIBUTING.md`, one financial-disclosure wording fix), and the
  Release Candidate process itself (RC build, smoke tests, full
  regression suite, manual exploratory testing, migration/rollback
  validation, open-defect review, and this Quality Sign-Off —
  `docs/DEFECT_CLASSIFICATION.md` §6).

**Release-blocking defects at sign-off**: zero P0, zero unapproved P1.
See `docs/DEFECT_CLASSIFICATION.md` §6 for the full open-item review and
severity classification of every remaining known limitation.
