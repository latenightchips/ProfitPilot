# Milestone 6 Completion Report — Simulation Workspace

Date: 2026-07-31
Status: **Complete.** All 26 documented tasks (M6-001 through M6-026) addressed per `docs/06_TASKS.md`.

This document is a permanent record of Milestone 6, maintained alongside
`PROJECT_STATUS.md` (which remains the live, continuously-updated tracker).
Unlike `PROJECT_STATUS.md`, this file is a fixed snapshot taken at the
milestone boundary and is not edited as later milestones proceed. It is not
part of the `docs/` specification set.

**Backfilled during Milestone 7 housekeeping (2026-08-04).** Milestone 6 was
completed and synchronized to GitHub on 2026-07-31, but this permanent
snapshot was not created at the time — `PROJECT_STATUS.md`'s own "Next task"
notes from that period explicitly flagged the gap as "an outstanding
follow-up, not a blocker." This report is written from `PROJECT_STATUS.md`'s
own detailed "Milestone 6 progress" section (25 batch write-ups, unedited
since Milestone 6 closed) and the real git history — no detail here was
reconstructed from memory or guessed.

---

## 1. Completed Tasks

Implementation proceeded in 25 batches, one commit per batch, each validated
(typecheck, lint, format, full test suite, coverage, production build,
Playwright e2e where applicable) before commit.

| Batch | Tasks          | Scope                                           | Commit    |
| ----- | -------------- | ----------------------------------------------- | --------- |
| 1     | M6-001, M6-002 | Simulation Workspace foundation, route          | `e319b97` |
| 2     | M6-003         | Simulation Store                                | `bef62b3` |
| 3     | M6-004         | Scenario Builder                                | `cd3e058` |
| 4     | M6-005         | Price Scenario Simulation                       | `5c9780b` |
| 5     | M6-008         | Portfolio Action Simulation                     | `a2f928b` |
| 6     | M6-006         | Interest Rate Simulation                        | `c883b05` |
| 7     | M6-007         | Time Projection                                 | `ec968c6` |
| 8     | M6-009         | Scenario Summary                                | `2d72ef9` |
| 9     | M6-010         | Scenario Comparison                             | `689c81b` |
| 10    | M6-011         | Scenario Charts                                 | `22d962e` |
| 11    | M6-012         | Scenario Timeline                               | `3317681` |
| 12    | M6-013         | Simulation Assumptions Panel                    | `6b66f6e` |
| 13    | M6-014         | Simulation Warnings                             | `918ada6` |
| 14    | M6-015         | Save Simulation                                 | `17f7faa` |
| 15    | M6-016         | Load Saved Simulation                           | `88e02b0` |
| 16    | M6-017         | Duplicate Simulation                            | `7d59a8d` |
| 17    | M6-018         | Delete Simulation                               | `2ed0ab7` |
| 18    | M6-019         | Export Simulation                               | `edfc7b0` |
| 19    | M6-020         | Simulation History                              | `9a72976` |
| 20    | M6-021         | Responsive Workspace                            | `b5b5dc1` |
| 21    | M6-022         | Accessibility Review                            | `0d1d828` |
| 22    | M6-023         | Unit Tests                                      | `7cba787` |
| 23    | M6-024         | Integration Tests                               | `5f1c4f0` |
| 24    | M6-025         | End-to-End Tests                                | `2498c60` |
| 25    | M6-026         | UI Specification Audit (final Milestone 6 task) | `8c66d2f` |

All 26 tasks (M6-001–M6-026) are accounted for above; none were skipped.

---

## 2. Architecture Decisions

- **Layering held with zero violations across all 25 batches.** The
  Simulation Engine and Service layer (`engine/simulation/`,
  `services/simulation/scenario.ts`) already existed from Milestones 2–3 —
  `stores/simulationStore.ts` and `ScenarioBuilder.tsx` call it directly,
  never a second calculation path. Batch 4 specifically confirmed and
  followed `04_BUILD_GUIDE.md`'s own "Only services communicate directly
  with the Formula Engine" rule when designing the preset-scenario buttons.
- **`features/simulation/index.ts` deliberately omits `state/` and
  `tests/`**, despite M6-002's own literal suggested directory tree naming
  both — every Store in this codebase lives in the one top-level `stores/`
  directory, every test file lives in the one top-level `tests/` directory
  (both established at M1-003), never nested inside a feature. This
  precedent was reused verbatim by all three Milestone 7 feature modules.
