# Milestone 5 Completion Report — Dashboard

Date: 2026-07-27
Status: **Complete.** All 28 documented tasks (M5-001 through M5-028) addressed per `docs/06_TASKS.md`; M5-008 formally, permanently blocked on Conflict #1 (no partial subset built).

This document is a permanent record of Milestone 5, maintained alongside
`PROJECT_STATUS.md` (which remains the live, continuously-updated tracker).
Unlike `PROJECT_STATUS.md`, this file is a fixed snapshot taken at the
milestone boundary and is not edited as later milestones proceed. It is not
part of the `docs/` specification set.

---

## 1. Completed Tasks

Implementation proceeded in 18 batches, one commit per batch, each validated
(typecheck, lint, format, full test suite, coverage, production build,
Playwright e2e, architecture/traceability audit) before commit.

| Batch | Tasks          | Scope                                                         | Commit    |
| ----- | -------------- | ------------------------------------------------------------- | --------- |
| 1     | M5-001–M5-003  | Dashboard route, feature structure, view model                | `3691bf4` |
| 2     | M5-004         | Dashboard Summary Header                                      | `b8af70d` |
| 3     | M5-005, M5-006 | Shared KPI Card, Core KPI Grid                                | `144d2b9` |
| 4     | M5-007, M5-009 | Health Factor Status Component, Liquidation Risk Panel        | `03c07d4` |
| 5     | M5-010–M5-012  | Risk Warning Banner, Portfolio Composition Section            | `b705e73` |
| 6     | M5-013, M5-014 | Debt and Interest Panel, Leverage Summary Section             | `1f2d8b9` |
| 7     | M5-015         | Recommendation Summary Section                                | `cc82058` |
| 8     | M5-017         | Data Freshness Indicators (resolving M5-018 with no new code) | `fac274a` |
| 9     | M5-019, M5-020 | Loading Skeleton, Dashboard Empty States                      | `7259b7e` |
| 10    | M5-021         | Dashboard Error Recovery                                      | `25fd748` |
| 11    | M5-016         | Dashboard Quick Actions                                       | `06788a3` |
| 12    | M5-023         | Dashboard Responsive Layout                                   | `57b2de1` |
| 13    | M5-024         | Complete Dashboard Accessibility Pass                         | `77743fe` |
| 14    | M5-022         | Dashboard Developer Mode                                      | `3bf9d9f` |
| 15    | M5-025         | Dashboard Component Tests                                     | `65cbbee` |
| 16    | M5-026         | Dashboard Integration Tests                                   | `af83638` |
| 17    | M5-027         | Dashboard End-to-End Tests                                    | `1bed60e` |
| 18    | M5-028         | Validate Dashboard Against UI Specification (final task)      | `c3e76b6` |

All 28 tasks are accounted for: 27 built (M5-001–M5-007, M5-009–M5-028),
1 formally blocked (M5-008, Health Factor risk classification — Conflict #1).

---

## 2. Architecture Decisions

- **Layering held with zero violations across all 18 batches.** Dashboard
  components read only through `DashboardViewModel`/section-specific builder
  functions (`buildHealthFactorStatus`, `buildLiquidationRiskPanel`, etc.),
  themselves reading only already-computed `PortfolioSummary`/`ServiceResult`
  output — never a new calculation. `git diff --stat -- engine/ services/
types/` was empty in every batch except the two that added new, narrowly-
  scoped Services (Batch 4's `calculateTargetHealthFactorActions`, Batch 6's
  `calculateDebtInterestBreakdown`), both composing already-public Engine
  functions rather than duplicating logic.
- **Conflict A / Conflict B held throughout** — the Dashboard reads the
  Store's existing single-position, in-memory-only `Portfolio` records,
  adding no new position model or persistence mechanism. Developer Mode
  (Batch 14) is itself in-memory only (`stores/developerModeStore.ts`),
  the same lightweight-Store pattern `portfolioStore.ts` established.
- **`DashboardViewModelBase` split (Batch 2)**: identity/freshness fields
  were found to be needed even when the deeper calculation fails (a
  calculation failure must still show which portfolio and price data are
  active) — restructured `DashboardViewModel` into a shared base plus an
  `ok`/`error` union, a pattern every later section (Error Banner, Data
  Freshness, Quick Actions) relies on.
- **Every "not yet buildable" gap was resolved by building a narrower, real
  capability, never an invented one.** Batch 4's Conflict #29
  (`calculateTargetHealthFactorActions` instead of the blocked
  `generateRecommendationSet`), Batch 8's M5-018 resolution (no live data
  provider exists in Manual Mode — `recomputeSummary` already satisfies its
  DoD with zero new code), and Batch 11's `NOT_YET_AVAILABLE` Quick Actions
  reason (Milestones 6/7 not reached) all follow this same discipline.
