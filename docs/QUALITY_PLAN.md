# Version 1 Quality Plan

`06_TASKS.md` M9-001 ("Create Version 1 Quality Plan"). Dependencies:
Milestones 1–8 (all complete — see `PROJECT_STATUS.md`). Description:
"Create a formal quality plan for Version 1." Define: critical user
workflows, critical financial calculations, supported browsers, supported
viewport sizes, supported persistence modes, release-blocking defect
categories, test ownership, review responsibilities, sign-off
requirements. DoD: "The team has one documented standard for deciding
whether Version 1 is releasable."

This document is that standard. It does not re-verify anything itself —
`docs/DOD_COMPLIANCE_AUDIT.md` (M9-003) and
`docs/REQUIREMENTS_TRACEABILITY_MATRIX.md` (M9-002) do the verification;
this document defines what "done" and "releasable" mean so later
Milestone 9 batches (M9-005 through M9-064) have one shared standard to
work against, per M9-001's own dependency relationship (M9-002, M9-004,
and M9-015 all depend on M9-001).

**Milestone 8 local-only re-scope**: Cloud Database, Cloud Synchronization,
and Row-Level Security were cancelled by product decision during
Milestone 8 (`docs/MILESTONE_8_SCOPE_CHANGE.md`; `PROJECT_STATUS.md`
Conflict #34). Wherever this Quality Plan would otherwise define a gate
for cloud-dependent behavior, it is marked **N/A — removed by product
decision** rather than "deferred" or "incomplete." This treatment is
final, not pending, and applies identically throughout every later
Milestone 9 batch.

---

## 1. Critical user workflows

`06_TASKS.md` M9-015 ("Define Critical End-to-End Workflows," itself
dependent on this task) names the authoritative candidate list. This plan
adopts that list now as the working set of release-blocking workflows so
that M9-002 through M9-004 have something concrete to reference; M9-015
(Batch 4) still owns finalizing it and attaching an automated test or
approved manual procedure to each item, per its own Definition of Done.

| # | Workflow | Cloud dependency | Status here |
|---|---|---|---|
| 1 | Create first portfolio | None | Active |
| 2 | Edit collateral and debt | None | Active |
| 3 | Review Dashboard risk | None | Active |
| 4 | Run simulation | None | Active |
| 5 | Compare scenarios | None | Active |
| 6 | Build loop strategy | None | Active |
| 7 | Stress-test loop | None | Active |
| 8 | Create exit plan | None | Active |
| 9 | Review recommendation | None | Active |
| 10 | Save and reload work | None | Active |
| 11 | Export and import backup | None | Active |
| 12 | Use application offline | None (local-only persistence is always offline-capable) | Active |
| 13 | Sign in and synchronize | Cloud sync | **N/A — removed by product decision** (sign-in itself is retained and active; "…and synchronize" is not) |
| 14 | Resolve data conflict | Cloud sync | **N/A — removed by product decision** |

Every existing `tests/e2e/*.spec.ts` file already exercises workflows
1–11 in some form (`portfolioWorkflows.spec.ts`, `simulationWorkflows.spec.ts`,
`loopBuilderWorkflows.spec.ts`, `exitPlannerWorkflows.spec.ts`,
`recommendationWorkflows.spec.ts`, `settingsWorkflows.spec.ts`,
`crossToolWorkflows.spec.ts`). Workflow 12 ("Use application offline") has
no dedicated e2e test today — this application never makes a network call
for its own persistence (local-only by construction), so "offline" is not
a distinguishable runtime mode the way it would be for a cloud-backed
app; M9-015/M9-045 should confirm this reasoning explicitly rather than
writing a test that cannot meaningfully fail. Workflow 13's non-cancelled
half ("Sign in") is covered by `authWorkflows.spec.ts`.

## 2. Critical financial calculations

A calculation is **critical** for this plan's purposes if an incorrect
result would (a) misstate a KPI, risk indicator, or recommendation shown
to the user, or (b) meet M9-004's own P0 definition ("incorrect critical
financial result"). Concretely, this is every Formula ID marked
`implemented` in `tests/fixtures/formulaCoverage.ts` (M2-029) — the
canonical, source-code-verified registry of all 69 Formula IDs from
`02_Formulas.md`, cross-checked against real source text by
`tests/unit/engine/formulaCoverage.test.ts` rather than trusted blindly.
As of this writing: 36 of 69 Formula IDs implemented, 33 explicitly
out of scope with a documented reason each (multi-asset, compound
interest, and other Version-2-scoped formulas — see Conflicts #5, #7,
#15). This Quality Plan does not duplicate that registry; M9-005 and
`docs/REQUIREMENTS_TRACEABILITY_MATRIX.md` reference it directly.

The highest-consequence subset — Health Factor, Liquidation Price/
Distance/Buffer, Loan-to-Value, Net Worth, Loop Strategy outputs, Exit
Position outputs, Simulation price/interest scenario outputs, and
Recommendation outputs — is additionally covered by
`tests/fixtures/goldenReferencePortfolios.ts` (independently
hand-calculated reference portfolios, M2-029/M9-006) and
`tests/unit/engine/criticalRiskBoundaryRegression.test.ts` (boundary/edge
regression). Financial-accuracy tolerance for all of the above is
`04_BUILD_GUIDE.md`'s per-type standard (0.01 USD, 0.00000001 BTC,
0.000001 Health Factor/percentage — see Conflict recorded in §7 below
regarding `01_PRD.md` REQ-011-B's separate flat 0.01% figure).

## 3. Supported browsers

`06_TASKS.md` M9-021 ("Perform Cross-Browser Testing") is the only place
in the entire documentation set (`01_PRD.md`, `03_UI.md`,
`04_BUILD_GUIDE.md` all searched — no browser list found anywhere else)
that names specific browsers: **"Recommended minimum: current Chrome,
current Firefox, current Safari, current Edge."** This plan adopts that
as the Version 1 supported-browser list.

**Current actual coverage**: `playwright.config.ts` runs exactly one
project, Chromium (via the sandbox's pre-installed
`/opt/pw-browsers/chromium`), so only Chrome/Edge-equivalent rendering is
automated today. Firefox and Safari are not automated anywhere in this
codebase. This is a real, named gap for M9-021 (Batch 4) to close, not a
finding this batch resolves — the codebase uses no browser-specific APIs
found in review (no vendor-prefixed CSS, no non-standard JS APIs), so
cross-browser risk is believed low, but "believed low" is not the same as
"verified," and M9-021's own DoD requires the latter.

## 4. Supported viewport sizes

`03_UI.md`'s "RESPONSIVE DESIGN" section (Page 10) qualitatively commits
to Desktop (primary, 1440px+ recommended), Laptop (supported), Tablet
(supported), and Mobile (essential features only) — without naming exact
breakpoints. The concrete pixel values already established and tested
throughout Milestones 5–7 (`tests/e2e/responsiveLayout.spec.ts`'s own
`VIEWPORTS` constant, matching Tailwind's `md:` breakpoint used
throughout `components/`/`features/`) are:

| Category | Width | Height |
|---|---|---|
| Mobile | 375px | 812px |
| Tablet (sidebar breakpoint) | 768px | 1024px |
| Desktop | 1280px | 900px |

This plan adopts these three as the supported/tested viewport sizes for
Version 1. They are an engineering convention derived from `03_UI.md`'s
qualitative categories, not a literal quote from any spec document —
recorded here explicitly rather than presented as directly sourced text.

## 5. Supported persistence modes

Two modes, both already implemented (Milestone 8, re-scoped local-only):

- **Local storage (default, always available)**: `services/persistence/`,
  browser `localStorage`, versioned and migrated
  (`STORAGE_SCHEMA_VERSION`), no account required. This is the only
  persistence mode Version 1 actually ships.
- **Authentication (optional, dormant)**: `services/auth/`, Supabase
  `GoTrueClient` — session/identity only. Signing in does not enable
  cloud storage of portfolio data; local data is preserved and remains
  the only copy either way (`tests/unit/stores/authLocalDataPreservation.test.ts`,
  M8-056).

**Cloud storage/synchronization as a persistence mode is N/A — removed by
product decision** (`docs/MILESTONE_8_SCOPE_CHANGE.md`). No Milestone 9
task should test, benchmark, or gate a release on cloud persistence
behavior.

## 6. Release-blocking defect categories

Full severity definitions and process live in
`docs/DEFECT_CLASSIFICATION.md` (M9-004) — this section states only the
release gate. **P0 and P1 defects block a Version 1 release** unless the
specific defect has an explicit, documented exception approved at
M9-064's sign-off. P2 defects require a documented workaround before
release; P3 defects do not block release. See
`docs/DEFECT_CLASSIFICATION.md` for the verbatim P0–P3 definitions
(reproduced from `06_TASKS.md` M9-004, not redefined here) and for
release-blocking rules, ownership, and evidence requirements in full.

## 7. Test categories and verification approach

Mirrors `06_TASKS.md`'s own eleven Milestone 9 sections directly — this
plan does not invent a separate taxonomy:

| Category | Batch | Automated / Manual | Canonical evidence today |
|---|---|---|---|
| Quality foundation | M9-001–004 | Manual (process/docs) | This document, RTM, DoD audit, defect classification |
| Formula/Engine correctness | M9-005–010 | Automated (unit) + manual (independent Golden Reference review) | `tests/unit/engine/**`, `formulaCoverage.ts`, `goldenReferencePortfolios.ts` |
| Service and Store correctness | M9-011–014 | Automated (unit/integration) | `tests/unit/services/**`, `tests/unit/stores/**` |
| Application workflows | M9-015–021 | Automated (e2e) + manual exploratory | `tests/e2e/*.spec.ts` (12 files) |
| Accessibility | M9-022–028 | Automated (axe-core) + manual (keyboard, screen reader) | `tests/e2e/accessibility.spec.ts` |
| Security | M9-029–036 | Manual review + automated dependency audit | `docs/SECURITY_REVIEW.md`, `pnpm audit` |
| Performance | M9-037–042 | Automated (benchmarks) + manual (production audit) | `tests/performance/engineBenchmarks.test.ts` |
| Reliability/error handling | M9-043–048 | Automated (failure-injection tests) + manual | Provider/persistence fallback tests, `docs/DISASTER_RECOVERY.md` |
| Observability | M9-049–052 | Manual configuration + review | Not yet built — see `docs/DOD_COMPLIANCE_AUDIT.md` |
| Documentation | M9-053–056 | Manual review | `docs/`, `PROJECT_STATUS.md` |
| Release readiness | M9-057–064 | Manual gate, composing all of the above | Not yet built |

**Financial verification tolerance conflict** (a new finding, not
previously recorded in `PROJECT_STATUS.md`'s conflict list — recorded
here as **new Conflict #35**, not silently assumed): `01_PRD.md`
REQ-011-B states a flat "0.01%" maximum error; `04_BUILD_GUIDE.md` states
per-type absolute tolerances (0.01 USD, 0.00000001 BTC, 0.000001 Health
Factor/percentage). This plan follows the Build Guide's per-type
standard, consistent with this engagement's established precedent
(`PROJECT_STATUS.md` Conflict #16, a related Build-Guide-vs-Formulas.md
performance-target disagreement resolved the same way) of treating the
Build Guide as the more implementation-precise document where the two
disagree. This batch does not resolve Conflict #35 — only records it and
states the working precedent this Quality Plan follows until a product
decision is made.

**Coverage target conflict** (a new finding, recorded as **new Conflict
#36** — not resolved by this batch): `01_PRD.md`'s "NON-FUNCTIONAL
REQUIREMENTS" section states a flat "Unit Test Coverage ≥95%" for "the
platform." Its own REQ-011 Acceptance Criteria states a narrower
"Financial calculations achieve at least 95% unit test coverage"
(Engine-scoped, not platform-wide — these two are not actually the same
claim, though both live in `01_PRD.md`). `04_BUILD_GUIDE.md`'s COVERAGE
TARGETS section gives tiered figures: Engine Statements ≥95%, Engine
Branches ≥90%, Services ≥85%, UI Components ≥70%. This plan follows the
Build Guide's tiered targets per layer, treating `01_PRD.md`'s flat
platform-wide figure as superseded by the more specific standard, the
same resolution this engagement applied previously. Current blended
`pnpm test:coverage` result (all layers combined, from the most recent
full run — see `docs/DOD_COMPLIANCE_AUDIT.md` for this batch's freshly
re-run number) is comfortably above every tier in aggregate; a genuine
per-layer breakdown confirming no individual module hides under the
blended average is M9-005/M9-011's own remaining work, not yet done.

**Simulation performance target conflict** (a new finding, recorded as
**new Conflict #37** — not resolved by this batch): `04_BUILD_GUIDE.md`
names "Simulation Update: less than 50 milliseconds" in its
Deployment-chapter PERFORMANCE TARGETS section, while `01_PRD.md` and
`03_UI.md` both name "Simulation Update: <100ms" in what reads as the
same UI-perceived metric — both are stated at the UI/deployment level,
not one Engine-level and one UI-level as might be hoped, so this is not
obviously reconcilable as two different measurements of two different
things. `04_BUILD_GUIDE.md`'s separate PERFORMANCE TESTS section's
"standard simulation: less than 50 milliseconds" is a distinct,
Engine-calculation-only benchmark (`tests/performance/engineBenchmarks.test.ts`
already targets this one). The Deployment-chapter figure needs an
explicit product decision or interpretation before M9-037/M9-042 can
honestly claim pass/fail against it — recorded here for that reason, not
decided.

## 8. Manual vs. automated verification

Automated where a deterministic pass/fail exists and repeated runs add
real value: formula/unit correctness, workflow regression, accessibility
scanning (axe-core), dependency auditing, performance benchmarking.
Manual where no automation shortcut exists and this engagement has
consistently treated it that way: independent Golden Reference
recalculation (M9-006 — a human/independent check against the *same*
formulas the automated suite already encodes has no value unless done by
a different method), screen reader review (M9-024), exploratory testing
(M9-060), and every batch's own pre-commit review-and-approval step
(established throughout this entire engagement, continued here).

## 9. Test ownership and review responsibilities

This is a single-implementer, AI-assisted engineering process (documented
throughout `PROJECT_STATUS.md`), not a multi-role team — ownership is
defined functionally, not by named individuals:

- **Automated test authorship and maintenance**: owned by whichever batch
  introduces or verifies the behavior under test, per this engagement's
  established one-batch-one-commit discipline. A later batch that finds a
  gap in an earlier batch's tests documents and closes it in its own
  commit (e.g., Batch 7 of Milestone 8 closing a gap M8-059 found in
  `ImportValidator.ts`), rather than reopening the earlier batch's
  history.
- **Implementation-time self-review**: every batch runs its own full
  validation pipeline (`pnpm typecheck && pnpm lint && pnpm format:check
  && pnpm test:coverage && pnpm build`, plus targeted `pnpm test:e2e`
  where the batch touches UI) and manually diffs every changed file
  before presenting it, per this engagement's standing workflow.
- **Stakeholder review and sign-off**: the project owner reviews and
  explicitly approves every batch before it is committed — no batch in
  this engagement's history has ever been committed without that
  approval, and Milestone 9 continues the same discipline. Final Version
  1 release sign-off is `06_TASKS.md` M9-064's own "Sign-off areas" list
  (Formula correctness, Product requirements, UI compliance,
  Accessibility, Security, Performance, Persistence, Import and export,
  Deployment, Documentation) — each area needs an approved status before
  Version 1 is releasable, per M9-064's own Definition of Done ("Each
  required area has a named reviewer and an approved status").

## 10. Sign-off requirements

Version 1 is releasable only when:

1. `docs/REQUIREMENTS_TRACEABILITY_MATRIX.md` shows every requirement
   Implemented, explicitly Deferred, or Rejected with documented
   approval (M9-002's own DoD) — cloud-cancelled items counted as
   Rejected-with-documented-approval (the Milestone 8 product decision
   itself is that documented approval).
2. `docs/DOD_COMPLIANCE_AUDIT.md` shows no completed task claiming a
   Definition of Done it does not actually satisfy (M9-003's own DoD).
3. No open P0 defect remains, and every open P1 has an explicit,
   documented release exception (`docs/DEFECT_CLASSIFICATION.md`,
   mirroring M9-064's Acceptance Criteria "No open P0 defect remains").
4. Every M9-064 sign-off area has a named reviewer and an approved
   status.
5. The project stakeholder gives explicit approval — the same standing
   requirement every batch in this engagement has already operated
   under, extended here to the release as a whole.

This Quality Plan itself does not certify any of the five items above —
that is Batches 2–11's and ultimately M9-057–064's work. It exists so
that work has one shared, written standard to satisfy.
