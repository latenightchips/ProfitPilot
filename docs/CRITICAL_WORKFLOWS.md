# Critical End-to-End Workflows

`06_TASKS.md` M9-015 ("Define Critical End-to-End Workflows"). Dependencies:
M9-001. Priority P0, Effort M. Description: "Create the final list of
release-blocking workflows." DoD: "Every critical workflow has an
automated end-to-end test or an approved manual test procedure."

This is that final list — the 14 workflows `06_TASKS.md` itself names —
each mapped to its real, verified coverage. Reuse-before-creation applied
throughout: 11 of 14 already had real Playwright coverage before this
batch (cited, not duplicated); 3 were genuine gaps this batch closed or
resolved.

| # | Workflow | Status | Evidence |
|---|---|---|---|
| 1 | Create first portfolio | Covered | `tests/e2e/portfolioWorkflows.spec.ts` — `Cover: Create first portfolio` |
| 2 | Edit collateral and debt | Covered | `tests/e2e/portfolioWorkflows.spec.ts` — `Cover: Edit collateral`, `Cover: Edit debt` |
| 3 | Review Dashboard risk | Covered | `tests/e2e/dashboardWorkflows.spec.ts` — `Cover: Open risk details (M5-027)` |
| 4 | Run simulation | Covered | `tests/e2e/simulationWorkflows.spec.ts` — `Cover: Create simulation (M6-025)` |
| 5 | Compare scenarios | Covered | `tests/e2e/simulationWorkflows.spec.ts` — `Cover: Compare scenarios (M6-025)` |
| 6 | Build loop strategy | Covered | `tests/e2e/loopBuilderWorkflows.spec.ts` — `Cover: Valid strategy (M7-041)` |
| 7 | Stress-test loop | Covered | `tests/e2e/loopBuilderWorkflows.spec.ts` — `Cover: Stress scenario (M7-041)`; also `tests/e2e/crossToolWorkflows.spec.ts` — `Flow: Build a loop and stress-test it in Simulation Workspace (M7-044)` |
| 8 | Create exit plan | Covered | `tests/e2e/exitPlannerWorkflows.spec.ts` — `Cover: Full exit (M7-042)`, `Cover: Partial exit (M7-042)` |
| 9 | Review recommendation | Covered | `tests/e2e/recommendationWorkflows.spec.ts` — `Cover: Priority ordering (M7-043)`, `Cover: Trigger explanations (M7-043)` |
| 10 | Save and reload work | Covered | Per-tool: `tests/e2e/simulationWorkflows.spec.ts` `Cover: Reload (M6-025)`; `tests/e2e/loopBuilderWorkflows.spec.ts` `Cover: Save and reload (M7-041)`; `tests/e2e/exitPlannerWorkflows.spec.ts` `Cover: Save and reload (M7-042)`; `tests/e2e/crossToolWorkflows.spec.ts` `Flow: Reload a saved strategy (M7-044)`. See also #12 below — the real-*browser-refresh* variant of "reload" was a separate, genuine gap this batch closed. |
| 11 | Export and import backup | Covered | `tests/e2e/settingsWorkflows.spec.ts` — `Cover: Full JSON export includes all supported records`, `Cover: addAsNew merge mode...`, `Cover: replaceAll requires explicit confirmation...`, plus this batch's own new `Cover: mergeNonConflicting merge mode...`/`Cover: replaceSelected merge mode...` (M9-020, see §2 below) |
| 12 | Use application offline | **Closed this batch** | New `tests/e2e/offlineWorkflows.spec.ts` — `Cover: Use application offline — create a portfolio and run a simulation with no network connectivity (M9-015)`. Genuinely missing before this batch (confirmed by direct search: no `context.setOffline`/`navigator.onLine`/"offline" anywhere in `tests/e2e/`) — not applicable-by-product-decision like #14, a real gap this application's own Manual-Mode/local-only architecture made straightforward to close. |
| 13 | Sign in and synchronize | **Split — see below** | "Sign in": covered by the real, honest graceful-degradation path this environment actually takes — `tests/e2e/authWorkflows.spec.ts`'s own header comment documents that no Supabase project is configured anywhere in this sandbox, so every sign-in/sign-up/reset test exercises the real "not available in this environment" behavior, not a fabrication. "...and synchronize": **N/A — removed by product decision** (Milestone 8 local-only re-scope, `docs/MILESTONE_8_SCOPE_CHANGE.md`, Conflict #34 — no cloud synchronization mechanism exists in this application to test). |
| 14 | Resolve data conflict | **N/A — removed by product decision** | Same Conflict #34 basis as the "synchronize" half of #13 — this workflow's own premise (reconciling a local version against a cloud version) requires a cloud sync mechanism that does not exist and was explicitly cancelled. Not to be confused with the Import feature's own, real, local-only "conflict resolution" merge mode (`replaceSelected`) — that is a genuinely different, real feature, newly covered this batch; see §2 below. |