- **Accessibility was treated as a first-class, continuously-audited
  concern, not a one-time pass.** Batch 13 (M5-024) established WCAG AA via
  `@axe-core/playwright` and fixed the `tabIndex`-on-tooltip pattern for
  `KpiCard`; Batch 18 (M5-028) found and fixed the _same_ gap had never been
  applied to `HealthFactorStatusSection` (built in Batch 4, before the
  pattern existed) — a real, cross-batch consistency check the final audit
  task is specifically designed to catch.
- **The Testing phase (M5-025–M5-027) each targeted a distinct layer, not
  three redundant passes over the same ground**: component tests
  (Vitest + Testing Library, isolated props), integration tests
  (`tests/integration/dashboard/`, real Store + Service chains, no
  rendering — following `tests/integration/portfolio/`'s own M4-018
  precedent), and end-to-end tests (real Chromium, real navigation,
  reusing `tests/e2e/portfolioWorkflows.spec.ts`'s own conventions).

---

## 3. Resolved Documentation Conflicts

**None were resolved to closure during Milestone 5.** Conflict #20 (the one
conflict closed in the project to date) was resolved in Milestone 4, Batch 0,
before Milestone 5 began. Milestone 5 _raised_ two new conflicts (below) but
closed none.

---

## 4. Unresolved Documentation Conflicts

