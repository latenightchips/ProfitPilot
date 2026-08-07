# Requirements Traceability Matrix

`06_TASKS.md` M9-002 ("Create Requirements Traceability Matrix").
Dependencies: M9-001. Description: "Map documented requirements to
implementation and tests." Include: PRD requirement, Formula ID where
applicable, UI requirement, Implementation module, Test location, Current
status, Known limitation. DoD: "Every Version 1 requirement is
implemented, deferred explicitly, or rejected with documented approval."

**Method**: every row below was checked against the actual repository —
implementation and test paths are only listed here if they were found to
exist and to genuinely address the requirement, not assumed from a
filename that sounds related. Status values used throughout:

- **Implemented** — built and tested.
- **Deferred (explicit)** — a real, buildable requirement not yet built,
  with a specific later Milestone 9 task that owns it.
- **Rejected — documented approval** — the requirement will not be built,
  by an explicit, already-recorded product decision. Every cloud-database/
  cloud-synchronization/Row-Level-Security requirement in this matrix uses
  this status, citing the Milestone 8 local-only re-scope decision
  (`docs/MILESTONE_8_SCOPE_CHANGE.md`; `PROJECT_STATUS.md` Conflict #34).
  This is a permanent classification, not "blocked" or "missing" — there
  is no future batch that will revisit it.
- **Out of scope (documented)** — a real, pre-existing Version-1-scope
  exclusion from Milestone 2 (multi-asset, compound interest, and other
  Formula IDs never intended for Version 1 — Conflicts #5, #7, #15), not
  a Milestone 9 finding.

This document does not re-derive formula-level coverage from scratch —
`tests/fixtures/formulaCoverage.ts` (M2-029) is the canonical registry for
all 69 `02_Formulas.md` Formula IDs, cross-validated against real source
text by `tests/unit/engine/formulaCoverage.test.ts`. §2 below summarizes
and references it rather than duplicating its 69 rows here, per this
task's own "reuse before creation" instruction.

---

## 1. PRD requirements (`01_PRD.md`, REQ-001 through REQ-017)

`01_PRD.md` organizes its requirements as 17 top-level functional areas
(REQ-001–REQ-017), each with lettered sub-requirements (97 IDs total).
This matrix tracks at the REQ-0XX level — the granularity every other
project document (`PROJECT_STATUS.md`, `docs/SECURITY_REVIEW.md`) already
uses — noting sub-requirement detail in the Known limitation column where
a specific sub-item has its own distinct status.

| PRD requirement | UI requirement (`03_UI.md`) | Implementation module | Test location | Status | Known limitation |
|---|---|---|---|---|---|
| REQ-001 Dashboard Functional Specification | Page 3 — Dashboard | `app/page.tsx`, `features/dashboard/**`, `components/dashboard/**` | `tests/unit/features/dashboard/**`, `tests/integration/dashboard/dashboardWorkflows.test.ts`, `tests/e2e/dashboardWorkflows.spec.ts`, `tests/e2e/accessibility.spec.ts` (Dashboard states) | Implemented | Conflict #30: `03_UI.md`'s own Page 3 mockup (Market Snapshot, Portfolio Score, Position Timeline chart) was never built; `06_TASKS.md`'s own M5-001–M5-024 task list was followed instead and is authoritative per this engagement's established precedent. |
| REQ-002 Mathematical Engine Specification | N/A (Engine has no UI of its own) | `engine/**` | `tests/unit/engine/**` (56 files), `tests/fixtures/formulaCoverage.ts`, `tests/fixtures/goldenReferencePortfolios.ts`, `tests/performance/engineBenchmarks.test.ts` | Implemented (Version 1 scope) | 33 of 69 Formula IDs out of scope by documented decision — see §2. |
| REQ-003 Portfolio & Financial Data Model | Page 4 — Portfolio | `types/portfolio*.ts`, `services/persistence/schemas/portfolio.schema.ts`, `features/portfolio/**` | `tests/unit/types/**`, `tests/unit/services/persistence/**`, `tests/integration/portfolio/**`, `tests/e2e/portfolioWorkflows.spec.ts` | Implemented | Single-position model only (Conflict A — one collateral position, one debt position per portfolio, not arrays); documented, not a gap. |
| REQ-004 Simulation Engine Specification | Page 5 — Simulation | `engine/simulation/**`, `features/simulation/**` | `tests/unit/engine/simulation/**`, `tests/e2e/simulationWorkflows.spec.ts` | Implemented | Simulation Update performance target has two disagreeing figures — see `docs/QUALITY_PLAN.md` §7. |
| REQ-005 Risk Engine Specification | Dashboard/Portfolio risk panels (Pages 3–4) | `engine/health/**`, `engine/liquidation/**` | `tests/unit/engine/health/**`, `tests/unit/engine/liquidation/**`, `tests/unit/engine/criticalRiskBoundaryRegression.test.ts` | Implemented | F-026 (Health Factor status-band classification, Conflict #1) remains a documented open specification gap, resolved conservatively, not blocking. |
| REQ-006 Recommendation Engine Specification | Page 5 area (Conflict #31/#33 — no dedicated page exists) | `engine/recommendation/**`, `features/recommendation/**` | `tests/unit/engine/recommendation/**`, `tests/e2e/recommendationWorkflows.spec.ts` | Implemented (partial, documented) | F-061–F-064 implemented; F-060, F-065–F-069 not (Conflict #9). Conflicts #31/#33: no `03_UI.md` page or sidebar entry was ever defined for this feature — resolved by building it per `06_TASKS.md`'s own task list. |
| REQ-007 Exit Strategy Engine Specification | Page 7 — Exit Planner | `engine/exit/**`, `features/exitPlanner/**` | `tests/unit/engine/exit/**`, `tests/e2e/exitPlannerWorkflows.spec.ts` | Implemented | F-040's exit-collateral-sale approximation is a known, tested, documented simplification (Conflict #13). |
| REQ-008 User Interface Architecture | Page 2 — Application Layout | `components/layout/**` (`AppShell`, `AppHeader`, `AppSidebar`) | `tests/e2e/navigation.spec.ts`, `tests/e2e/responsiveLayout.spec.ts` | Implemented | No mobile sidebar replacement below `md:` breakpoint — found and documented (not built) in Milestone 5 Batch 12. |
| REQ-009 Application State Management | N/A (architecture requirement, not a page) | `stores/**` (Zustand) | `tests/unit/stores/**` | Implemented | — |
| REQ-010 Backend, API & Infrastructure Architecture | Settings/provider-status surfaces | `services/market/**`, `services/protocol/**`, `services/persistence/**`, `services/auth/**` | `tests/unit/services/**` | Implemented (local-only scope) | "PRICING PROVIDER" (REQ-010) supported-asset list is honored in `types/portfolio.schema.ts`. Cloud Database/Cloud Synchronization sub-requirements: **Rejected — documented approval** (`docs/MILESTONE_8_SCOPE_CHANGE.md`). |
| REQ-011 Testing Strategy & Quality Assurance | N/A | `tests/**`, `.github/workflows/ci.yml` | This entire Milestone 9 effort | Partially implemented | This is what Milestone 9 as a whole verifies — see `docs/DOD_COMPLIANCE_AUDIT.md`. Coverage-target and financial-tolerance figures conflict across documents — see `docs/QUALITY_PLAN.md` §7 (not resolved by this batch). CI does not currently run `pnpm test:e2e` — a real, open gap (M9-016/017/021's own continuity). |
| REQ-012 Security, Privacy & Trust Architecture | N/A | `services/shared/sensitiveFields.ts`, `services/shared/sanitizeText.ts`, `utils/env.ts` | `docs/SECURITY_REVIEW.md`, associated unit tests | Implemented (local-only scope) | Row-Level Security sub-requirement: **Rejected — documented approval**. Full re-audit (dependency scan re-run, security headers, threat model) is M9-029–036's own remaining work — see `docs/DOD_COMPLIANCE_AUDIT.md` for the fresh dependency-audit numbers this batch captured. |
| REQ-013 Deployment, DevOps & Release Architecture | N/A | `.github/workflows/ci.yml`, `next.config.ts`, `package.json` scripts | CI pipeline itself | Partially implemented | "Cloud synchronization functions correctly" (Version 1 DoD, `04_BUILD_GUIDE.md`) and "Row Level Security enabled" (Security Checklist) are **Rejected — documented approval**. No security headers configured (real gap, M9-035). No deployment has occurred (M1-009 explicitly deferred, unchanged). |
| REQ-014 AI Development Framework | N/A (process document, not a runtime feature) | `docs/05_AI_PROMPTS.md` (the document itself) | N/A — this is the process this entire engagement has followed, not a testable code path | Implemented (as a process) | Not applicable to code-level test coverage by its own nature. |
| REQ-015 Roadmap & Product Evolution | N/A | N/A (describes Version 2+ scope) | N/A | Out of scope (documented) | Version 1 does not implement Version 2 roadmap items by definition; this REQ is a forward-looking document section, not a Version 1 build requirement. |
| REQ-016 Project Governance & Documentation Standards | N/A | `PROJECT_STATUS.md`, `CONTRIBUTING.md`, `docs/CODING_STYLE.md`, `docs/TERMINOLOGY.md` | N/A (documentation, self-evidencing) | Implemented | — |
| REQ-017 Project Conclusion, Definition of Done & Definition of Excellence | N/A | N/A (this is the release gate itself) | `docs/DOD_COMPLIANCE_AUDIT.md`, `docs/DEFECT_CLASSIFICATION.md`, M9-057–064 (not yet built) | Deferred (explicit) | This is Milestone 9's own final gate — cannot be "implemented" before the milestone that verifies it completes. |

## 2. Formula IDs (`02_Formulas.md`)

Canonical source: `tests/fixtures/formulaCoverage.ts`, cross-validated by
`tests/unit/engine/formulaCoverage.test.ts` (scans real Engine source
text rather than trusting the registry's own claims). This matrix is not
a second source of truth for the 69 individual Formula IDs — it points to
that one.

| Metric | Value | Evidence |
|---|---|---|
| Total Formula IDs (`02_Formulas.md`) | 69 | `tests/fixtures/formulaCoverage.ts` |
| Implemented | 36 | Each with a documented Engine module and test file in the registry |
| Explicitly out of scope | 33 | Each with a documented reason in the registry (multi-asset, compound interest, Version-2-scoped — Conflicts #5, #7, #15) |
| Registry self-check | Passing | `tests/unit/engine/formulaCoverage.test.ts` — 214/214 unit test files pass overall (see `docs/DOD_COMPLIANCE_AUDIT.md` for the fresh run this batch performed) |

Independent Golden Reference verification of the 36 implemented formulas'
correctness (not just their existence) is `tests/fixtures/goldenReferencePortfolios.ts`
plus `tests/unit/engine/goldenReferencePortfolios.test.ts` — a genuinely
independent recalculation pass is M9-006's own remaining work (Batch 2),
not yet performed at that level of rigor.

## 3. UI requirements (`03_UI.md`, 10-page index)

| Page | Title | Implementation | Test location | Status |
|---|---|---|---|---|
| 1 | Design Philosophy | Design tokens, `styles/**`, Tailwind config | N/A (design philosophy is not independently testable) | Implemented |
| 2 | Application Layout | `components/layout/**` | `tests/e2e/navigation.spec.ts`, `tests/e2e/responsiveLayout.spec.ts` | Implemented |
| 3 | Dashboard | `app/page.tsx`, `features/dashboard/**` | `tests/e2e/dashboardWorkflows.spec.ts`, `tests/e2e/accessibility.spec.ts` | Implemented (Conflict #30 — see §1) |
| 4 | Portfolio | `app/portfolio/**`, `app/portfolios/**` | `tests/e2e/portfolioWorkflows.spec.ts` | Implemented |
| 5 | Simulation | `app/simulation/page.tsx`, `features/simulation/**` | `tests/e2e/simulationWorkflows.spec.ts` | Implemented |
| 6 | Loop Builder | `app/loop-builder/page.tsx`, `features/loopBuilder/**` | `tests/e2e/loopBuilderWorkflows.spec.ts` | Implemented (Conflict #32 — Auto Loop Engine design vs. built manual-`maxLoops` task, resolved per `06_TASKS.md`) |
| 7 | Exit Planner | `app/exit-planner/page.tsx`, `features/exitPlanner/**` | `tests/e2e/exitPlannerWorkflows.spec.ts` | Implemented |
| 8 | Settings | `app/settings/page.tsx` | `tests/e2e/settingsWorkflows.spec.ts` | Implemented |
| 9 | Design System | `components/ui/**`, Tailwind theme config | N/A (design tokens, not a page-level workflow) | Implemented |
| 10 | Responsive Design, User Flows & Final UI Validation | Cross-cutting — no single module | `tests/e2e/responsiveLayout.spec.ts`, `tests/e2e/accessibility.spec.ts` | Partially implemented — accessibility scans do not yet cover `/settings`, `/sign-in`, `/sign-up`, `/reset-password`, `/portfolios`, `/portfolio` (real gap, M9-022, Batch 5) |

**Recommendation Center** has no page of its own in `03_UI.md`'s 10-page
index (Conflict #33) — implemented at `app/recommendations/page.tsx`
regardless, per `06_TASKS.md`'s own task list, the same resolution
Conflicts #30/#31/#32 already established.

## 4. Cloud-dependent requirements — explicit disposition

Every requirement below is **Rejected — documented approval**, citing the
Milestone 8 local-only product decision. Listed together here so the
cloud-cancellation resolution is visible in one place, in addition to
being noted against each individual row above:

| Source | Requirement text | Disposition |
|---|---|---|
| `06_TASKS.md` Milestone 8 Acceptance Criteria | "Cloud data is protected by Row-Level Security." | Rejected — documented approval |
| `06_TASKS.md` Milestone 8 Acceptance Criteria | "Synchronization supports offline work." / "Conflicts are never resolved silently." | Rejected — documented approval (the Synchronization Model, M8-026, is retained as generic domain infrastructure — `services/persistence/syncMetadataModel.ts` — but nothing calls it against a cloud backend) |
| `06_TASKS.md` Milestone 9 Acceptance Criteria | "Row-Level Security is verified." | Rejected — documented approval |
| `06_TASKS.md` Milestone 9 Definition of Done | "Safe optional cloud synchronization." | Rejected — documented approval |
| `04_BUILD_GUIDE.md` Version 1 Definition of Done | "Cloud synchronization functions correctly." | Rejected — documented approval |
| `04_BUILD_GUIDE.md` Security Checklist | "Row Level Security enabled." | Rejected — documented approval |
| `06_TASKS.md` M9-031 (Authentication and Authorization Audit) | Depends on cancelled M8-057 (Row-Level Security Tests) | Rejected — documented approval for the RLS-dependent portion; the local-scope portion (session expiration, password reset, sign-out) remains active and is `docs/SECURITY_REVIEW.md`'s own M8-053 scope |
| `06_TASKS.md` M9-041 (Persistence and Synchronization Performance) | Depends on cancelled M8-030 (Incremental Cloud Sync) | Rejected — documented approval for the sync-specific portion; local debounced-write/migration/export/import performance remains active and is real, unbenchmarked M9-041 scope |
| `06_TASKS.md` M9-046 (Provider Failure Recovery) | Depends on cancelled M8-058 (Synchronization Tests) | Rejected — documented approval for the sync-specific portion; provider (market/protocol) failure recovery remains active, existing scope |
| `06_TASKS.md` M9-047 (Network Interruption Testing) | Names "Synchronization," "Cloud save" among its test list | Rejected — documented approval for those two items; "Authentication" and "Password reset" (also named) remain active, valid test scope |

None of the above is described as "blocked," "deferred," or "missing" —
each is a permanent, already-approved product decision recorded in
`docs/MILESTONE_8_SCOPE_CHANGE.md` and `PROJECT_STATUS.md` Conflict #34.
