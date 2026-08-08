# Changelog

`06_TASKS.md` M9-056 ("Complete Changelog and Version Metadata") —
Milestone 9 Batch 10. This is the first changelog this project has had.
It follows the spirit of [Keep a Changelog](https://keepachangelog.com/),
adapted for a project that has not shipped a tagged release yet: there is
one **[Unreleased]** section, no dated version history, and nothing here
is a release note for a release that hasn't happened. See
`PROJECT_STATUS.md` for the complete, authoritative, task-by-task build
record this file summarizes — this document does not replace it.

## Version metadata

ProfitPilot tracks four **independent** version numbers — they measure
different things and are not expected to match each other. Do not read a
difference between them as an inconsistency.

| Axis                        | Current value | Source                                                        |
| ---------------------------- | -------------- | -------------------------------------------------------------- |
| Application version           | `0.1.0`        | `package.json` `"version"`                                    |
| Engine version                 | `0.1.0`        | `ENGINE_VERSION` (`engine/shared/result.ts`)                   |
| Formula version                | `1.0`          | `FORMULA_VERSION`, identical across every `engine/**` calculation file — tracks `docs/02_Formulas.md`'s own document revision, not the application release |
| Storage schema version         | `1.0.0`        | `STORAGE_SCHEMA_VERSION` (`services/persistence/envelope.ts`)  |
| Database migration version     | N/A            | Cloud Database was cancelled by product decision (see "Persistence and local-first scope" in `CONTRIBUTING.md`) — there is no cloud database to version. The one migration-versioned system that exists is local storage, already covered by "Storage schema version" above; `REGISTERED_MIGRATIONS` (`services/persistence/migrations/migrate.ts`) is currently empty because schema `1.0.0` is the only version this application has ever shipped. |
| Release date                   | Not yet released | This application has not had a Release Candidate build or a tagged release. Milestone 9 Batch 11 (`docs/06_TASKS.md` M9-057–M9-064, "Release Candidate") is the specification's own gate for that — it has not run as of this document's most recent update. A real release date belongs here once it has. |

**Why the Application/Engine version (`0.1.0`) was not bumped to `1.0.0`
in this batch**: `06_TASKS.md` M9-056 is titled "Prepare Version 1
metadata" and its Definition of Done is that version information is
*consistent*, not that it equals `1.0.0` — and M9-064 ("Complete Version
1 Quality Sign-Off," the final task of the not-yet-run Release Candidate
batch) is the specification's own explicit gate for actually becoming
Version 1. Bumping the version number before that gate has been passed
would assert a production-readiness claim (full regression suite, smoke
tests, manual exploratory testing, migration/rollback validation, quality
sign-off) that has not yet been earned. The version stays `0.1.0` until
Batch 11 completes and this file is updated to say so.

## Known limitations

See `docs/USER_GUIDE.md` for the full user-facing list; summarized here:

- **Manual Mode only.** No live BTC price feed, no live Aave connection —
  every number is only as current as the last time a user updated it by
  hand.
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

## [Unreleased]

Nothing has been tagged or released. Work to date, by milestone (see
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
  Hardening (in progress).** Formula/service/workflow verification,
  accessibility hardening, security hardening, performance hardening,
  reliability and error handling (React error boundaries, disaster
  recovery documentation), observability (privacy-safe Sentry error
  monitoring, diagnostic events, incident response), and this batch's own
  documentation hardening (this file, `docs/USER_GUIDE.md`, an extended
  `CONTRIBUTING.md`, and one financial-disclosure wording fix — see
  `PROJECT_STATUS.md`'s Batch 10 write-up). The Release Candidate batch
  (M9-057–M9-064) has not yet run.
