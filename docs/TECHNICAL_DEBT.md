# Technical Debt Review

`06_TASKS.md` M10-022 ("Review Technical Debt") — Milestone 10 Batch 5.
Dependencies: M10-021 (`docs/VERSION_1_RETROSPECTIVE.md`). Description:
"Identify deferred features, refactoring opportunities, performance
improvements, developer experience improvements." DoD: "Technical debt
is prioritized."

This consolidates debt already recorded across `PROJECT_STATUS.md`,
`docs/KNOWN_ISSUES.md`, `docs/DEFECT_CLASSIFICATION.md`, and
`docs/PERFORMANCE_BASELINE.md` into one prioritized list, rather than
re-discovering it. **Prioritization uses impact/effort reasoning, the
same style `docs/DEFECT_CLASSIFICATION.md`'s own P0–P3 impact-based
severity model uses** — this is a debt-priority ranking, not a defect
classification; nothing below is a release blocker (Version 1.0.0's own
zero-P0/zero-P1 sign-off, `docs/DEFECT_CLASSIFICATION.md` §6, is
unaffected).

## Priority 1 — highest leverage for the next release cycle

- ~~**Cloud Sync UI copy still reads "does not yet sync to the cloud"**~~
  **Resolved — corrected in Milestone 10 Batch 7, confirmed by fresh
  inspection during v1.6.0's release reconciliation.**
  `app/settings/SettingsPageClient.tsx` now states the local-only
  storage model directly ("Sync state: Local only — your data is stored
  on this device and is not synced anywhere," line 575), not the
  earlier "does not yet sync to the cloud" wording this item originally
  flagged (found and recorded in `docs/SECURITY_REVIEW.md`, Milestone 9
  Batch 6, "Unauthorized cloud deletion," and Milestone 10 Batch 3's
  disclosure audit). Left as a stale, uncorrected debt-log entry across
  the `v1.4.0` and `v1.5.0` release reconciliations (both of which
  deliberately did not fold `docs/TECHNICAL_DEBT.md` into ordinary
  release work) — corrected here as an explicitly-scoped documentation
  cleanup item, not a re-litigation of the underlying fix, which had
  already shipped.
- **No automated dependency-update tooling configured** (no Dependabot/
  Renovate — `docs/MAINTENANCE_SCHEDULE.md`'s own "Dependency updates"
  section already states this honestly). Every dependency bump today is
  fully manual. Moderate effort to configure, meaningful reduction in
  how easily a future security advisory is missed. **This item is about
  the missing tooling, not about the current advisory count** — the
  existing dependency-audit baseline (`docs/KNOWN_ISSUES.md` category C,
  `docs/DEFECT_CLASSIFICATION.md` §6: 18 `pnpm audit` advisory
  instances, 11 high / 7 moderate / 0 critical, every one a build/lint/
  test-time-only tooling-dependency path, none reachable from
  client-shipped runtime code) is accurate and unchanged as of this
  batch, already classified P2/non-blocking, and is not itself listed
  as debt here.

## Priority 2 — real, bounded, lower urgency

- **33 of 69 Formula IDs are out of scope** (multi-asset collateral/
  debt, compound interest, swap fees/slippage/gas, several
  Recommendation Engine formulas) — Conflicts #5, #7, #8, #9, #10, #11,
  #12, #15 (`PROJECT_STATUS.md`), explicitly Version 2 scope. This is
  the single largest deferred-feature category; `docs/VERSION_2_BACKLOG.md`
  (this batch, below) is where it is actually prioritized as product
  scope, not duplicated here as a flat list.
- **Health Factor risk-band classification not implemented** (F-026/
  F-060, Conflict #1) — four disagreeing source documents with no
  canonical scheme designated; the UI honestly shows "Not available"
  rather than guessing (`docs/DEFECT_CLASSIFICATION.md` §6). Blocked on
  a product decision (which banding scheme governs), not an engineering
  gap — tracked here as debt because the blocker itself has never been
  resolved across ten milestones, not because the workaround is wrong.
- **`03_UI.md`'s Settings "ABOUT" section was never built** (Conflict
  #39, Milestone 10 Batch 3) — Application/Formula/Engine Version, Data
  Provider, Last Synchronization, License. Two of its six fields are
  themselves blocked on owner decisions (governing license; how to
  describe a cancelled-sync product's "Last Synchronization" field) —
  see "Unresolved owner decisions" in `PROJECT_STATUS.md`'s Batch 3
  record. Not actionable until those decisions are made.
- ~~**CI does not run the Playwright suite automatically**~~ **Resolved
  — substantially addressed by Post-M10 hardening (R1-3, R2-4),
  confirmed by fresh inspection during v1.7.0's release reconciliation.**
  `.github/workflows/ci.yml` runs a small, blocking production smoke
  suite (`tests/e2e/productionSmoke.spec.ts`) against a real `pnpm build
  && pnpm start` server on every PR/push; the broader 150-test suite
  (including all 43 accessibility tests) is wired into a separate,
  manual `workflow_dispatch` workflow (`.github/workflows/e2e-full.yml`)
  as a deliberate release gate — see `docs/KNOWN_ISSUES.md` category C
  for the full record. This item originally described a gap that no
  longer exists: some automated coverage now runs on every push, not
  none. Left as a stale, uncorrected debt-log entry across the `v1.2.0`
  through `v1.6.0` release reconciliations (none of which folded
  `docs/TECHNICAL_DEBT.md` into ordinary release work) — corrected here
  as an explicitly-scoped documentation cleanup item, not a
  re-litigation of the underlying hardening, which had already shipped.
  Whether the full suite should ever become a required (not just
  manual) check remains a genuinely open, separate question — this
  correction only fixes the item's factual claim, it does not resolve
  that question.
- **Formula Engine has never been published as a standalone package**
  — `04_BUILD_GUIDE.md`'s own stated aspiration
  (`docs/VERSION_1_RETROSPECTIVE.md`'s "Architecture" section), not yet
  acted on. `ENGINE_VERSION` still moves in lockstep with the
  application version as a result. Real effort (packaging, a real
  publish target), no current product requirement forcing it — this
  version's Engine has never needed to be consumed outside this
  repository.

## Priority 3 — low impact, low urgency, or explicitly deferred by design

- **`services/export/JsonExporter.ts`'s `buildFullBackupFile` awaits
  7 record-type reads sequentially rather than via `Promise.all`**
  (`docs/PERFORMANCE_BASELINE.md`'s own "Large export generation"
  finding) — a real, identified opportunity, deliberately left as-is
  because each iteration is a synchronous `localStorage` read wrapped
  in an already-resolved `Promise`, not network I/O; parallelizing it
  would save microtasks, not measurable wall-clock time, at this
  application's realistic single-user data scale. Explicitly flagged in
  its own source document as "cheap... if a future batch's measurement
  ever shows otherwise" — unchanged here, not re-litigated.
- **Per-layer (Engine/Services/UI/Stores) coverage breakdown uses a
  line-coverage proxy**, not an exact statement-count breakdown
  (`docs/DOD_COMPLIANCE_AUDIT.md` §1) — the blended, exact statement
  figure (96.33%) already clears every `04_BUILD_GUIDE.md` tier; only
  the per-layer view is a proxy. Documentation/tooling precision only,
  no correctness impact.
- **No license-audit tooling configured** (`license-checker`, `pnpm
  licenses`, or similar) — a manual, one-time scan substitutes
  (`docs/SECURITY_REVIEW.md` M9-029, re-confirmed directly against
  installed `package.json` files in Milestone 10 Batch 3). Low urgency
  while the governing project license itself remains an unresolved
  owner decision — automating a license audit before a license is
  chosen has limited value.
- **`REGISTERED_MIGRATIONS` has never run against real prior-version
  data** (`services/persistence/migrations/migrate.ts`) — the chain-
  walking mechanism itself is fully tested against a synthetic
  registry and wired into the real app-boot path
  (`docs/VERSIONING_STRATEGY.md`), but Version 1.0.0 is this project's
  first release, so no real prior version has ever existed to migrate
  from. Not actionable debt today — it becomes relevant the moment a
  second `STORAGE_SCHEMA_VERSION` ships, not before.

## What is explicitly not technical debt

- **Cloud Database/Cloud Sync absence** — cancelled by product decision
  (Milestone 8), not deferred or incomplete; excluded from this list
  per `docs/KNOWN_ISSUES.md` category E's own "permanent, not deferred"
  distinction.
- **No operated production deployment/monitoring** — deferred by the
  explicit Path B product/release decision, not an engineering gap;
  `docs/PRODUCTION_READINESS.md` already covers everything this
  repository controls without external infrastructure.
- **`PROJECT_STATUS.md`'s own size (15,000+ lines)** — a real
  documentation-navigability observation (`docs/VERSION_1_RETROSPECTIVE.md`'s
  "Documentation" section), but its response is archival organization
  (M10-024, below), not debt remediation.

**No new code, test, or configuration change was made to produce this
document** — every item above cites pre-existing evidence; this batch
only consolidates and prioritizes it, per M10-022's own audit-first
scope.
