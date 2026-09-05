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
| Application version           | `1.9.0`        | `package.json` `"version"`                                    |
| Engine version                 | `1.9.0`        | `ENGINE_VERSION` (`engine/shared/result.ts`)                   |
| Formula version                | `1.0`          | `FORMULA_VERSION`, identical across every `engine/**` calculation file — tracks `docs/02_Formulas.md`'s own document revision, not the application release. **Unchanged by V1.1 through V1.9** — no batch in any of the nine releases modified a financial formula. Dashboard Annualized Interest Cost Trend (V1.9.0) reads the already-persisted `entry.annualizedInterestCost` field directly, with no derived-helper layer and no recomputation of its own — the same already-established value `PortfolioHistoryPanel.tsx` already renders. |
| Storage schema version         | `1.0.0`        | `STORAGE_SCHEMA_VERSION` (`services/persistence/envelope.ts`). **Unchanged by V1.1 through V1.9** — every batch across all nine releases persists through the existing envelope/schema, adding no new schema version and no migration. Dashboard Annualized Interest Cost Trend (V1.9.0) reads already-persisted history entries and persists nothing new. |
| Database migration version     | N/A            | Cloud Database was cancelled by product decision (see "Persistence and local-first scope" in `CONTRIBUTING.md`) — there is no cloud database to version. The one migration-versioned system that exists is local storage, already covered by "Storage schema version" above; `REGISTERED_MIGRATIONS` (`services/persistence/migrations/migrate.ts`) is currently empty because schema `1.0.0` is the only version this application has ever shipped. |
| Documentation version          | Inconsistent — see below | Each specification document declares its own `Version` field, independent of the application version (`docs/06_TASKS.md` M10-003 finding, Milestone 10 Batch 1). `02_Formulas.md` through `06_TASKS.md` all declare `1.0`; `README.md` and `01_PRD.md`'s own header both still declare `0.1.0`, while `01_PRD.md`'s own footer declares `1.0` — an inconsistency within that single document, not just across documents. Recorded as `PROJECT_STATUS.md` Conflict #38, not silently corrected — these are frozen, protected specification documents this project's convention does not edit as part of ordinary work. |
| Sign-off completed (1.0.0)     | 2026-08-08     | Milestone 9 Batch 11 (M9-057–M9-064) — see `docs/DEFECT_CLASSIFICATION.md` §6 and `PROJECT_STATUS.md`'s Batch 11 write-up. Not a deployment date — see above. |
| Sign-off completed (1.1.0)     | 2026-08-31     | V1.1 Release Candidate audit (Batches 1–7) — see `docs/DEFECT_CLASSIFICATION.md`'s "V1.1 Release Candidate Review" section and the `[1.1.0]` entry below. Also not a deployment date. |
| Sign-off completed (1.2.0)     | 2026-09-04     | Aave V4 capability work plus its own semantic-correctness remediation cycle (A1/A2/A3) and independent closure audit, all re-verified against a fresh `origin/main` checkout (4092/4092 tests passing) — see `PROJECT_STATUS.md`'s "V1.2.0 Release Reconciliation" section and the `[1.2.0]` entry below. Not a fresh full Release Candidate process in the Milestone-9/V1.1 sense (no new manual exploratory pass) — a promotion of already-audited, already-closed work into a version boundary. Also not a deployment date. |
| Sign-off completed (1.3.0)     | 2026-09-04     | Portfolio Analytics / Trend Visibility (Batch 1), re-validated against a fresh `origin/main` checkout (4100/4100 tests passing) — see `PROJECT_STATUS.md`'s "v1.3.0 Release Reconciliation" section and the `[1.3.0]` entry below. Same promotion pattern as `1.2.0`'s own row above, not a fresh manual exploratory RC pass. Also not a deployment date. |
| Sign-off completed (1.4.0)     | 2026-09-04     | Annualized Interest Cost Visibility (Batch 1), re-validated against a fresh `origin/main` checkout (4108/4108 tests passing) — see `PROJECT_STATUS.md`'s "v1.4.0 Release Reconciliation" section and the `[1.4.0]` entry below. Same promotion pattern as `1.3.0`'s own row above, not a fresh manual exploratory RC pass. Also not a deployment date. |
| Sign-off completed (1.5.0)     | 2026-09-04     | Portfolio Analytics — Price & Liquidation Trend Visibility (Batch 1), re-validated against a fresh `origin/main` checkout (4119/4119 tests passing) — see `PROJECT_STATUS.md`'s "v1.5.0 Release Reconciliation" section and the `[1.5.0]` entry below. Same promotion pattern as `1.4.0`'s own row above, not a fresh manual exploratory RC pass. Also not a deployment date. |
| Sign-off completed (1.6.0)     | 2026-09-04     | Liquidation Buffer Visibility (Batch 1), re-validated against a fresh `origin/main` checkout (4145/4145 tests passing) — see `PROJECT_STATUS.md`'s "v1.6.0 Release Reconciliation" section and the `[1.6.0]` entry below. Same promotion pattern as `1.5.0`'s own row above, not a fresh manual exploratory RC pass. Also not a deployment date. |
| Sign-off completed (1.7.0)     | 2026-09-04     | Dashboard Health Factor Trend Visibility (Batch 1), re-validated against a fresh `origin/main` checkout (4155/4155 tests passing) — see `PROJECT_STATUS.md`'s "v1.7.0 Release Reconciliation" section and the `[1.7.0]` entry below. Same promotion pattern as `1.6.0`'s own row above, not a fresh manual exploratory RC pass. Also not a deployment date. |
| Sign-off completed (1.8.0)     | 2026-09-04     | Dashboard Liquidation Buffer Trend Visibility (Batch 1), re-validated against a fresh `origin/main` checkout (4169/4169 tests passing) — see `PROJECT_STATUS.md`'s "v1.8.0 Release Reconciliation" section and the `[1.8.0]` entry below. Same promotion pattern as `1.7.0`'s own row above, not a fresh manual exploratory RC pass. Also not a deployment date. |
| Sign-off completed (1.9.0)     | 2026-09-05     | Dashboard Annualized Interest Cost Trend (Batch 1), re-validated against a fresh `origin/main` checkout (4180/4180 tests passing) — see `PROJECT_STATUS.md`'s "v1.9.0 Release Reconciliation" section and the `[1.9.0]` entry below. Same promotion pattern as `1.8.0`'s own row above, not a fresh manual exploratory RC pass. Also not a deployment date. |

