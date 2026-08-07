# Release Defect Classification

`06_TASKS.md` M9-004 ("Create Release Defect Classification"). Dependencies:
M9-001. Description: "Define defect severity." DoD: "Every open defect
has a severity, owner, status, and release decision."

The four severity levels and their definitions below are reproduced
**verbatim** from `06_TASKS.md` M9-004 — this document does not redefine
or reinterpret them; it adds the release-blocking rules, ownership,
evidence, and disposition process the task's own DoD requires around
them.

---

## 1. Severity definitions (verbatim from `06_TASKS.md` M9-004)

| Severity | Definition |
|---|---|
| **P0** | Data loss, security breach, incorrect critical financial result, unusable application, or cross-user exposure. |
| **P1** | Major workflow failure, misleading high-risk output, inaccessible critical workflow, or persistent synchronization failure. |
| **P2** | Significant but recoverable defect with a documented workaround. |
| **P3** | Minor visual, wording, or low-impact usability issue. |

**Cloud-cancellation note on P1's own text**: "persistent synchronization
failure" as a P1 example presumes cloud synchronization exists. Since
Cloud Synchronization is cancelled by product decision
(`docs/MILESTONE_8_SCOPE_CHANGE.md`; `PROJECT_STATUS.md` Conflict #34),
this specific P1 example is **N/A — removed by product decision**, not a
deleted or reinterpreted severity level — P1 itself, and its other three
examples (major workflow failure, misleading high-risk output,
inaccessible critical workflow), remain fully in force. A defect in the
Synchronization Model's retained domain logic
(`services/persistence/syncMetadataModel.ts`, still generic
infrastructure) would still be classified under whichever of P1's other
examples actually applies, or under P0/P2/P3 as appropriate — it does not
become unclassifiable just because the cloud-specific example text is
N/A.

## 2. Release-blocking rules

| Severity | Blocks release? | Exception path |
|---|---|---|
| P0 | Always blocks | None. `06_TASKS.md` M9-064's own Acceptance Criteria requires "No open P0 defect remains" with no exception mechanism named anywhere in the specification. |
| P1 | Blocks by default | May ship only with an explicit, written release exception approved at M9-064 sign-off (mirroring `06_TASKS.md` M9-063's own "No unapproved P1 defect" requirement — the word "unapproved" implies an approval path exists for P1 specifically, unlike P0). |
| P2 | Does not block, if a documented workaround exists | If no workaround can be documented, treat as P1 for release purposes until one is written, per the severity's own definition ("recoverable defect with a documented workaround" — a P2 without a workaround does not meet its own definition). |
| P3 | Never blocks | Tracked for a future release; may be fixed opportunistically within Version 1 if trivial. |

This mirrors `06_TASKS.md` M9-063's ("Review Open Defects") own
Requirements directly: "No open P0 defect," "No unapproved P1 defect,"
"Every P2 and P3 defect has a documented decision," "Known limitations
are included in release notes where relevant" — this document defines
the classification those requirements are checked against; M9-063 itself
(Batch 11, not yet reached) is the task that actually performs that
review for the real defect backlog once one exists.

## 3. Worked examples, grounded in this codebase

Illustrative, not an exhaustive defect list — this batch introduces no
production-code changes and found no new defects requiring classification
(see `docs/DOD_COMPLIANCE_AUDIT.md` for what was found: real, but already
correctly-scoped, later-batch gaps, not currently-open defects in shipped
behavior).

| Example | Severity | Reasoning |
|---|---|---|
| `calculateHealthFactor` returns a wrong value for a valid, in-range portfolio | P0 | "Incorrect critical financial result" — the exact P0 example text. |
| A crafted import file executes injected script content in the browser | P0 | Not currently possible — no `dangerouslySetInnerHTML` anywhere in this codebase (confirmed during Milestone 8's own sanitization audit, M8-052) — but would be a security breach if it existed. |
| The Simulation Workspace throws an unhandled exception and shows Next.js's raw default error screen instead of a recoverable in-app error state | P1 | "Major workflow failure" — and directly what M9-043's missing error boundary (`docs/DOD_COMPLIANCE_AUDIT.md` §2) would leave uncaught today, a real, currently-latent P1-shaped gap. |
| A screen reader user cannot complete "Create first portfolio" (`docs/QUALITY_PLAN.md` §1, workflow 1) because a required form field has no accessible label | P1 | "Inaccessible critical workflow." |
| The CSV export omits a column present in the JSON export, but the JSON export (already fully correct) remains a usable workaround | P2 | "Significant but recoverable... with a documented workaround." |
| A KPI card's tooltip text has a typo | P3 | "Minor... wording... issue." |

## 4. Ownership and disposition process

Same single-implementer, functionally-defined ownership model as
`docs/QUALITY_PLAN.md` §9 (this is not a multi-role team):

1. **Discovery**: any defect found during implementation, review, or
   testing (this engagement's own established pattern — e.g., Milestone 8
   Batch 7 finding `ImportValidator.ts`'s unassigned
   `UNSUPPORTED_SCHEMA_VERSION` code while writing an unrelated test) is
   recorded at the point it is found, with severity assigned immediately
   using §1's definitions.
2. **Owner**: the batch/task currently active when the defect is found
   owns triage. A P0/P1 found mid-batch is fixed within that same batch
   before proceeding, per this engagement's standing practice of not
   shipping a batch with a known critical defect in its own scope. A
   defect found outside the current batch's own scope (e.g., a
   pre-existing gap noticed while working on something else) is
   documented for the batch that actually owns that area, not fixed
   opportunistically outside scope — mirroring this batch's own
   "architecture/scope rules" instruction to document out-of-scope
   findings for their correct later batch rather than act on them early.
3. **Status**: Open → In progress → Resolved, or Open → Accepted
   (P2/P3 only, with a documented reason) → Won't Fix. A P0 or P1 cannot
   reach "Accepted" without the explicit release-exception approval §2
   describes.
4. **Evidence expected before "Resolved"**: a failing test that
   reproduces the defect, now passing; for defects with no automated
   reproduction path (e.g., a manual accessibility finding), a written
   description of the manual verification performed instead — the same
   evidence standard `docs/QUALITY_PLAN.md` §8 already sets for
   manual-vs-automated verification generally.
5. **Regression protection**: `04_BUILD_GUIDE.md`'s own REQ-011
   Acceptance Criteria requires "Regression tests exist for every
   resolved defect" — a defect fix without a regression test is not
   considered Resolved under this classification.

## 5. Interaction with final release sign-off

`06_TASKS.md` M9-063 ("Review Open Defects") and M9-064 ("Complete
Version 1 Quality Sign-Off") are the two tasks that consume this
classification at release time:

- M9-063's own Requirements map directly onto §2's release-blocking
  rules: zero open P0, zero unapproved P1, every P2/P3 has a documented
  decision, known limitations appear in release notes.
- M9-064's ten "Sign-off areas" (Formula correctness, Product
  requirements, UI compliance, Accessibility, Security, Performance,
  Persistence, Import and export, Deployment, Documentation) each need an
  approved status before release — an open P0 or unapproved P1 in any one
  area blocks that area's sign-off specifically, not just an aggregate
  release/no-release toggle, per M9-064's own DoD ("Each required area
  has a named reviewer and an approved status").

This document does not itself perform that review — no defect backlog
exists yet to review, since Milestone 9 has only just begun. It exists so
Batches 2–11 have one shared, already-approved severity standard to
classify whatever they find against, satisfying this task's own
dependency relationship (M9-004 depends on M9-001; M9-063/064 depend,
transitively through the whole milestone, on this document existing
first).