- **Batch 5 (M6-008, Portfolio Action Simulation) established the
  mechanism that later became this codebase's single most-reused
  cross-tool bridge.** Rather than extending the already-locked
  `PortfolioAction` type (M3-006, explicitly limited to six named variants
  "with no interface of its own"), a new, Simulation-only function
  (`simulatePortfolioAction`, `services/simulation/portfolioAction.ts`)
  was added, reusing `calculatePortfolioSummary` directly. One function
  satisfies all 5 named "Actions" ("Add collateral," "Withdraw
  collateral," "Borrow," "Repay," "Combined actions") via a single signed
  `{collateralDelta, debtDelta}` pair rather than five separate code
  paths. `stores/simulationStore.ts` gained a second, independent result
  field, `portfolioActionPreview`, kept separate from `currentResult`
  since the two results are structurally different shapes. This exact
  `PortfolioActionSimulationInput` mechanism was reused three more times
  in Milestone 7 (`ApplyLoopAsSimulation.tsx`, Recommendation Center's
  action links, `ApplyExitPlanAsSimulation.tsx`).
- **A real, pre-existing e2e test bug was found and fixed during Batch 5's
  own mandatory `pnpm test:e2e` run** — `dashboardWorkflows.spec.ts`'s
  "Navigate to Simulation Workspace" test asserted a heading name without
  `exact: true`, and Batch 1's own `/simulation` rewrite had added a
  second heading whose accessible name also contained the same substring,
  a timing-dependent strict-mode violation that had silently survived
  three prior batches' own "unchanged" e2e results.
- **The Testing phase (M6-023–M6-025) each targeted a distinct layer**:
  unit/component tests, Store/Service-level integration tests (no
  rendering), and real-Chromium end-to-end tests — the same three-layer
  split Milestone 5's own M5-025–M5-027 established, reused without
  modification.
- **Accessibility and Responsiveness were each validated once, at
  dedicated batches (21 and 20), not re-litigated at every subsequent
  batch** — Batch 25's own final UI audit re-checked both explicitly and
  found no new gap on re-check, confirming the earlier, dedicated passes
  had actually held.

---

## 3. Resolved Documentation Conflicts

**None were resolved to closure during Milestone 6.** Conflict #20 (the
only conflict closed in the project to date) was resolved in Milestone 4,
Batch 0, before Milestone 6 began. Milestone 6 raised one new conflict
(below) but closed none.

---

## 4. Unresolved Documentation Conflicts

**30 conflicts remain open** (31 raised across the project to date, minus
#20). Full detail and exact wording live in `PROJECT_STATUS.md` under
"Unresolved documentation conflicts."

### Carried forward from Milestones 2–5 (29 open, unaffected by Milestone 6 except where noted)

Conflicts #1 through #19 and #21 through #30 (per `PROJECT_STATUS.md`'s own
numbering; #20 is resolved) — the full carried-forward list is reproduced in
`MILESTONE_5_COMPLETION.md`'s own Section 4 (through #29) plus Conflict #30
itself (Milestone 5's own second, later-raised conflict — see that report's
own Section 4 note on the Dashboard Page 3 gap), and is not repeated
verbatim here to avoid drift between the permanent snapshots. Two items
directly touched Milestone 6's own build:

- **Conflict #1** (Health Factor risk-band thresholds) — Milestone 6's own
  task list does not require a risk-band classification the way Milestone
  5's M5-008 did; not a blocker here.
- **Conflict #29** (`RecommendationRuleConfig`'s undocumented thresholds,
  raised in Milestone 5 Batch 4) — cited in Batch 25's own new Conflict
  #31 write-up as the reason `generateRecommendationSet` remains
  unsuitable for a Simulation-scoped Recommendation feature even if one
  were built.

### Raised during Milestone 6 (1 open)

31. **`03_UI.md` Page 5 ("Simulation Workspace") documents a "Recommendation"
    region with no Engine/Service-layer support anywhere.** Found while
    performing the final M6-026 audit (Batch 25). Page 5's own `PAGE