**Why the Application/Engine version is `1.9.0`, not `1.8.x` or a new
`2.0.0`**: not a PATCH — the Dashboard gains a compact Annualized
Interest Cost trend visualization, completing the trend-chart set
started by `1.7.0`'s Health Factor trend and `1.8.0`'s Liquidation
Buffer trend — new user-facing capability, not a bug fix to existing
capability, the same bar that already justified `1.1.0` through `1.8.0`
being MINOR rather than PATCH bumps. Not a new MAJOR either, on the
identical reasoning the `1.8.0` through `1.1.0` paragraphs below already
give: no change to the Engine's calculation surface, the persisted-data
shape, or the Manual-Mode-by-default product boundary `01_PRD.md`
reserves Version 2 for. Every plotted value is read directly, on read,
from one already-persisted history entry's own `annualizedInterestCost`
field — with no derived-helper layer in between (unlike `1.8.0`'s own
`calculateLiquidationBufferPercent`), and never recomputed from today's
portfolio or market state. The point-in-time-projection framing
`PortfolioHistoryPanel.tsx` already established is preserved exactly:
never interest already paid, cumulative interest, realized borrowing
cost, or interest paid since inception. No Health Factor risk-band
classification is introduced either (Conflict #1 remains exactly as
unresolved as before). A minor version bump, same class as `1.1.0`'s
through `1.8.0`'s own.