**29 conflicts remain open** (30 raised across the project to date, minus
#20). Full detail and exact wording live in `PROJECT_STATUS.md` under
"Unresolved documentation conflicts"; titles are reproduced here for the
permanent record.

### Carried forward from Milestones 2–4 (28 open, unaffected by Milestone 5)

1. Health Factor risk-band thresholds disagree across four documents —
   blocks Milestone 2 (Formula F-026/F-060) and **directly blocks M5-008**
   (the one wholly-unbuilt Milestone 5 task)
2. Two `04_BUILD_GUIDE.md` pages are referenced but missing content
3. `01_PRD.md` REQ-001–REQ-017 sequencing vs. version scope (v0.1–v1.0)
4. Minor / non-blocking items
5. Single-asset vs. multi-asset collateral/debt scope — resolved for
   Milestone 2 in favor of single-asset only
6. Health Factor display precision: 2 decimals vs. 3 decimals
7. Compound interest (M2-013/M2-014) has no documented formula
8. Swap fees / slippage / gas estimate have no documented formula anywhere
9. The Recommendation Engine formula chapter (F-060–F-069) has no task
   assignment anywhere in `06_TASKS.md`
10. "Target cash proceeds" (M2-024) has ambiguous mechanics, not just a
    missing formula
11. "Exit readiness" (M2-025) has no Formula ID anywhere in the
    Recommendation Engine chapter
12. F-067 "Simple Portfolio Score" documents weights but not the component
    formulas they weight
13. F-040 "Target Debt" does not account for collateral sold during an exit
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
    persistence Service or task exists anywhere in Milestone 3
21. M4-001 names "Settings" as a required Portfolio field with no defined
    shape
22. `03_UI.md`'s page inventory has no room for a "Portfolio List" page,
    which Milestone 4 requires
23. M4-005's "preset" protocol-parameter option has no documented preset
    values anywhere
24. M4-008 names "Price" and "Rate type" debt-position fields with no
    counterpart in the data model
25. M4-009's DoD requires confirmation for "risk-increasing" changes, a
    term never defined
26. M4-012 never says whether an archived portfolio remains independently
    selectable
27. M4-013 requires "auto-save," but M4-009 requires the opposite (explicit
    confirmation) for the same fields, and two of M4-013's four DoD save
    states are not honestly buildable in this architecture. Practically
    resolved by keeping M4-009's more specific, already-approved rule;
    the documentation conflict itself remains open.

### Raised during Milestone 5 (2 open)

29. `generateRecommendationSet`'s required `RecommendationRuleConfig` has no
    portfolio-level source for 5 of its 7 fields, and no documented
    defaults — found while implementing M5-007/M5-009 (Batch 4). Resolved
    _practically_ by building a narrower, real `calculateTargetHealthFactorActions`
    Service instead of inventing values; the documentation conflict (should
    `borrow`/`loop` recommendations ever be Dashboard-driven?) remains open
    for M5-015's own later scope, which itself resolved to the
    repayment/additionalCollateral subset only.
30. **`03_UI.md`'s own Page 3 ("Dashboard") describes an entirely different,
    never-built Dashboard design** (a Position Timeline chart, a Recent
    Activity log, a Portfolio Score, a Risk Category, a Market Snapshot with
    24-hour price change) that shares almost no vocabulary with
    `06_TASKS.md`'s own M5-001–M5-024 task list — the specification this
    entire milestone actually followed and built against. Found in Batch 18
    (M5-028), the final audit task. `06_TASKS.md` was treated as
    authoritative (its own M5-006 "Cards" list matches the built
    `DashboardKpiGrid` exactly, field for field; Page 3's own list does not
    match either document precisely). Not retrofitted — would require
    inventing an undocumented historical-data subsystem violating Conflict B
    and Conflict #7 simultaneously. **This is the largest single
    documentation/implementation gap found in the entire engagement to
    date** and awaits a product decision (rewrite Page 3, or mark it
    superseded).

**Most likely to affect Milestone 6 directly:** #1 (Health Factor
thresholds — still open, though Milestone 6's own task list does not appear
to require a risk-band classification the way M5-008 did) and a **new
version of #30's own risk**: `03_UI.md` Page 5 ("Simulation Workspace") was
read during Milestone 6's own pre-implementation review and also names a
"Portfolio Score" (`SECTION 2`) that `06_TASKS.md`'s own M6-009 "Scenario
Summary" Display list does not — the same superseded-mockup pattern Conflict
#30 already identified once. Not yet formally re-flagged as a distinct
conflict entry since M6-009 has not been implemented yet; watch for it
directly when that task is reached.

---

## 5. Validation Statistics

| Check                                    | Result                                   |
| ---------------------------------------- | ---------------------------------------- |
| `pnpm typecheck`                         | Pass                                     |
| `pnpm lint`                              | Pass                                     |
| `pnpm format:check`                      | Pass                                     |
| `pnpm test` (Vitest, unit + integration) | **1083 / 1083 passing** (118 test files) |
| `pnpm test:e2e` (Playwright, Chromium)   | **35 / 35 passing**                      |
| `pnpm build` (production)                | Pass                                     |

Both the Testing-phase DoDs (M5-025 "critical display states have automated
tests," M5-026 "Dashboard data remains consistent across state transitions,"
M5-027 "critical Dashboard workflows pass in supported viewport sizes") are
independently covered at three distinct layers: `tests/unit/features/dashboard/`
(component-level, isolated props), `tests/integration/dashboard/dashboardWorkflows.test.ts`
(Store/Service-level, no rendering, following the M4-018 precedent), and
`tests/e2e/dashboardWorkflows.spec.ts` (real Chromium browser, real
navigation, 3-viewport DoD check).

---

## 6. Coverage

Project-wide, `vitest.config.ts` scope:

| Metric     | Coverage           |
| ---------- | ------------------ |
| Statements | 95.58% (1733/1813) |
| Branches   | 89.41% (997/1115)  |
| Functions  | 100% (340/340)     |
| Lines      | 98.84% (1536/1554) |

---

## 7. Lessons Learned