LAYOUT` sketch names 5 regions including "Recommendation," with three
    fully worked examples (Excellent/Warning/Critical) and a "only one
    recommendation is displayed" rule — corroborated independently in two
    separate places in `01_PRD.md`'s own REQ-004 chapter. A fresh grep of
    `06_TASKS.md`'s full Milestone 6 section found zero occurrences of
    "recommendation" anywhere in it; no Engine or Service function
    computes a Simulation-specific recommendation, and Milestone 5's own
    `generateRecommendationSet` is Dashboard-scoped and not wired to
    Simulation results at all. Not built — this would mean inventing new
    Engine/Service logic (a scoring or rule-selection function with no
    documented formula) from scratch, well beyond an "M"-effort UI-audit
    task's own scope. Flagged for a product decision (build a real
    Simulation Recommendation feature against documented rules, or mark
    Page 5 Section 4 superseded), the same two options Conflict #30
    already offers for the Dashboard's own Page 3 gap.

---

## 5. Validation Statistics

Final validation, as of Milestone 6's completion (Batch 25, commit `8c66d2f`):

| Check                                    | Result                  |
| ---------------------------------------- | ----------------------- |
| `pnpm typecheck`                         | Pass                    |
| `pnpm lint`                              | Pass                    |
| `pnpm format:check`                      | Pass                    |
| `pnpm test` (Vitest, unit + integration) | **1303 / 1303 passing** |
| `pnpm test:e2e` (Playwright, Chromium)   | **55 / 55 passing**     |
| `pnpm build` (production)                | Pass                    |

Both the Testing-phase DoDs (M6-023 "critical simulation components are
covered," M6-024 "simulation workflows operate correctly," M6-025 "critical
Simulation Workspace workflows pass successfully") are independently
covered at three distinct layers: `tests/unit/features/simulation/`
(component-level), `tests/integration/simulation/simulationWorkflows.test.ts`
(Store/Service-level, no rendering), and `tests/e2e/simulationWorkflows.spec.ts`
(real Chromium browser, real navigation).

---

## 6. Coverage

Project-wide, `vitest.config.ts` scope, as of Milestone 6's completion:

| Metric     | Coverage                                    |
| ---------- | ------------------------------------------- |
| Statements | 96.32% (improved from Milestone 5's 95.58%) |
| Branches   | 91.19%                                      |
| Functions  | 100%                                        |
| Lines      | 99.08%                                      |

---

## 7. Lessons Learned

- **A milestone's final "UI Specification Audit" task keeps finding real
  gaps when performed as an actual full read, not a citation-driven
  spot-check — this is now a two-for-two pattern, not a one-off.**
  Milestone 5's own M5-028 (Batch 18) found Conflict #30 this same way;
  Milestone 6's M6-026 (Batch 25) found Conflict #31 by applying the
  identical discipline (a full page read, plus a fresh full-milestone grep
  of `06_TASKS.md` for the page's own key vocabulary) rather than trusting
  that 24 prior batches' own citations had already covered the page
  completely.
- **A genuinely reachable Store-state gap ("computed but never displayed")
  can survive many batches unnoticed when every individual batch's own
  manual verification happens to exercise only the success path.** Batch
  25's own "States" finding — `simulationStore.ts`'s `status`/`errors`
  fields correct since Batch 1, never read by any component — was found
  by a direct, deliberate search across every component file, the same
  technique Milestone 7 Batch 7 later reused to find and fix the identical
  class of gap across all three of its own strategy tools.
- **A significant new Service function, when it composes only already-
  public Service calls, does not weaken the layering discipline even
  though it is new code** — Batch 5's `simulatePortfolioAction` is a real
  precedent for "add a small, narrowly-scoped Service function rather than
  force a new requirement into an existing, deliberately-locked type,"
  reused repeatedly in Milestone 7 (e.g. `services/portfolio/exposure.ts`,
  Batch 2).
- **Timing-dependent e2e failures are real bugs, not flakes, until proven
  otherwise** — Batch 5's own strict-mode violation only reproduced under
  the default parallel-worker run, not a `--workers=1` rerun, and had
  silently not reproduced in three prior batches' own "unchanged" results.
  Treating an intermittent failure as noise rather than investigating its
  root cause would have left a real, deterministic-once-triggered bug in
  place.

---

## 8. Recommendations for Milestone 7

_(Reproduced from the recommendations actually given at the time, for the
historical record — Milestone 7 has since been completed; see
`MILESTONE_7_COMPLETION.md` for how these played out in practice.)_

1. Re-read `docs/06_TASKS.md`'s Milestone 7 section fresh before
   implementing anything.
2. The Loop/Exit/Recommendation Engine and Service layers already exist
   from Milestones 2–3 (`engine/loop/`, `engine/exit/`,
   `engine/recommendation/`, `services/loop/strategy.ts`,
   `services/exit/plan.ts`, `services/recommendation/recommendations.ts`)
   — Milestone 7 builds UI/Store on top of them, never a second
   calculation path.
3. Cross-check `03_UI.md` Page 6 ("Loop Builder") and Page 7 ("Exit
   Planner") against `06_TASKS.md`'s own M7-xxx task list early, not only
   at the final audit task — Page 5's own superseded-mockup pattern
   (Conflict #31, this report) was found only at the very last batch;
   check for the equivalent risk before, not after, building against a
   page that might already be superseded. **This recommendation was acted
   on**: Milestone 7 Batch 1 read Page 6/7 in full before any code was
   written and found Conflicts #32/#33 immediately, rather than waiting
   for its own final audit task.
4. Continue the established batch workflow (verify sync → read the
   milestone's own documentation fully → implement one documented batch →
   run the full validation pipeline including `pnpm test:e2e` →
   architecture/traceability audit → document conflicts → stop for
   approval before committing).