## 1. Reading the table

- **"Covered"** rows had real Playwright coverage before Milestone 9
  Batch 4 began — cited by exact file and test title, verified present by
  direct inspection at the start of this batch, not assumed from an
  earlier milestone's own completion claim.
- **"Closed this batch"** is workflow #12 (Use application offline) — a
  genuine gap with no product-decision reason to skip it, closed with new
  code this batch (see `PROJECT_STATUS.md`'s own Batch 4 write-up for the
  full detail).
- **"N/A — removed by product decision"** rows (#14, and the
  "synchronize" half of #13) are not gaps at all — they test a cloud
  synchronization capability this application deliberately does not have,
  per the same Milestone 8 local-only re-scope every other Milestone 9
  batch has already applied consistently (Batches 1–3's own write-ups).

## 2. A genuinely different "conflict resolution," not double-counted here

Workflow #14's own name ("Resolve data conflict") and `06_TASKS.md`
M9-020's own Include list both use the word "conflict" — but they name two
structurally different things:

- **#14 / M9-015's "Resolve data conflict"** — reconciling two *divergent
  copies* of the same record (one local, one cloud) after a sync. Requires
  a synchronization mechanism. N/A per Conflict #34, as above.
- **M9-020's "Conflict resolution"** — the Import feature's own
  `replaceSelected` merge mode (`services/import/apply.ts`'s own
  `determineRecoverySnapshotReason` literally names this reason
  `'conflict-resolution'`), where "conflict" means "an incoming imported
  record's id collides with an existing local one." Purely local, no sync
  involved, fully built since Milestone 8, and — until this batch — never
  exercised end-to-end. Closed this batch:
  `tests/e2e/settingsWorkflows.spec.ts` — `Cover: mergeNonConflicting
  merge mode...`/`Cover: replaceSelected merge mode... (M9-020)`.

## 3. Cross-browser scope

Every "Covered"/"Closed this batch" row above currently means "verified
in Chromium" (this environment's only available Playwright browser — see
`docs/CROSS_BROWSER_REVIEW.md` §1 for why, and its Chrome/Edge-proxy
justification). Firefox and Safari coverage for these same workflows
follows `docs/CROSS_BROWSER_REVIEW.md`'s own §4 approved manual
procedure — the DoD's own "or an approved manual test procedure" clause,
applied here at the per-browser level rather than the per-workflow level.

## 4. What this document does not re-litigate

`docs/QUALITY_PLAN.md` (M9-001, Batch 1) already established the
canonical supported-browser list, supported-viewport list, and
release-blocking defect categories this document assumes rather than
redefines. `docs/REQUIREMENTS_TRACEABILITY_MATRIX.md` (M9-002) already
maps every `01_PRD.md`/`03_UI.md` requirement to its own implementation
and test evidence at a finer grain than the 14 workflows here — this
document is deliberately narrower and workflow-shaped, matching
`06_TASKS.md` M9-015's own literal Include list, not a restatement of
that broader matrix.
