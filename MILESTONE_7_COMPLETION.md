# Milestone 7 Completion Report — Strategy Tools

Date: 2026-08-04
Status: **Complete.** All 45 documented tasks (M7-001 through M7-045) addressed per `docs/06_TASKS.md`.

This document is a permanent record of Milestone 7, maintained alongside
`PROJECT_STATUS.md` (which remains the live, continuously-updated tracker).
Unlike `PROJECT_STATUS.md`, this file is a fixed snapshot taken at the
milestone boundary and is not edited as later milestones proceed. It is not
part of the `docs/` specification set.

---

## 1. Completed Tasks

Implementation proceeded in 8 batches (a coarser "logical feature batch"
grouping — 5–8 related tasks per batch — rather than Milestones 5/6's
one-task-per-batch density, per explicit instruction), one commit per batch,
each validated (typecheck, lint, format, full test suite, coverage,
production build, Playwright e2e, manual browser verification,
architecture/traceability audit) before commit.

| Batch | Tasks         | Scope                                                                                                    | Commit    |
| ----- | ------------- | -------------------------------------------------------------------------------------------------------- | --------- |
| 1     | M7-001–M7-005 | Shared Strategy foundation (view models, comparison, assumptions panel, warnings)                        | `b25d1bb` |
| 2     | M7-006–M7-012 | Loop Builder foundation: route, Store, Controls, Presets, Summary, Step Table                            | `98cd28f` |
| 3     | M7-013–M7-018 | Loop Builder: Safety/Cost Analysis, Scenario Sensitivity, Apply-as-Simulation, Save/Load, Export         | `89211b6` |
| 4     | M7-019–M7-023 | Exit Planner foundation: route, Store, Type Selection, Target Form, Calculation Workflow                 | `fb16449` |
| 5     | M7-024–M7-030 | Exit Planner: Full/Partial/Target-HF Results, Feasibility Analysis, Price Sensitivity, Save/Load, Export | `3de9c3f` |
| 6     | M7-031–M7-036 | Recommendation Center: route, List, Detail Panel, Action Links, Acknowledgement, Recalculation           | `1b0a4b6` |
| 7     | M7-037–M7-040 | Strategy Tool Quality: Loading/Empty States, Error Recovery, Responsive Layouts, Accessibility Pass      | `0298168` |
| 8     | M7-041–M7-045 | Loop Builder/Exit Planner/Recommendation Center Tests, Cross-Tool Workflow Tests, UI Specification Audit | `3d71565` |

All 45 tasks (M7-001–M7-045) are accounted for above; none were skipped.

---

## 2. Architecture Decisions

- **Layering held with zero violations across all 8 batches.** All three
  strategy tools (Loop Builder, Exit Planner, Recommendation Center) call
  directly into the Milestone 2/3 Engine and Service layers
  (`planLoopStrategy`, `planExit`, `calculateTargetHealthFactorActions`) —
  `git diff --stat -- engine/` was empty in every single batch; no new
  calculation was ever added at the UI/Store layer.
- **Three independent Zustand stores** (`loopBuilderStore`, `exitPlannerStore`,
  `recommendationCenterStore`), each accepting a plain `ApplicationPortfolio`/
  `Portfolio` value at call time rather than importing `portfolioStore` or
  each other — the same structural-independence discipline
  `stores/simulationStore.ts` established at M6-003, applied three more
  times. Cross-tool wiring is deliberately confined to the UI layer.
- **One shared "action bridge" mechanism connects all three strategy tools
  to Simulation Workspace and to each other — reused, never reinvented,
  across three separate batches.** `PortfolioActionSimulationInput`
  (`{collateralDelta, debtDelta}`, M6-008) was reused by
  `ApplyLoopAsSimulation.tsx` (Batch 3), the Recommendation Detail Panel's
  own action links (Batch 6), and Batch 8's own `ApplyExitPlanAsSimulation.tsx`
  — three call sites, one mechanism, never a live-portfolio mutation.
- **A shared error-recovery layer, added at Batch 7, standardized "restore
  last valid result" across all three tools in one pass.**
  `StrategyErrorBanner.tsx` and a coordinated Store-level fix (stop nulling
  `currentResult`/`actions` on failure) replaced three previously-silent
  gaps — each Store's own `errors`/`status` fields were already correctly
  computed since their foundation batches, but never rendered by any
  component until Batch 7 closed the loop.