**Why the Application/Engine version is `1.8.0`, not `1.7.x` or a new
`2.0.0`**: not a PATCH — the Dashboard gains a compact Liquidation
Buffer trend visualization, directly pairing the Health Factor trend
`1.7.0` shipped — new user-facing capability, not a bug fix to existing
capability, the same bar that already justified `1.1.0` through `1.7.0`
being MINOR rather than PATCH bumps. Not a new MAJOR either, on the
identical reasoning the `1.7.0`, `1.6.0`, `1.5.0`, `1.4.0`, `1.3.0`,
`1.2.0`, and `1.1.0` paragraphs below already give: no change to the
Engine's calculation surface, the persisted-data shape, or the
Manual-Mode-by-default product boundary `01_PRD.md` reserves Version 2
for. Every plotted value is derived, on read, from one already-persisted
history entry's own `marketPriceUsd`/`liquidationPriceUsd` via the
v1.6.0 `calculateLiquidationBufferPercent` helper reused verbatim —
never the Engine's separate, live-computed F-025 `calculateLiquidationBuffer`
(which continues to feed `LiquidationRiskPanel`'s own current-value
card unchanged), and never recomputed from today's portfolio or market
state. No Health Factor risk-band classification is introduced either
(Conflict #1 remains exactly as unresolved as before). A minor version
bump, same class as `1.1.0`'s through `1.7.0`'s own.

**Why the Application/Engine version is `1.7.0`, not `1.6.x` or a new
`2.0.0`**: not a PATCH — the Dashboard gains a compact Health Factor
trend visualization, reading already-persisted Portfolio History
`healthFactor` values through the same `listPortfolioHistoryForPortfolio`
service call `PortfolioHistoryPanel.tsx` already uses — new user-facing
capability, not a bug fix to existing capability, the same bar that
already justified `1.1.0` through `1.6.0` being MINOR rather than PATCH
bumps. Not a new MAJOR either, on the identical reasoning the `1.6.0`,
`1.5.0`, `1.4.0`, `1.3.0`, `1.2.0`, and `1.1.0` paragraphs below already
give: no change to the Engine's calculation surface, the persisted-data
shape, or the Manual-Mode-by-default product boundary `01_PRD.md`
reserves Version 2 for. Every plotted value is read directly from an
already-persisted history entry, never recomputed from today's
portfolio state or a new formula, and no Health Factor risk-band
classification is introduced (Conflict #1 remains exactly as unresolved
as before). A minor version bump, same class as `1.1.0`'s, `1.2.0`'s,
`1.3.0`'s, `1.4.0`'s, `1.5.0`'s, and `1.6.0`'s own.

**Why the Application/Engine version is `1.6.0`, not `1.5.x` or a new
`2.0.0`**: not a PATCH — Portfolio History's trend chart, desktop table,
and mobile card list gain a new "Liquidation Buffer" metric (the
percentage distance between a snapshot's own market price and estimated
liquidation price) — new user-facing capability, not a bug fix to
existing capability, the same bar that already justified `1.1.0`
through `1.5.0` being MINOR rather than PATCH bumps. Not a new MAJOR
either, on the identical reasoning the `1.5.0`, `1.4.0`, `1.3.0`,
`1.2.0`, and `1.1.0` paragraphs below already give: no change to the
Engine's calculation surface, the persisted-data shape, or the
Manual-Mode-by-default product boundary `01_PRD.md` reserves Version 2
for. Unlike every metric before it, Liquidation Buffer is not a directly
persisted field made visible — it is DISPLAY/SERVICE-LAYER DERIVED
analytics, `(marketPriceUsd − liquidationPriceUsd) / marketPriceUsd`,
computed from the two already-persisted fields `1.5.0` exposed. This
does not change its version classification: no Engine formula, no
Formula ID, no persisted field, and no protocol-specific branching were
introduced, so the same MINOR-bump reasoning applies. A minor version
bump, same class as `1.1.0`'s, `1.2.0`'s, `1.3.0`'s, `1.4.0`'s, and
`1.5.0`'s own.

**Why the Application/Engine version is `1.5.0`, not `1.4.x` or a new
`2.0.0`**: not a PATCH — Portfolio History's `marketPriceUsd` and
`liquidationPriceUsd` fields, previously computed and persisted but
never surfaced anywhere in the UI, are now visible in the table, mobile
card list, delta display, and as two new chart metrics (bringing the
selector to seven) — new user-facing capability, not a bug fix to
existing capability, the same bar that already justified `1.1.0`
through `1.4.0` being MINOR rather than PATCH bumps. Not a new MAJOR
either, on the identical reasoning the `1.4.0`, `1.3.0`, `1.2.0`, and
`1.1.0` paragraphs below already give: no change to the Engine's
calculation surface, the persisted-data shape, or the
Manual-Mode-by-default product boundary `01_PRD.md` reserves Version 2
for — both fields are read directly from an already-persisted snapshot,
never recomputed, and the Liquidation Price delta reuses
`comparePortfolioHistoryEntries`'s own already-existing comparison
output, simply unrendered until now. A minor version bump, same class
as `1.1.0`'s, `1.2.0`'s, `1.3.0`'s, and `1.4.0`'s own.

**Why the Application/Engine version is `1.4.0`, not `1.3.x` or a new
`2.0.0`**: not a PATCH — Portfolio History's `annualizedInterestCost`
field, previously computed and persisted but never surfaced anywhere in
the UI, is now visible in the table, mobile card list, delta display,
and as a fifth chart metric — new user-facing capability, not a bug fix
to existing capability, the same bar that already justified `1.1.0`,
`1.2.0`, and `1.3.0` being MINOR rather than PATCH bumps. Not a new
MAJOR either, on the identical reasoning the `1.3.0`, `1.2.0`, and
`1.1.0` paragraphs below already give: no change to the Engine's
calculation surface, the persisted-data shape, or the
Manual-Mode-by-default product boundary `01_PRD.md` reserves Version 2
for — the field is read directly from an already-persisted snapshot,
never recomputed, and no comparison logic is new (the delta already
existed in `comparePortfolioHistoryEntries`, simply unrendered until
now). A minor version bump, same class as `1.1.0`'s, `1.2.0`'s, and
`1.3.0`'s own.

**Why the Application/Engine version is `1.3.0`, not `1.2.x` or a new
`2.0.0`**: not a PATCH — the Portfolio History chart's multi-metric
selector (Health Factor, Net Worth, Loan-to-Value, Leverage) is new
user-facing capability, not a bug fix to existing capability, the same
bar that already justified `1.1.0` and `1.2.0` being MINOR rather than
PATCH bumps. Not a new MAJOR either, on the identical reasoning the
`1.2.0` and `1.1.0` paragraphs below already give: no change to the
Engine's calculation surface, the persisted-data shape, or the
Manual-Mode-by-default product boundary `01_PRD.md` reserves Version 2
for — every new chart metric reads an already-persisted field or applies
an already-specified formula (Net Worth), never a new one. A minor
version bump, same class as `1.1.0`'s and `1.2.0`'s own.

**Why the Application/Engine version is `1.2.0`, not `1.1.x` or a new
`2.0.0`**: not a PATCH — V4 portfolio creation and two new live-read V4
fields (base drawn APR, reserve price) are new user-facing capability,
not bug fixes to existing capability, the same bar that already
justified 1.1.0 being MINOR rather than PATCH over 1.0.0. Not a new
MAJOR either, on the identical reasoning the `1.1.0` paragraph below
already gives: no change to the Engine's calculation surface, the
persisted-data shape, or the Manual-Mode-by-default product boundary
`01_PRD.md` reserves Version 2 for. A minor version bump, same class as
`1.1.0`'s own.

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

- **No wallet connection or real position import — a decision-support
  tool, not a live account.** BTC price and Aave V3 protocol parameters
  (max LTV, liquidation threshold, borrow/supply APR) are fetched live
  and read-only by default; Aave V4, once opted into for a portfolio,
  adds a live read of that position's debt state, collateral risk
  factor, and base drawn interest rate the same way. "Manual Mode" means
  no backend service is required to run (`01_PRD.md` REQ-010), not an
  absence of live data — a distinction this list previously did not draw
  clearly (corrected in v1.6.0's release reconciliation; see
  `docs/KNOWN_ISSUES.md` category A and `docs/USER_GUIDE.md` for the
  full live-vs-manual breakdown). What remains genuinely manual, for
  both protocol versions: collateral quantity and debt balance (position
  size), which only you can enter — ProfitPilot never infers or fetches
  it. Reading your real Aave position/wallet balance directly is
  Version 2 scope.
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
- **CI runs a blocking production smoke gate on every PR/push, and the
  full end-to-end (Playwright) test suite runs as a separate, manual
  release gate — not automatically on every push.** `.github/workflows/ci.yml`
  runs a small, blocking production smoke suite
  (`tests/e2e/productionSmoke.spec.ts`) against a real `pnpm build && pnpm
  start` server on every PR/push; the broader 151-test suite (including
  all 43 accessibility tests) is wired into a separate, manual
  `workflow_dispatch` workflow (`.github/workflows/e2e-full.yml`), run
  before every release. Corrected in v1.8.0's release reconciliation — an
  earlier version of this list stated CI ran no automated E2E coverage at
  all, which understated the smoke gate that already existed by that
  point (Post-M10 hardening, R1-3/R2-4). See "Post-M10 hardening
  (R1/R2)" below and `docs/KNOWN_ISSUES.md` category C for the full
  record.
- **No live deployment exists.** Self-hostable, no owned production
  domain by design — see "What 'released' means here" above.
- **1 `pnpm audit --prod` finding remains (`sharp`, confirmed unused,
  tracked)**, down from the original full-tree count. See "Post-M10
  hardening (R1/R2)" below.

## [1.9.0] — 2026-09-05

One batch on top of Version 1.8.0: Dashboard Annualized Interest Cost
Trend. The Post-v1.8.0 Planning Audit recommended completing the
Dashboard's trend-chart set with the one already-persisted field
Portfolio History had charted since v1.4.0 but the Dashboard still
lacked — Annualized Interest Cost now joins Health Factor and
Liquidation Buffer as a Dashboard trend chart, reusing already-persisted
Portfolio History data with zero new persistence. Full per-file detail
lives in `PROJECT_STATUS.md`'s "v1.9.0 Release Reconciliation" section;
this entry summarizes what changed for a user.

### What's new in 1.9.0

- **The Dashboard now shows an Interest Cost (annualized) Trend chart**,
  directly below the existing Debt and Interest panel — a compact,
  accessible line chart reading the same already-persisted Portfolio
  History `annualizedInterestCost` values `PortfolioHistoryPanel.tsx`
  (`app/portfolio/`) already charts, through the identical
  `listPortfolioHistoryForPortfolio` service call. No new persistence
  path, no new Store.
- **Reads the persisted field directly** — no derived-helper layer in
  between, unlike Liquidation Buffer's own service-layer percentage
  calculation. This is already the exact number Portfolio History's own
  table and card view render.
- **A point-in-time projection, never a running total.** Each plotted
  point is the projected annual borrowing cost implied by that one
  snapshot's own debt balance and rate — never interest already paid,
  cumulative interest, realized borrowing cost, or interest paid since
  inception. The chart's own text and accessible summary state this
  explicitly.
- **Always a plain number — no "no risk" branch, no protocol-version
  branching.** Unlike Health Factor and Liquidation Buffer,
  `annualizedInterestCost` is a required field for every entry
  regardless of protocol version, so this chart has no null case to
  special-case and never reads which Aave version a portfolio uses.
- **Explicit non-chart states for empty and single-entry history**,
  mirroring the two existing Dashboard trend charts' own established
  rule: zero entries reads "No Interest Cost (annualized) history yet."
  A single entry shows its own value as plain text rather than a
  fabricated one-point line — including a `$0.00` entry, shown as-is,
  never blank or `NaN`.
- **Accessible by design.** `role="img"` plus a full text `aria-label`
  summarizing every plotted point, `ResponsiveContainer`, and
  `isAnimationActive={false}` for deterministic rendering — the same
  accessible-chart pattern the two existing Dashboard trend charts
  already established.

### What this is not

This release adds no Health Factor risk-band classification, no Supply
APR trend, no collateral/debt quantity or debt-asset history, no
portfolio profit/loss, total return, gain since inception, cost basis,
or cumulative/realized interest accounting. It introduces no new
interest-cost *calculation* of its own — the value plotted is exactly
the same already-persisted figure Portfolio History already computes and
displays; the Dashboard simply gained its own historical view of it,
completing the set alongside Health Factor and Liquidation Buffer.

### Explicitly unchanged in 1.9.0

No financial formula (`FORMULA_VERSION` stays `1.0`), no Formula ID, no
persisted-data schema (`STORAGE_SCHEMA_VERSION` stays `1.0.0`), no
migration, no Engine file, no new protocol API call, no V3/V4 semantic
change (the chart never branches on protocol version), and no change to
the Path B (self-hostable, no operated production deployment)
deployment disposition — see `docs/DEPLOYMENT_DISPOSITION.md`. Supply
APR trend, collateral/debt quantity history, debt-asset history, Health
Factor risk bands, cumulative/realized interest, P&L, cost basis, total
return, Dependabot/Renovate, production deployment, and Settings ABOUT
work all remain deferred, unchanged from prior releases.

### Release status

This entry promotes one batch already independently verified by its own
audit-implement-test-validate cycle (full suite: 4180/4180 tests
passing, both in the implementation worktree and independently after
applying the delivered patch to a clean checkout) — not a fresh
Milestone-9/V1.1-style Release Candidate process with its own new manual
exploratory pass, the same promotion pattern `1.8.0`'s own entry below
already used. See `PROJECT_STATUS.md`'s "v1.9.0 Release Reconciliation"
section for the full record.

## [1.8.0] — 2026-09-04

One batch on top of Version 1.7.0: Dashboard Liquidation Buffer Trend
Visibility. The Post-v1.7 Decision-Point Audit recommended completing
the Dashboard's risk-trend pairing v1.7.0 started — Health Factor now
has a companion Liquidation Buffer trend, both reusing already-persisted
Portfolio History data with zero new persistence. Full per-file detail
lives in `PROJECT_STATUS.md`'s "v1.8.0 Release Reconciliation" section;
this entry summarizes what changed for a user.

### What's new in 1.8.0

- **The Dashboard now shows a Liquidation Buffer Trend chart**, directly
  below the existing Liquidation Risk panel — a compact, accessible line
  chart reading the same already-persisted Portfolio History
  `marketPriceUsd`/`liquidationPriceUsd` values `PortfolioHistoryPanel.tsx`
  (`app/portfolio/`) already charts as its own "Liquidation Buffer"
  metric, through the identical `listPortfolioHistoryForPortfolio`
  service call. No new persistence path, no new Store.
- **Reuses the v1.6.0 `calculateLiquidationBufferPercent` helper
  verbatim** — the exact DISPLAY/SERVICE-LAYER DERIVED calculation
  (`(marketPriceUsd − liquidationPriceUsd) / marketPriceUsd`) already
  established, applied to one history entry's own two fields. This is
  deliberately **not** the Engine's separate, live-computed F-025
  `calculateLiquidationBuffer` (`engine/liquidation/`), which continues
  unchanged as the value `LiquidationRiskPanel`'s own current-value card
  shows — the two remain intentionally distinct implementations, never
  substituted or conflated.
- **Presentation/read-layer only.** Every plotted value comes directly
  from an already-persisted history entry — never recomputed from
  today's portfolio state, today's market data, or a new formula.
- **No Health Factor risk-band classification, no color thresholds.**
  Conflict #1 remains exactly as unresolved as before this release.
- **Explicit non-chart states for empty and single-entry history**,
  mirroring `HealthFactorTrendSection.tsx`'s own established rule: zero
  entries reads "No Liquidation Buffer history yet." A single entry
  shows its own value as plain text rather than a fabricated one-point
  line. 2+ entries render an accessible, chronologically ordered chart.
- **`null` (zero-debt, or an unavailable market-price denominator per
  the existing helper's own contract) renders "No liquidation risk,"
  never a fabricated `0%`, `NaN`, or `Infinity`.** Positive, zero, and
  negative buffers are all shown without clamping.
- **Accessible by design.** `role="img"` plus a full text `aria-label`
  summarizing every plotted point, `ResponsiveContainer`, and
  `isAnimationActive={false}` for deterministic rendering — the same
  accessible-chart pattern `HealthFactorTrendSection.tsx` already
  established.

### What this is not

This release adds no Health Factor risk-band classification, no Supply
APR trend, no collateral/debt quantity or debt-asset history, no
portfolio profit/loss, total return, gain since inception, cost basis,
or cumulative/realized interest accounting. It introduces no new
liquidation-buffer *calculation* of its own — the value plotted is
exactly the same derived figure Portfolio History already computes and
displays; the Dashboard simply gained its own historical view of it,
alongside Health Factor.

### Explicitly unchanged in 1.8.0

No financial formula (`FORMULA_VERSION` stays `1.0`), no Formula ID, no
persisted-data schema (`STORAGE_SCHEMA_VERSION` stays `1.0.0`), no
migration, no Engine file, no new protocol API call, no V3/V4 semantic
change (the chart never branches on protocol version), and no change to
the Path B (self-hostable, no operated production deployment)
deployment disposition — see `docs/DEPLOYMENT_DISPOSITION.md`. Supply
APR trend, collateral/debt quantity history, debt-asset history, Health
Factor risk bands, cumulative/realized interest, P&L, cost basis, total
return, Dependabot/Renovate, production deployment, and Settings ABOUT
work all remain deferred, unchanged from prior releases.

### Release status

This entry promotes one batch already independently verified by its own
audit-implement-test-validate cycle (full suite: 4169/4169 tests
passing, both in the implementation worktree and independently after
applying the delivered patch to a clean checkout) — not a fresh
Milestone-9/V1.1-style Release Candidate process with its own new manual
exploratory pass, the same promotion pattern `1.7.0`'s own entry below
already used. See `PROJECT_STATUS.md`'s "v1.8.0 Release Reconciliation"
section for the full record.

## [1.7.0] — 2026-09-04

One batch on top of Version 1.6.0: Dashboard Health Factor Trend
Visibility. The Post-v1.6 Decision-Point Audit found that Portfolio
History's own "already-computed, never-rendered field" pattern was
genuinely exhausted (every field `comparePortfolioHistoryEntries.ts`
compares a delta for is already rendered), but that the Dashboard — a
different surface entirely — had never had any historical trend
visualization at all, despite Portfolio History's own already-persisted
data being readily available to it. Full per-file detail lives in
`PROJECT_STATUS.md`'s "v1.7.0 Release Reconciliation" section; this
entry summarizes what changed for a user.

### What's new in 1.7.0

- **The Dashboard now shows a Health Factor Trend chart**, directly
  below the existing Health Factor Status section — a compact,
  accessible line chart reading the same already-persisted Portfolio
  History `healthFactor` values `PortfolioHistoryPanel.tsx`
  (`app/portfolio/`) already charts, through the identical
  `listPortfolioHistoryForPortfolio` service call. No new persistence
  path, no new Store.
- **Presentation/read-layer only.** Every plotted value comes directly
  from an already-persisted history entry — never recomputed from
  today's portfolio state, today's market data, or a new formula.
- **No Health Factor risk-band classification, no color thresholds.**
  Conflict #1 (four mutually disagreeing Health Factor band-threshold
  schemes across `01_PRD.md` and `02_Formulas.md`) remains exactly as
  unresolved as before this release — this chart shows the raw number
  and its trend only.
- **Explicit non-chart states for empty and single-entry history.** Zero
  entries reads "No Health Factor history yet." A single entry shows its
  own value as plain text rather than a fabricated one-point line — the
  same "no chart below two entries" rule `PortfolioHistoryPanel.tsx`'s
  own chart already follows. 2+ entries render an accessible chart,
  chronologically ordered oldest-first.
- **Null (zero-debt) Health Factor renders "∞," never a fabricated
  value or `NaN`** — the same established convention this figure
  already uses everywhere else in the application.
- **Accessible by design.** `role="img"` plus a full text `aria-label`
  summarizing every plotted point, `ResponsiveContainer`, and
  `isAnimationActive={false}` for deterministic rendering — the same
  accessible-chart pattern `PortfolioHistoryPanel.tsx`'s own chart
  already established.

### What this is not

This release adds no Health Factor risk-band classification, no Supply
APR trend, no Liquidation Buffer trend on the Dashboard, no collateral/
debt quantity or debt-asset history, no portfolio profit/loss, total
return, gain since inception, cost basis, or cumulative/realized
interest accounting. It introduces no new Health Factor *calculation* —
the values plotted are exactly the figures already computed and
persisted by Portfolio History; the Dashboard simply gained its own
view of that same data.

### Explicitly unchanged in 1.7.0

No financial formula (`FORMULA_VERSION` stays `1.0`), no Formula ID, no
persisted-data schema (`STORAGE_SCHEMA_VERSION` stays `1.0.0`), no
migration, no Engine file, no new protocol API call, no V3/V4 semantic
change (the chart never branches on protocol version), and no change to
the Path B (self-hostable, no operated production deployment)
deployment disposition — see `docs/DEPLOYMENT_DISPOSITION.md`. Supply
APR trend, collateral/debt quantity history, debt-asset history, Health
Factor risk bands, cumulative/realized interest, P&L, cost basis, total
return, Dependabot/Renovate, and production deployment all remain
deferred, unchanged from prior releases.

### Release status

This entry promotes one batch already independently verified by its own
audit-implement-test-validate cycle (full suite: 4155/4155 tests
passing, both in the implementation worktree and independently after
applying the delivered patch to a clean checkout) — not a fresh
Milestone-9/V1.1-style Release Candidate process with its own new manual
exploratory pass, the same promotion pattern `1.6.0`'s own entry below
already used. See `PROJECT_STATUS.md`'s "v1.7.0 Release Reconciliation"
section for the full record.

## [1.6.0] — 2026-09-04

One batch on top of Version 1.5.0: Liquidation Buffer Visibility. The
Post-v1.5 Decision-Point Audit found that the "already-computed,
never-rendered field" pattern behind `1.4.0` and `1.5.0` was now fully
exhausted — every field `comparePortfolioHistoryEntries.ts` compares a
delta for was already visible — and instead identified one small,
genuinely new, display-only derived metric obtainable from the two
fields `1.5.0` just exposed. Full per-file detail lives in
`PROJECT_STATUS.md`'s "v1.6.0 Release Reconciliation" section; this
entry summarizes what changed for a user.

### What's new in 1.6.0

- **Portfolio History now shows a Liquidation Buffer.** An eighth
  metric, added to the desktop table (after Liquidation Price), the
  mobile card list, the before/after delta display, and the trend chart
  selector. It is the percentage distance between a snapshot's own
  market price and its estimated liquidation price:
  `(marketPriceUsd − liquidationPriceUsd) / marketPriceUsd`.
- **This is DISPLAY/SERVICE-LAYER DERIVED analytics, not a new Engine
  formula.** Unlike every metric `1.3.0` through `1.5.0` added, this one
  is not a directly persisted field made visible — it is computed on
  read from the two already-persisted, already-rendered fields `1.5.0`
  exposed (`marketPriceUsd`, `liquidationPriceUsd`). No new Formula ID,
  no Engine involvement, no persisted field of its own.
- **A zero-debt (`null`) Liquidation Price continues to mean "no
  liquidation risk," now for the buffer too.** When `liquidationPriceUsd`
  is `null`, the buffer reads "No liquidation risk" — the same
  established wording, never a fabricated `0%` and never `Infinity`.
- **Positive, zero, and negative buffers are all shown without
  clamping.** A buffer at or below zero (market price at or below the
  liquidation price) is rendered as-is, since clamping it would hide how
  far past liquidation a historical snapshot already was.

### What this is not

Same discrete-observation boundary `[1.5.0]`'s, `[1.4.0]`'s, and
`[1.3.0]`'s own entries already state: this release adds no portfolio
profit/loss, total return, gain since inception, cost basis, or
cumulative/realized interest accounting, and no Health Factor risk-band
classification. It introduces no new liquidation-price *calculation* —
the underlying `marketPriceUsd`/`liquidationPriceUsd` values feeding the
buffer are exactly the same figures the Engine already computes and this
application already persists and displays elsewhere; only the
percentage-distance arithmetic between them is new, and it lives in the
UI/service layer, not the Engine.

### Explicitly unchanged in 1.6.0

No financial formula (`FORMULA_VERSION` stays `1.0`), no Formula ID, no
persisted-data schema (`STORAGE_SCHEMA_VERSION` stays `1.0.0`), no
migration, no Engine file, no new protocol API call, no V3/V4 semantic
change (the buffer calculation never branches on protocol version), and
no change to the Path B (self-hostable, no operated production
deployment) deployment disposition — see `docs/DEPLOYMENT_DISPOSITION.md`.
Supply APR trend, collateral/debt quantity history, debt-asset history,
Health Factor risk bands, cumulative/realized interest, P&L, cost basis,
total return, Dependabot/Renovate, and production deployment all remain
deferred, unchanged from prior releases.

### Release status

This entry promotes one batch already independently verified by its own
audit-implement-test-validate cycle (full suite: 4145/4145 tests
passing, both in the implementation worktree and independently after
applying the delivered patch to a clean checkout) — not a fresh
Milestone-9/V1.1-style Release Candidate process with its own new manual
exploratory pass, the same promotion pattern `1.5.0`'s own entry above
already used. See `PROJECT_STATUS.md`'s "v1.6.0 Release Reconciliation"
section for the full record.

## [1.5.0] — 2026-09-04

One batch on top of Version 1.4.0: Portfolio Analytics — Price &
Liquidation Trend Visibility, following the same pattern the Post-v1.4
Decision-Point Audit found for two more already-persisted, never-
rendered fields (`marketPriceUsd`, `liquidationPriceUsd`) — the same
class of gap `annualizedInterestCost` closed in `1.4.0`. Full per-file
detail lives in `PROJECT_STATUS.md`'s "v1.5.0 Release Reconciliation"
section; this entry summarizes what changed for a user.

### What's new in 1.5.0

- **Portfolio History now shows Market Price and Liquidation Price.**
  Two new columns appear in the desktop history table (after Interest
  Cost (annualized)) and the mobile history card list, currency-
  formatted, reading `entry.marketPriceUsd`/`entry.liquidationPriceUsd`
  directly — both computed and persisted since V1.1 Batch 2, simply
  never surfaced until now.
- **Before/after comparison now shows both fields' own deltas**,
  reusing `comparePortfolioHistoryEntries`'s already-existing
  (previously unrendered) `marketPriceUsd`/`liquidationPriceUsd`
  deltas — the same "before → after (delta)" convention every other
  column already uses.
- **The trend chart gains two more metrics**, bringing the selector to
  seven: Market Price and Liquidation Price, alongside the five metrics
  V1.3.0/V1.4.0 already shipped.
- **Liquidation Price's zero-debt case reads "No liquidation risk,"
  never "∞" or a fabricated price.** A `null` persisted liquidation
  price means the position currently has no liquidation risk — this
  release states that directly, reusing the exact wording this same
  field already uses elsewhere in the application (Apply-to-Portfolio
  review, Recommendation detail), rather than the Health-Factor-specific
  "∞" convention or any invented numeric substitute.

### What this is not

Same discrete-observation boundary `[1.4.0]`'s and `[1.3.0]`'s own
entries already state, restated because this release touches two more
of the same historical fields directly: this release adds no portfolio
profit/loss, total return, gain since inception, cost basis, or
cumulative/realized interest accounting. It introduces no new
liquidation-price *calculation* — Liquidation Price here is exactly the
figure the Engine already computes and this application already
persists and displays elsewhere (Dashboard, Apply-to-Portfolio,
Recommendations); Portfolio History simply gained its own historical
view of that same number.

### Explicitly unchanged in 1.5.0

No financial formula (`FORMULA_VERSION` stays `1.0`), no persisted-data
schema (`STORAGE_SCHEMA_VERSION` stays `1.0.0`), no migration, no
Engine file, no new protocol API call, no V3/V4 semantic change (both
fields are computed identically for both protocol versions, exactly as
every other Portfolio History column already is), and no change to the
Path B (self-hostable, no operated production deployment) deployment
disposition — see `docs/DEPLOYMENT_DISPOSITION.md`.

### Release status

This entry promotes one batch already independently verified by its own
audit-implement-test-validate cycle (full suite: 4119/4119 tests
passing, both in the implementation worktree and independently after
applying the delivered patch to a clean checkout) — not a fresh
Milestone-9/V1.1-style Release Candidate process with its own new manual
exploratory pass, the same promotion pattern `1.4.0`'s own entry below
already used. See `PROJECT_STATUS.md`'s "v1.5.0 Release Reconciliation"
section for the full record.

## [1.4.0] — 2026-09-04

One batch on top of Version 1.3.0: Annualized Interest Cost Visibility,
a direct follow-up to the Post-v1.3 Roadmap Audit's own finding that
`annualizedInterestCost` was already persisted and computed but never
rendered anywhere in the application. Full per-file detail lives in
`PROJECT_STATUS.md`'s "v1.4.0 Release Reconciliation" section; this
entry summarizes what changed for a user.

### What's new in 1.4.0

- **Portfolio History now shows Annualized Interest Cost.** A new
  "Interest Cost (annualized)" column appears in the desktop history
  table (last column) and the mobile history card list, currency-
  formatted, reading `entry.annualizedInterestCost` directly — the same
  field the Engine has computed and persisted since V1.1 Batch 2, simply
  never surfaced until now.
- **Before/after comparison now shows this field's own delta**, reusing
  `comparePortfolioHistoryEntries`'s already-existing
  `annualizedInterestCost` comparison (previously computed but unused by
  the UI) and the same "before → after (delta)" convention every other
  column already uses.
- **The Portfolio History chart gains a fifth metric.** The existing
  selector (Health Factor, Net Worth, Loan-to-Value, Leverage) now also
  offers Interest Cost (annualized), currency-formatted, using the exact
  `PORTFOLIO_HISTORY_METRICS` pattern the four V1.3.0 metrics already
  established.
- **Explicit semantic disambiguation.** Both the table header and card
  label carry a concise `title` tooltip stating this figure is a
  point-in-time projection — the annualized borrowing cost implied by
  that one snapshot's own debt balance and rate — never interest already
  paid, cumulative interest, realized borrowing cost, or interest paid
  since inception.

### What this is not

Identical boundary to `[1.3.0]`'s own "What this is not" above, restated
because this release touches the same field's own visibility directly:
`annualizedInterestCost` is not, and must never be read as, interest
already paid, cumulative interest, realized borrowing cost, or interest
paid since inception — it is one snapshot's own projected annual figure,
nothing more. This release adds no portfolio profit/loss, total return,
gain since inception, cost basis, or historical investment-performance
percentage; ProfitPilot still has no mechanism to capture an acquisition
price, so none of the above is computable without new specification work
this release does not do.

### Explicitly unchanged in 1.4.0

No financial formula (`FORMULA_VERSION` stays `1.0`), no persisted-data
schema (`STORAGE_SCHEMA_VERSION` stays `1.0.0`), no Engine file, no new
protocol API call, no V3/V4 semantic change (the field is computed
identically for both protocol versions, exactly as every other Portfolio
History column already is), and no change to the Path B (self-hostable,
no operated production deployment) deployment disposition — see
`docs/DEPLOYMENT_DISPOSITION.md`.

### Release status

This entry promotes one batch already independently verified by its own
audit-implement-test-validate cycle (full suite: 4108/4108 tests
passing, both in the implementation worktree and independently after
applying the delivered patch to a clean checkout) — not a fresh
Milestone-9/V1.1-style Release Candidate process with its own new manual
exploratory pass, the same promotion pattern `1.3.0`'s own entry below
already used. See `PROJECT_STATUS.md`'s "v1.4.0 Release Reconciliation"
section for the full record.

## [1.3.0] — 2026-09-04

One batch on top of Version 1.2.0: Portfolio Analytics / Trend
Visibility, the Post-v1.2 Roadmap Audit's recommended next milestone.
Full per-file detail lives in `PROJECT_STATUS.md`'s "v1.3.0 Release
Reconciliation" section; this entry summarizes what changed for a user.

### What's new in 1.3.0

- **The Portfolio History chart can now plot four metrics, not just
  Health Factor.** A compact selector switches the existing trend chart
  between Health Factor (unchanged default), Net Worth, Loan-to-Value,
  and Leverage, rather than permanently stacking four charts. The
  table and mobile card list, and every value in them, are unchanged.
- **Net Worth is computed exactly as `docs/02_Formulas.md`'s own
  "Net Worth = Portfolio Value − Debt" equation** — a stored snapshot's
  own `collateral.valueUsd` minus `debt.valueUsd`. Loan-to-Value and
  Leverage plot the already-persisted `loanToValue`/`leverage` fields
  directly. No new formula, and no field is recomputed differently than
  the table above the chart already shows it.
- **Accessibility preserved exactly as before**: the chart keeps its
  `role="img"` and a text `aria-label` summarizing every plotted point
  (naming the selected metric), so no information depends on the visual
  line alone; the metric selector is a standard, keyboard-operable
  `<select>` with an associated label.

### What this is not

Each Portfolio History entry remains a **discrete, irregular
observation** — a snapshot taken on creation, an explicit save, or a
material live-data change — never a continuous accounting record. This
release does not add, and does not claim: portfolio profit/loss, total
return, gain since inception, a cost basis for any position, cumulative
or realized interest paid, or any historical investment-performance
percentage. ProfitPilot has no mechanism to capture when or at what
price a position's collateral was acquired, so none of the above can be
computed without new specification work this release does not do —
flagged, not built. `annualizedInterestCost` (an already-persisted,
point-in-time projected figure, distinct from any of the above) was
evaluated as a candidate fifth chart metric and deliberately deferred,
not added — see `PROJECT_STATUS.md`'s "v1.3.0 Release Reconciliation"
section for the full reasoning.

### Explicitly unchanged in 1.3.0

No financial formula (`FORMULA_VERSION` stays `1.0`), no persisted-data
schema (`STORAGE_SCHEMA_VERSION` stays `1.0.0`), no Engine file, no new
protocol API call, no V3/V4 semantic change (Net Worth, Loan-to-Value,
and Leverage are computed identically for both protocol versions,
exactly as the table already did), and no change to the Path B
(self-hostable, no operated production deployment) deployment
disposition — see `docs/DEPLOYMENT_DISPOSITION.md`.

### Release status

This entry promotes one batch already independently verified by its own
audit-implement-test-validate cycle (full suite: 4100/4100 tests
passing, both in the implementation worktree and independently after
applying the delivered patch to a clean checkout) — not a fresh
Milestone-9/V1.1-style Release Candidate process with its own new manual
exploratory pass, the same promotion pattern `1.2.0`'s own entry above
already used. See `PROJECT_STATUS.md`'s "v1.3.0 Release Reconciliation"
section for the full record.

## [1.2.0] — 2026-09-04

Eleven commits on top of Version 1.1.0, falling into two groups: five
ship or fix real Aave V4 capability; six close V3/V4 terminology and
semantic-correctness gaps that capability work introduced or exposed.
Full per-commit detail lives in `PROJECT_STATUS.md`'s "V1.2.0 Release
Reconciliation" section; this entry summarizes what changed for a user.

### What's new in 1.2.0

- **Aave V4 portfolios can now be created directly**, not only opted
  into after the fact. The New Portfolio form now offers the same Aave
  V4 choice `AaveProtocolVersionForm` already offered on an existing
  portfolio's own edit page — address-independent: you can create a V4
  portfolio with no on-chain address at all (fully manual), or with one
  (opting into whichever fields that address's live data can supply).
- **A third V4 field can now be read live: base drawn APR**, alongside
  the debt state and collateral risk factor that already could be. Like
  those two, it's opt-in (an on-chain address), read-only, and never
  silently overwrites a manual entry that disagrees with it.
- **Live V4 reserve (BTC) price**, read from the V4 pool's own oracle —
  distinct from, and independent of, V3's own live price feed.
- **Clearer live/manual status, per field.** A V4 portfolio's debt
  state, collateral risk, and base drawn rate each now show their own
  live/manual status individually, rather than one combined status for
  the whole portfolio — visible on the Portfolio page and reflected
  consistently in CSV/JSON exports and Portfolio History entries.
- **V4 debt figures are now consistently canonical wherever a proposed
  change is previewed** — the Portfolio page's own preview and
  Simulation's portfolio-action path now use the same real
  drawn-debt-plus-premium-debt total (and, on a repayment, the same
  real premium-first split) every other V4 surface already used.
- **V3/V4 terminology correctness, verified across the entire
  application.** A focused audit-and-fix cycle confirmed and closed
  every remaining place a V4 portfolio's real Collateral Factor was
  still labeled or validated as though it were V3's "Maximum LTV," or
  a V4 portfolio's unchanged assumptions still named "Supply APR" (a
  concept V4 doesn't have) — across Loop Builder, Simulation's Scenario
  Builder, Apply-to-Portfolio, and the Dashboard. In every case the
  underlying number was already correct; only the label or comparison
  was wrong. A final, independent closure audit re-verified every
  reachable V4 surface against a fresh checkout and found nothing
  further to fix. Full test suite: 4092/4092 passing.
- **Two internal-only fixes**, mentioned for completeness rather than
  because they're user-visible: a V4 API response-serialization bug
  (large on-chain numbers could break JSON encoding in specific cases)
  and the addition of a shared, consistent error-handling helper across
  the three V4 on-chain-read routes.

### Explicitly unchanged in 1.2.0

No financial formula (`FORMULA_VERSION` stays `1.0`), no persisted-data
schema (`STORAGE_SCHEMA_VERSION` stays `1.0.0`), no live wallet/
transaction capability, no new external service dependency, and no
change to the Path B (self-hostable, no operated production deployment)
deployment disposition — see `docs/DEPLOYMENT_DISPOSITION.md`.
Collateral quantity and debt balance remain always-manual for both
protocol versions.

### Release status

This entry promotes work already independently verified by its own
audit-implement-test-validate cycle per commit, plus a subsequent
closure audit that re-checked every reachable V4 surface and found
nothing further to fix (4092/4092 tests passing) — not a fresh
Milestone-9/V1.1-style Release Candidate process with its own new
manual exploratory testing pass. See `PROJECT_STATUS.md`'s "V1.2.0
Release Reconciliation" section for the full record.

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

## [Unreleased]

### Post-M10 hardening (R1/R2)

**No version-axis bump accompanies this subsection** — none of this work
changes `package.json`'s `"version"`, `APP_VERSION`, `ENGINE_VERSION`,
`FORMULA_VERSION`, or `STORAGE_SCHEMA_VERSION`; Version 1.0.0's own
Quality Sign-Off (below) is unchanged and not reopened. This entry
records production-readiness and security hardening completed *after*
Milestone 10's own closure (`PROJECT_STATUS.md`'s "Post-Milestone-10
Hardening" section has the full task-by-task record) but *before* the
`v1.0.0` tag was created — see "What 'released' means here" above. (The
`v1.0.0`, `v1.1.0`, and `v1.2.0` tags have since all been created; this
subsection is unchanged and remains an accurate historical record of
hardening work that predates all three and was folded into `1.0.0`'s own
scope without ever getting its own version-labeled entry.) **No
production deployment occurred as part of this work.**

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
