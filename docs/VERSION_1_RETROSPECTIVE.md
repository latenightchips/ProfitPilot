# Version 1 Retrospective

`06_TASKS.md` M10-021 ("Conduct Version 1 Retrospective") — Milestone 10
Batch 5. Dependencies: M10-006 ("Deploy Version 1"). Description:
"Review architecture, documentation, development workflow, testing,
deployment, lessons learned." DoD: "Improvement opportunities are
documented."

**Dependency note, not silently resolved**: this task's formal
dependency, M10-006 ("Deploy Version 1," DoD "Version 1 is available in
production"), **is not complete and is not being represented as
complete here**. M10-006 remains classified exactly as it was at the
start of Milestone 10: **"Deferred by explicit product/release decision
— no operated production deployment exists for Version 1.0.0"** — no
Vercel/Supabase/Sentry project has been created, no production traffic,
uptime, incident, or monitoring history exists or is claimed anywhere
in this document. This is a pre-existing, already-approved decision
(the Path B deployment decision made before Milestone 10 began;
`docs/RELEASE_NOTES.md`, `docs/PRODUCTION_READINESS.md`), not a new
one. Under that approved disposition, the "Deployment" review area
below covers deployment *readiness* and the Path B *decision itself* —
including what local production-mode validation
(`docs/PRODUCTION_READINESS.md`) actually established — not an operated
instance that does not exist and is not being retrospectively invented.

This document consolidates evidence already scattered across
`PROJECT_STATUS.md` (15,000+ lines covering 10 milestones), rather than
rediscovering it — every item below cites where its underlying evidence
already lives.

## Architecture

**What worked**: the one-way dependency direction (`Presentation →
Features → Services → Engine → Infrastructure`, `CONTRIBUTING.md`'s
"Project structure") held for all ten milestones with no reported
violation — the Formula Engine (`engine/`) never gained a React,
Next.js, or persistence dependency, which made the entire financial
core independently unit-testable and let `docs/DEFECT_CLASSIFICATION.md`'s
own release-blocking rule ("fix at the Engine layer only, never patch a
wrong result downstream") actually be enforceable rather than aspirational.
The Service layer's `Result<T>` pattern and `ApplicationError` model
(Milestone 3) gave every later layer a single, consistent failure
shape, which is why Milestone 9's reliability work (error boundaries,
`docs/DISASTER_RECOVERY.md`) could be added without restructuring
anything underneath it.

**Improvement opportunity**: `04_BUILD_GUIDE.md`'s own stated aspiration
that the Engine "remain... portable enough to be published as its own
package" has never been acted on — `ENGINE_VERSION` still moves in
lockstep with the application version because the Engine ships inside
this repository, not as a separate package (`docs/VERSIONING_STRATEGY.md`'s
own "four independent axes" table). Tracked as technical debt below
(M10-022), not fixed here — no behavior changes, no test changes, this
is an audit-only observation.

## Documentation

**What worked**: the frozen-specification/living-documentation split
(`CONTRIBUTING.md`'s "Specification documents" section,
`.prettierignore`'s own exclusion) protected the original `01_PRD.md`/
`02_Formulas.md`/`03_UI.md`/`04_BUILD_GUIDE.md`/`05_AI_PROMPTS.md`/
`06_TASKS.md` from ten milestones of incremental edits that would have
made "what did the spec originally say" unanswerable. Every drift
between the frozen spec and what was actually buildable was instead
recorded as a numbered conflict in `PROJECT_STATUS.md` (39 recorded to
date) rather than silently resolved — this is why Conflict #1 (Health
Factor risk-band disagreement across four documents) can still be
traced back to its exact source four documents later, and why Conflict
#38/#39 (found in Milestone 10 itself) could be recorded without
touching frozen text.

**Improvement opportunity**: the specification set's own internal
consistency was never verified before implementation began — Conflict
#38 (found in Milestone 10 Batch 1) shows `01_PRD.md` disagreeing with
its own header/footer on the specification's own `Version` field, and
`README.md`/`01_PRD.md`'s header are outliers against the other five
spec documents. A pre-implementation specification-consistency pass
(exactly what `docs/06_TASKS.md` M10-016, "Review Documentation Set,"
did retroactively in Milestone 10 Batch 3) would have caught this
before Milestone 1 rather than in Milestone 10. `PROJECT_STATUS.md`
itself has also grown to a size (15,000+ lines) that makes it
increasingly costly to navigate — see M10-024 below for the archival
response to this specific observation.

## Development workflow

**What worked**: batch-sized implementation (one task cluster per
batch, full validation before every commit, an explicit pre-commit
review before every batch in Milestone 9–10) caught real, live defects
before they reached `origin/main` — see "Lessons learned" below for
three specific examples. The patch-based application model (this
development process has never had direct push access; every change is
reviewed, then applied by the repository owner) meant every single
change that reached `main` had already passed the full validation
pipeline and an explicit review, with zero exceptions across ten
milestones.

**Improvement opportunity, stated plainly**: this development process's
own git checkout has reverted to a stale commit multiple times across
this engagement — most severely once mid-Milestone-9-Batch-11 (full
uncommitted content loss, requiring the entire batch to be reconstructed
from memory and fully re-validated), and again at the start of this
very batch (Milestone 10 Batch 5), where `HEAD` was found 5 commits
behind `origin/main` with stale, already-superseded uncommitted changes
in the working tree. Both were fully recovered without data loss only
because of a standing diagnostic protocol (prove content is byte-
identical to an already-merged commit via `git diff` before discarding
anything) — this protocol itself is the direct lesson learned from the
first occurrence, and it is why the second occurrence (this batch) cost
a diagnosis, not a reconstruction. Environment/checkout hygiene between
sessions remains a real, recurring friction point for this development
model, not a one-time incident.

## Testing

**What worked**: 2,123 unit tests and 151 Playwright end-to-end tests
(43 of them accessibility-specific) passed at Version 1.0.0 Quality
Sign-Off with zero P0/P1 defects (`docs/DEFECT_CLASSIFICATION.md` §6).
The Golden Reference Portfolio suite (independently derived via Python
`decimal`, not this codebase's own arithmetic) made financial-formula
regressions bisectable rather than merely detectable — exactly the
mechanism `docs/INCIDENT_RESPONSE.md`'s "Incorrect financial output"
section relies on today.

**Improvement opportunity**: CI (`.github/workflows/ci.yml`) does not
run the Playwright suite automatically — a known, documented,
non-blocking P2 (`docs/DEFECT_CLASSIFICATION.md` §6,
`docs/KNOWN_ISSUES.md` category C) carried since Milestone 9 Batch 11
and still open today. Firefox/Safari have no automated coverage in this
development environment (no WebKit/Firefox binary available) — mitigated
by `docs/CROSS_BROWSER_REVIEW.md`'s code-level review, not automated
testing.

## Deployment

Per the dependency note above, this reviews the deployment *decision*,
not an operated deployment. **What worked**: `docs/PRODUCTION_READINESS.md`
verified every repository-controlled readiness component (environment
variables, security headers, caching, build configuration) against a
real local production build/server — genuine, real evidence, not
assumed. The explicit Path B decision (no Vercel/Supabase/Sentry
project created, no production traffic invented) kept every later
document in Milestone 10 honest about what actually exists versus what
is deferred, rather than blurring the two.

**Improvement opportunity**: because no operated deployment exists, the
one thing this retrospective genuinely cannot evaluate is real-world
production behavior (actual latency under a real network, actual
storage-quota behavior across real user devices, actual Sentry
capture volume) — this is not a gap in the review, it is an accurate
statement of what a self-hostable Version 1.0.0 release without an
owned production instance can and cannot tell you yet.

## Lessons learned

Three concrete, real defects found and fixed during this engagement,
each illustrating a distinct process lesson:

1. **Cross-portfolio state contamination** (Milestone 9 Batch 3,
   M9-011–014): the Simulation/Loop Builder/Exit Planner Stores never
   cleared their unsaved working state when the active portfolio
   changed. Lesson: a Service/Store-layer bug can hide behind
   per-Store unit tests that never exercise a portfolio switch —
   multi-Store integration testing through the real
   `PersistenceProvider` mount path (not per-Store in isolation) is
   what actually caught it.
2. **Dashboard Quick Actions silently hardcoded unavailable**
   (Milestone 9 Batch 4, M9-015–021): "Run simulation"/"Build loop
   strategy"/"Create exit plan" had been hardcoded unavailable since
   Milestone 5 and never revisited once Milestones 6/7 shipped those
   routes for real — the only mobile-reachable path to them, since the
   sidebar has no mobile equivalent. Lesson: a "not yet built" comment
   left in shipped code after the referenced feature *is* built is a
   real, live defect, not a stale comment — nothing re-verified it
   after the dependency changed.
3. **Liquidation-price estimate-labeling inconsistency** (Milestone 9
   Batch 10, M9-055/M9-056): the Dashboard KPI Grid and the Liquidation
   Risk Panel disagreed on whether to label the identical F-024 figure
   as an estimate. Lesson: the same calculated value rendered in two
   components is a genuine cross-component consistency risk, not
   redundant work — a financial-disclosure audit needs to check every
   rendering location of a value, not just one.

A fourth, process-level lesson is recorded under "Development workflow"
above (the recurring stale-checkout issue) rather than repeated here.

**Additional process-level lessons**, each grounded in a specific,
real, already-recorded event rather than an invented team or process
metric:

- **Audit-first implementation prevented unnecessary churn.** Milestone
  10 Batch 3 (M10-017/M10-018) found `CONTRIBUTING.md` and
  `docs/USER_GUIDE.md` already satisfied their own Definition of Done
  before writing anything new; Batch 5's own M10-024 found Version 1
  planning archival already substantially satisfied for the same
  reason. In both cases, auditing first meant no new content was
  manufactured to "fill" a batch that had no genuine gap to fill.
- **A measured optimization regression was caught and reverted before
  it shipped.** Milestone 9 Batch 9 (Observability) found a real,
  measured ~76 kB bundle-size regression from a first, static-import
  implementation of the Sentry SDK — caught by measurement, not
  assumption, and fixed (switched to a dynamic import) before that
  batch's own commit, per `docs/OBSERVABILITY.md`'s own "bundle-size
  fix" section.
- **A documentation/task-ID mismatch demonstrated that `docs/06_TASKS.md`
  must remain the canonical source, not a planning summary.** Milestone
  10 Batch 3's own instructions described M10-017/M10-018 as a
  licensing audit and a legal/disclosure audit; re-reading
  `docs/06_TASKS.md` directly found those IDs actually name "Publish
  Developer Documentation" and "Publish User Documentation" — an
  unrelated pair of tasks. The mismatch was reported and resolved
  before any file was touched, rather than silently implementing either
  the assumed or the literal scope. The same discipline (re-reading
  `docs/06_TASKS.md` directly before trusting an earlier planning
  description) is what caught the real M10-021→M10-006 dependency this
  document itself discloses above.
- **Local-first scope decisions reduced unnecessary infrastructure
  work.** The Milestone 8 re-scope to local-only persistence
  (`docs/MILESTONE_8_SCOPE_CHANGE.md`, cancelling Cloud Database/Cloud
  Sync) and the Milestone 10 Path B deployment decision (no hosted
  deployment for Version 1.0.0) both meant later milestones never had
  to build, secure, or maintain external infrastructure this product
  does not actually need for its stated scope — `docs/PRODUCTION_READINESS.md`'s
  own repository-only readiness audit is a direct, positive consequence
  of the Path B decision, not a workaround for a missing capability.

**No new code, test, or configuration change was made to produce this
document** — it is a consolidation of already-recorded evidence, per
this task's own audit-first scope.
