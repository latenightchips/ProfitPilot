# Release Notes

`06_TASKS.md` M10-004 ("Prepare Release Notes") — Milestone 10 Batch 1.
Dependencies: M10-003. Description: "Document major features, known
limitations, supported browsers, supported devices, storage options,
authentication options, import/export capabilities, breaking changes,
upgrade instructions." DoD: "Release notes accurately describe Version 1."

This document is new — distinct from `docs/CHANGELOG.md`, which is an
engineering audit trail organized by version/milestone. This is a
release-facing summary of what Version 1.0.0 actually is, for someone
deciding whether and how to run it. See `docs/USER_GUIDE.md` for full
usage instructions and `docs/CHANGELOG.md` for the complete build
history and version-metadata record.

## Version 1.0.0

Quality Sign-Off completed Milestone 9 Batch 11 (`06_TASKS.md` M9-064),
with zero release-blocking (P0/P1) defects — see
`docs/DEFECT_CLASSIFICATION.md` §6 for the full review. **This is a
self-hostable software release, not a hosted product** — no publicly
operated production deployment exists for Version 1.0.0 (see "Deployment"
below).

## Major features

- **Portfolio management**: create, edit, duplicate, archive, and delete
  one or more Bitcoin-collateralized leverage positions.
- **Dashboard**: Health Factor, Loan-to-Value, liquidation price/distance/
  buffer, net worth, and risk warnings, recalculated instantly from your
  own entered values.
- **Simulation Workspace**: model a hypothetical price, collateral, debt,
  or interest-rate change without touching your real tracked position;
  save, compare, and export scenarios.
- **Loop Builder**: model a leverage loop (repeated borrow-and-add-
  collateral cycles), with automatic stop conditions (minimum Health
  Factor, protocol borrowing limits) and cost/break-even analysis.
- **Exit Planner**: model a full or partial position exit, including
  price-sensitivity analysis.
- **Recommendation Center**: rule-based, explained suggestions (Borrow,
  Repay, Add Collateral, Loop) generated from your current position
  against a target you set.
- **Local-first persistence**: everything is stored in your browser's own
  `localStorage`; nothing is sent anywhere by default.
- **Full backup/restore**: export everything as a single JSON file;
  import with 4 merge modes (Add as new, Merge non-conflicting, Replace
  selected, Replace all local data); automatic Recovery Snapshots before
  a destructive import.
- **Optional, dormant Authentication**: sign in (Supabase) is available
  if a deployer configures it, but never required and never changes how
  portfolio data is stored.
- **Optional, dormant error monitoring**: Sentry integration exists but
  reports nothing unless a deployer sets `NEXT_PUBLIC_SENTRY_DSN`.

## Known limitations

See `docs/DEFECT_CLASSIFICATION.md` §6 and `docs/CHANGELOG.md`'s "Known
limitations" section for the complete, classified list. Summarized:

- Manual Mode only — no live BTC price feed, no live Aave connection.
  This is Version 1.0.0's permanent, intentional scope, not a gap.
- No cloud backup or cloud sync — Cloud Database and Cloud Synchronization
  were **cancelled by product decision** in Milestone 8
  (`docs/MILESTONE_8_SCOPE_CHANGE.md`) and remain cancelled.
- No wallet connection, no transaction execution — this is a decision-
  support tool, not a trading system.
- Automated cross-browser test coverage is Chromium-only; Firefox/Safari
  are covered by code-level review (`docs/CROSS_BROWSER_REVIEW.md`), not
  automated tests.
- CI does not yet run the end-to-end (Playwright) test suite
  automatically — it is run manually before every release (`docs/DEFECT_CLASSIFICATION.md`
  §6, classified non-blocking).
- No public production deployment exists for Version 1.0.0 (see
  "Deployment" below).

## Supported browsers

Current Chrome, current Edge (both Chromium-based; automated coverage
runs against Chromium directly). Current Firefox and current Safari are
supported per code-level review (no browser-specific APIs found; no
vendor-prefixed CSS) but not automated in this development environment —
see `docs/CROSS_BROWSER_REVIEW.md` for the full reasoning.

## Supported devices / viewports

Desktop (primary, 1280px+ tested), tablet (768px, sidebar breakpoint
tested), and mobile (375px tested, essential features) — see
`docs/QUALITY_PLAN.md` §4 and `tests/e2e/responsiveLayout.spec.ts`.

## Storage options

- **Local storage (default, always available)**: the only persistence
  mode Version 1.0.0 actually ships. No account required. Versioned
  (`STORAGE_SCHEMA_VERSION`) and migration-capable — see
  `docs/VERSIONING_STRATEGY.md`.
- **Cloud storage/synchronization**: not available in any form — cancelled
  by product decision, not deferred.

## Authentication options

Optional and dormant. If a deployer configures
`NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`, Sign In/Sign
Up/Password Reset become available (session/identity only — no
service-role key anywhere in this codebase). In this project's own
default configuration, neither is set, and Sign In reports "Cloud
accounts are not available in this environment" — the expected state,
not an error. Signing in never changes how portfolio data is stored.

## Import/export capabilities

Full backup export (JSON, all record types), single-record export,
per-tool CSV export (Portfolio Positions, Scenario Comparisons, Loop
Steps, Exit Plan Breakdowns), and import with 4 merge modes and automatic
Recovery Snapshots before a destructive replace — see
`docs/USER_GUIDE.md`'s "Your data" section for the full user-facing
walkthrough.

## Breaking changes

None — Version 1.0.0 is this project's first release. `STORAGE_SCHEMA_VERSION`
(`1.0.0`) is the only schema version that has ever existed; there is
nothing for it to break compatibility with.

## Upgrade instructions

There is no prior installed version to upgrade from — Version 1.0.0 is
the first release. For a future release: pull the new build, run
`pnpm install --frozen-lockfile`, and start the application normally; any
required local-data migration runs automatically on first load
(`providers/PersistenceProvider.tsx`'s own `runLocalDataMigration` call).
Export a backup first regardless (`/settings` → **Export** → **Full
Backup**) — the same standing recommendation `docs/USER_GUIDE.md` and
`docs/DISASTER_RECOVERY.md` already make for any local-data operation.

## Deployment

**No publicly operated production deployment exists for Version 1.0.0.**
This is a deliberate release decision, not an oversight or a missing
step: ProfitPilot is a self-hostable application with no single owned
production domain by design (see `CONTRIBUTING.md`'s "Deployment"
section). Running it requires cloning the repository and building it
yourself (`pnpm install && pnpm build && pnpm start`, or an equivalent
Next.js-compatible host) — see `docs/PRODUCTION_READINESS.md` for the
repository-level readiness audit and the specific infrastructure a
deployer would need to provide (hosting, and optionally Supabase/Sentry
projects) that this release does not include.