- **Two real specification gaps were found and resolved before any code was
  written, at Batch 1** — Loop Builder's own `03_UI.md` Page 6 "Auto Loop
  Engine" mockup directly contradicts `06_TASKS.md`'s own M7-008 manual-
  `maxLoops`-input task and the already-built Engine (Conflict #32); the
  Recommendation Center has no page anywhere in `03_UI.md`'s 10-page index
  at all (Conflict #33, the same shape as Conflict #23's Portfolio List
  gap). Both resolved in favor of `06_TASKS.md`'s own buildable task text,
  the same precedence Conflicts #30/#31 already established for Dashboard
  and Simulation Workspace.
- **A nominally test-only task (M7-044) found and closed a genuine feature
  gap rather than silently skipping the flow it couldn't test.** Exit
  Planner never received an equivalent to Loop Builder's own
  `ApplyLoopAsSimulation.tsx` — Batch 8 built the minimal, justified
  `ApplyExitPlanAsSimulation.tsx` bridge, reusing the exact same mechanism,
  rather than leaving "Copy an exit plan into a simulation" untestable.
- **Testing followed a real audit-then-fill discipline, not a from-scratch
  build.** Batch 8 confirmed extensive unit/component/Store coverage
  already existed for all three tools from their own feature batches, and
  added exactly what was missing: dedicated end-to-end workflow specs per
  tool plus one cross-tool workflow spec — 27 new Playwright tests, not a
  redundant re-test of already-covered ground.

---

## 3. Resolved Documentation Conflicts

**None were resolved to closure during Milestone 7.** Conflict #20 (the
only conflict closed in the project to date) was resolved in Milestone 4,
Batch 0. Milestone 7 raised two new conflicts (below) but closed none.

---

## 4. Unresolved Documentation Conflicts

**32 conflicts remain open** (33 raised across the project to date, minus
#20). Full detail and exact wording live in `PROJECT_STATUS.md` under
"Unresolved documentation conflicts"; titles are reproduced here for the
permanent record.

### Carried forward from Milestones 2–6 (30 open, unaffected by Milestone 7 except where noted)

1. Health Factor risk-band thresholds disagree across four documents
2. Two `04_BUILD_GUIDE.md` pages are referenced but missing content
3. `01_PRD.md` REQ-001–REQ-017 sequencing vs. version scope (v0.1–v1.0)
4. Minor / non-blocking items
5. Single-asset vs. multi-asset collateral/debt scope — resolved for
   Milestone 2 in favor of single-asset only
6. Health Factor display precision: 2 decimals vs. 3 decimals
7. Compound interest (M2-013/M2-014) has no documented formula
8. Swap fees / slippage / gas estimate have no documented formula anywhere
   — **directly relevant to Milestone 7**: every itemized-unavailable cost
   display across Loop Builder and Exit Planner (Cost Analysis,
   Implementation Costs, Exit Feasibility Analysis) traces to this gap
9. The Recommendation Engine formula chapter (F-060–F-069) has no task
   assignment anywhere in `06_TASKS.md`
10. "Target cash proceeds" (M2-024) has ambiguous mechanics — **revived as
    an actual blocking UI gap in Milestone 7 Batch 4**: `ExitTypeSelector.tsx`
    renders it as an explicit, labeled, disabled option
11. "Exit readiness" (M2-025) has no Formula ID anywhere in the
    Recommendation Engine chapter
12. F-067 "Simple Portfolio Score" documents weights but not the component
    formulas they weight
13. F-040 "Target Debt" does not account for collateral sold during an exit
    — **directly cited in Milestone 7 Batch 5**: `TargetHealthFactorResult.tsx`'s
    own "Difference from Target" row discloses this approximation's real,
    non-zero effect rather than hiding it
14. `02_Formulas.md`'s Golden Reference Portfolio loop step cannot be
    reproduced as an immutable fixture
15. M2-029's DoD, read literally, would require implementing all 69
    Formula IDs — in tension with "never invent formulas"
16. `04_BUILD_GUIDE.md` and `02_Formulas.md` state different Engine
    performance targets
17. `06_TASKS.md` never enumerates which Engine functions count as
    "internal helpers" for M2-031
18. "Source status" (M3-002) is named once with no documented value domain
19. "Formula version" (M3-002) is singular; multi-Engine-call aggregation
    is unspecified
20. M3-013 asks Services to receive "persistence adapters," but no
    persistence Service or task exists anywhere before Milestone 8
21. M4-001 names "Settings" as a required Portfolio field with no defined
    shape
22. `03_UI.md`'s page inventory has no room for a "Portfolio List" page,
    which Milestone 4 requires — **the same shape Conflict #33 found again
    in Milestone 7** for the Recommendation Center
23. M4-005's "preset" protocol-parameter option has no documented preset
    values anywhere — **the same shape Loop Presets' own undocumented
    values follow in Milestone 7 Batch 2**
24. M4-008 names "Price" and "Rate type" debt-position fields with no
    counterpart in the data model
25. M4-009's DoD requires confirmation for "risk-increasing" changes, a
    term never defined
26. M4-012 never says whether an archived portfolio remains independently
    selectable
27. M4-013 requires "auto-save," but M4-009 requires the opposite (explicit
    confirmation) for the same fields
28. `generateRecommendationSet`'s required `RecommendationRuleConfig` has no
    portfolio-level source for 5 of its 7 fields, and no documented
    defaults — **the central, load-bearing reason the Recommendation
    Center (Milestone 7 Batch 6) calls `calculateTargetHealthFactorActions`
    instead**, not a reference by analogy this time
29. `03_UI.md`'s own Page 3 ("Dashboard") describes an entirely different,
    never-built Dashboard design — the largest Page-vs-Tasks gap found
    before Conflict #32 superseded it in scale
30. `03_UI.md` Page 5 ("Simulation Workspace") documents a "Recommendation"
    region with no Engine/Service-layer support anywhere

_(Numbering above follows `PROJECT_STATUS.md`'s own conflict numbers 1, 2,
3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 21, 22, 23, 24, 25,
26, 27, 28, 29, 30, 31 — conflict #20 is resolved and excluded from this
count.)_

### Raised during Milestone 7 (2 open)

32. **`03_UI.md` Page 6 ("Loop Builder") documents an "Auto Loop Engine"
    that directly contradicts `06_TASKS.md`'s own M7-008 task and the
    already-built Engine.** Found before any Milestone 7 code was written
    (Batch 1). Page 6's own design is a fully automatic loop-count solver
    driven only by a target Health Factor, with its own literal "Never ask
    the user for loop count by default" design rule — `06_TASKS.md`'s
    M7-008 names "Maximum Number of Loops" as a direct, independent user
    input instead, and the already-built Engine
    (`LoopStrategyInput.maxLoops`) treats it as a mandatory parameter, not
    a solved output. Resolved in favor of `06_TASKS.md` and the Engine —
    described at the time as "the largest single Page-vs-Tasks gap since
    Conflict #30." Re-verified unchanged at the final Milestone 7 UI audit
    (M7-045, Batch 8).
33. **The Recommendation Center has no page or sidebar entry anywhere in
    `03_UI.md`'s 10-page index.** Found before any Milestone 7 code was
    written (Batch 1) — the same shape as Conflict #23 (the Portfolio List
    page Milestone 4 requires but `03_UI.md`'s own "six primary pages"
    inventory has no room for). Resolved the same way: built exactly as
    `06_TASKS.md` specifies (M7-031–M7-036), with no mockup to reconcile
    against.

