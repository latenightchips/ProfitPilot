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

ProfitPilot tracks four **independent** version numbers — they measure
different things and are not expected to match each other. Do not read a
difference between them as an inconsistency.

| Axis                        | Current value | Source                                                        |
| ---------------------------- | -------------- | -------------------------------------------------------------- |
| Application version           | `1.0.0`        | `package.json` `"version"`                                    |
| Engine version                 | `1.0.0`        | `ENGINE_VERSION` (`engine/shared/result.ts`)                   |
| Formula version                | `1.0`          | `FORMULA_VERSION`, identical across every `engine/**` calculation file — tracks `docs/02_Formulas.md`'s own document revision, not the application release |
| Storage schema version         | `1.0.0`        | `STORAGE_SCHEMA_VERSION` (`services/persistence/envelope.ts`)  |
| Database migration version     | N/A            | Cloud Database was cancelled by product decision (see "Persistence and local-first scope" in `CONTRIBUTING.md`) — there is no cloud database to version. The one migration-versioned system that exists is local storage, already covered by "Storage schema version" above; `REGISTERED_MIGRATIONS` (`services/persistence/migrations/migrate.ts`) is currently empty because schema `1.0.0` is the only version this application has ever shipped. |
| Sign-off completed             | 2026-08-08     | Milestone 9 Batch 11 (M9-057–M9-064) — see `docs/DEFECT_CLASSIFICATION.md` §6 and `PROJECT_STATUS.md`'s Batch 11 write-up. Not a deployment date — see above. |

**Why the Application/Engine version is now `1.0.0`, not `0.1.0`**:
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