- **A milestone's final "Validate Against UI Specification" task is not a
  formality — it can surface the single largest gap in the entire
  engagement.** Batch 18 (M5-028) was the first time `03_UI.md` was read in
  full, rather than only the specific sections already individually cited
  across 17 prior batches. That full read found Conflict #30. Sections of a
  large specification document that no task ever needed to cite directly
  can still silently diverge from what was actually built — a partial,
  citation-driven reading of a spec is not the same as having verified
  against it.
- **A concrete, field-by-field comparison is more convincing than a
  vocabulary mismatch alone.** Conflict #30 was confirmed, not just
  suspected, by checking one precise case: `06_TASKS.md`'s own M5-006
  "Cards" list matches the built `DashboardKpiGrid` exactly, while
  `03_UI.md` Page 3's own card list matches neither document precisely —
  proof Page 3 is a third, superseded variant, not evidence the build
  dropped a real requirement.
- **Fixing one accessibility gap is the right moment to check for
  identical, unfixed instances of the same gap elsewhere.** Adding
  Formula-ID tooltips to two previously-untooltipped panels (Batch 18)
  surfaced that `HealthFactorStatusSection`'s own pre-existing tooltip
  (built in Batch 4, before Batch 13's `KpiCard` fix existed) had the
  identical WCAG 2.1.1 keyboard-reachability gap, never independently
  caught. A fix pattern established once should be checked against every
  component built before that pattern existed, not assumed to already be
  universal.
- **Established precedent generalizes cleanly across milestones when
  followed literally.** `tests/integration/portfolio/portfolioWorkflows.test.ts`
  (M4-018) and `tests/e2e/portfolioWorkflows.spec.ts` (M4-018) were reused
  as exact structural templates for M5-026/M5-027's own new files —
  same helper shapes, same one-`describe`/`test`-per-`Cover`-item
  convention, same reasoning for why real, multi-step, non-mocked chains
  add signal beyond per-component unit tests. Batch 16/17 found their real
  bugs (a stale-navigation timeout, an ambiguous link/text match) through
  actually running the reused pattern, not by reasoning about it in the
  abstract.
- **A task whose dependency chain names only "Component Tests" can still
  turn out to be a pure audit with zero new production code** (Batch 15,
  M5-025) when every component already has incrementally-built test
  coverage from prior batches — the real work is checking named `Cover`
  items individually against what exists, not assuming "has tests" already
  satisfies a task with its own explicit list.

---

## 8. Recommendations for Milestone 6

1. **Re-read `docs/06_TASKS.md`'s Milestone 6 section fresh before
   implementing anything** — already done ahead of Batch 1, per the same
   discipline this report's own Section 7 recommends generalizing.
2. **The Simulation Engine and Service layer already exist from Milestones
   2–3** (`engine/simulation/`, `services/simulation/scenario.ts`,
   M2-019–M2-022, M3-009) — Milestone 6 tasks build the _Workspace UI and
   Store_ that consume `simulateScenario`, never a second calculation path.
   Confirm this before any M6 task that looks like it might need new Engine
   or Service code; it very likely already exists.
3. **Cross-check `03_UI.md` Page 5 ("Simulation Workspace") against
   `06_TASKS.md`'s own M6-xxx task list early, not only at M6-026** (the
   Milestone 6 equivalent of M5-028). Page 5 already shows the same
   superseded-mockup pattern Conflict #30 identified (a "Portfolio Score"
   card M6-009's own Display list does not name) — do not wait until the
   final audit task to discover this again at scale.
4. **`features/simulation/`'s own directory skeleton deliberately omits
   `state/` and `tests/`**, despite M6-002's own literal directory-tree
   text naming both (see Batch 1's own write-up in `PROJECT_STATUS.md` and
   `features/simulation/index.ts`'s own header comment for the full
   reasoning) — the Simulation Store belongs in the project's one
   top-level `stores/` directory; Simulation tests belong in the project's
   one top-level `tests/` directory. Keep following this for every later
   M6 batch, not just the first one.
5. **Continue the established batch workflow** (verify sync → read the
   milestone's own documentation fully → implement one documented batch →
   run the full validation pipeline including `pnpm test:e2e` →
   architecture/traceability audit → document conflicts → stop for approval
   before committing). This workflow caught every regression, false
   assumption, and the single largest documentation gap recorded across
   both this report and Milestone 4's own.