---

## 5. Validation Statistics

Final validation, as of Milestone 7's completion (Batch 8, commit `3d71565`):

| Check                                    | Result                                   |
| ---------------------------------------- | ---------------------------------------- |
| `pnpm typecheck`                         | Pass                                     |
| `pnpm lint`                              | Pass                                     |
| `pnpm format:check`                      | Pass                                     |
| `pnpm test` (Vitest, unit + integration) | **1640 / 1640 passing** (176 test files) |
| `pnpm test:e2e` (Playwright, Chromium)   | **101 / 101 passing** (9 spec files)     |
| `pnpm build` (production)                | Pass                                     |

Milestone 7 added 9 dedicated e2e spec files across the milestone
(`loopBuilderWorkflows.spec.ts`, `exitPlannerWorkflows.spec.ts`,
`recommendationWorkflows.spec.ts`, `crossToolWorkflows.spec.ts` at Batch 8,
plus Loop Builder/Exit Planner/Recommendation Center coverage folded into
`accessibility.spec.ts`/`responsiveLayout.spec.ts` at Batch 7) — e2e count
grew from 55 (Milestone 6's own final total) to 101 across this milestone.

---

## 6. Coverage

Project-wide, `vitest.config.ts` scope, as of Milestone 7's completion:

| Metric     | Coverage           |
| ---------- | ------------------ |
| Statements | 96.97% (3174/3273) |
| Branches   | 92.22% (1850/2006) |
| Functions  | 100% (805/805)     |
| Lines      | 99.31% (2757/2776) |

Every uncovered branch is a documented, provably-unreachable defensive
guard (e.g. `RecommendationList.tsx`'s `severityDelta !== 0` tiebreak,
`ApplyExitPlanAsSimulation.tsx`'s re-check inside `handleApply` — mirroring
`ApplyLoopAsSimulation.tsx`'s own identical, already-accepted shape) — none
new or unexplained at milestone close.

---

## 7. Lessons Learned

- **A shared bridging mechanism found once should be actively looked for
  again, not just reused when it happens to be needed.** `PortfolioActionSimulationInput`
  was reused correctly for Loop Builder (Batch 3) and Recommendation Center
  (Batch 6), but Exit Planner's own equivalent was never built across its
  two full batches (4 and 5) — only surfaced when Batch 8's own cross-tool
  test explicitly tried to exercise "copy an exit plan into a simulation"
  and found nothing there to click. A symmetric feature across three
  parallel tools should be checked for symmetry directly, not assumed
  present because the pattern exists elsewhere.
- **A "test-only" task's own DoD can still require a small amount of real
  production code, and that is a legitimate, not a scope-creeping,
  outcome — provided it is flagged, not built silently.** M7-044's own
  Description read as pure test-writing, but its own named flow could not
  be tested without a feature that didn't exist. The right response was
  neither "skip this flow" nor "build it silently" — it was building the
  minimal, precedent-following piece and stating plainly, in the same
  turn, that a production feature had been added under a test task.
- **Reading a Store's own source code, not just its test file, is what
  finds "computed but never rendered" gaps.** Batch 7's central finding —
  `loopBuilderStore.ts`/`exitPlannerStore.ts`'s own `errors`/`status`
  fields were already correct since their foundation batches but never
  read by any component — was only found by grepping every component file
  directly for reads of those fields, not by trusting that "the Store
  already has tests for this" meant the UI used it.
- **A genuinely reachable Engine failure state is not always symmetric
  across parallel tools, and assuming it is wastes a batch's own manual-
  verification effort.** Zero collateral behaves completely differently
  across the three strategy tools: Loop Builder and Recommendation Center
  both absorb it into a real, non-error "not viable" result; only Exit
  Planner's `calculateExitPosition` can genuinely fail on it (via a low
  Target BTC Price forcing an oversized BTC sale). Confirmed by direct
  Engine source inspection before writing a single verification test, not
  discovered by trial and error against all three.
- **A stale local checkout is a real, encountered risk in a multi-session
  engagement, and the fix is exactly what the standing workflow already
  prescribes — fetch, compare, reset.** Twice during Milestone 7's final
  two batches, the local branch had fallen behind a since-merged
  `origin/main` (once by a full milestone's worth of commits after a
  worker restart). Both times, `git fetch` + `git checkout -B <branch>
origin/main` recovered cleanly with zero lost work, because nothing
  batch-specific was ever committed before verifying sync — the same
  "verify the local checkout matches current origin/main before making
  changes" first step every batch kickoff already names.

---

## 8. Recommendations for Milestone 8

1. **Milestone 8 (Persistence, Authentication, Cloud Synchronization &
   Import/Export) is the first milestone to touch a real persistence
   layer, Supabase, and authentication** — a different kind of work than
   Milestones 4–7's UI-over-existing-Engine pattern. Confirm the batch-
   grouping preference (Milestone 7's coarser 8-batch grouping vs.
   Milestones 5/6's one-task-per-batch density) before drafting an
   implementation plan.
2. **Re-read `docs/06_TASKS.md`'s Milestone 8 section fresh before
   implementing anything**, the same discipline every prior milestone's
   own completion report has recommended and every batch of this one
   followed.
3. **Conflict #21** (M3-013's "persistence adapters" mention has no
   Service or task to attach to) has been carried forward, unresolved,
   since Milestone 3 specifically because it has no home until Milestone
   8 — this is very likely the first conflict Milestone 8 will need to
   resolve directly, not merely re-cite.
4. **The three strategy Stores' own independence pattern
   (`loopBuilderStore`/`exitPlannerStore`/`recommendationCenterStore`
   never importing `portfolioStore` or each other) will need a deliberate
   decision once persistence exists**: does saved strategy/exit-plan/
   acknowledgement state persist alongside the portfolio it references,
   or independently? Neither `06_TASKS.md`'s Milestone 7 section nor its
   Milestone 8 section currently specifies this — worth resolving before
   the first persistence-layer task that touches any of these three
   Stores.
5. **Continue the established batch workflow** (verify sync via `git
fetch` before any change → read the milestone's own documentation
   fully → implement one documented batch → run the full validation
   pipeline including `pnpm test:e2e` and manual browser verification →
   architecture/traceability audit → document conflicts → stop for
   approval before committing → commit once with the exact approved
   message → attempt push → export a verified single-commit patch → wait
   for synchronization confirmation). This workflow caught every
   regression, false assumption, and both new conflicts recorded across
   this report.
