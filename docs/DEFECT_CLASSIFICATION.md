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

This document did not itself perform that review while Milestone 9 was
still in progress — no defect backlog existed yet to review. It existed
so Batches 2–11 had one shared, already-approved severity standard to
classify whatever they found against, satisfying this task's own
dependency relationship (M9-004 depends on M9-001; M9-063/064 depend,
transitively through the whole milestone, on this document existing
first). §6 below is that review, now that Batch 11 has run it.

## 6. Batch 11 — Release Candidate Open Defect Review (M9-063)

Every item below was found by direct inspection during Batch 11 (fresh
`pnpm audit`, `TODO`/`FIXME`/`HACK`/`.skip(`/`.only(` greps across
`tests/` and every source directory, a full re-read of
`PROJECT_STATUS.md`'s 37-entry "Unresolved documentation conflicts"
list, `docs/QUALITY_PLAN.md`, and every M9-0XX supporting document named
in this batch's own reading list) — not copied from an earlier batch's
claim without re-checking it.

**Open P0 defects: none found.**

**Open P1 defects: none found.**

**P2 (non-blocking, documented workaround) and other classified items:**

| Item | Severity | Workaround / disposition |
|---|---|---|
| CI (`.github/workflows/ci.yml`) does not run `pnpm test:e2e` | P2 | Documented, unchanged since the original M1-008 build and every Milestone 9 audit since. Workaround: the full Playwright suite (151 tests, including all 43 accessibility tests) is run manually against a real production build before every release — exactly what Batch 11 itself did. Recommended follow-up (not this batch's scope): add a `pnpm exec playwright install --with-deps chromium && pnpm test:e2e` step to CI. Not fixed here — modifying CI infrastructure cannot be verified from inside this environment (no way to trigger and observe a real GitHub Actions run), so it is recorded rather than blindly changed. |
| 18 `pnpm audit` advisories (11 high, 7 moderate, 0 critical) | P2 → treated as non-blocking | Every advisory is build-time/lint-time/test-time tooling only (`sharp`, `postcss`, `brace-expansion`, `undici`, `fast-uri`, `js-yaml`, `nanoid` — all transitive dependencies of `next`, `eslint-config-next`, `@sentry/nextjs`, `@tailwindcss/postcss`, or `vitest`'s own `jsdom`), none reachable from client-shipped runtime code (verified by dependency path, `docs/SECURITY_REVIEW.md` M9-029). Workaround: re-run `pnpm audit` whenever those five direct dependencies are next upgraded (the same standing follow-up `docs/SECURITY_REVIEW.md` already records). |
| Firefox/Safari have no automated test coverage | P2 → treated as non-blocking | `docs/CROSS_BROWSER_REVIEW.md`'s own code-level risk audit substitutes for automated coverage this sandbox cannot produce (no Firefox/WebKit binary available); Chromium (a valid Chrome/Edge proxy) is fully automated. Documented, unchanged limitation, not a regression. |
| No live assistive-technology (screen reader) session recorded | P2 → treated as non-blocking | `docs/ACCESSIBILITY_CONFORMANCE.md` §9's own documented limitation — structural ARIA/role/name verification via axe-core and direct DOM inspection substitutes; no AT software available in this environment. |
| Health Factor risk-band classification (F-026/F-060) not implemented | P3 (documented scope exclusion, not a defect) | Conflict #1 (`PROJECT_STATUS.md`) — no canonical banding scheme is defined across the 4 disagreeing source documents. The UI honestly labels this "Not available" (`LiquidationRiskPanel.tsx`) rather than fabricating a scheme; no incorrect output exists. Remains open pending a product decision on which banding scheme governs — not resolved by this or any batch, per this engagement's standing "flag, don't silently resolve" rule for specification conflicts. |
| 33 of 69 Formula IDs out of scope (multi-asset collateral/debt, compound interest, swap fees/slippage/gas, several Recommendation Engine formulas) | N/A — documented Version 1 scope decision | Not a defect: each has a recorded reason (Conflicts #5, #7, #8, #9, #10, #11, #12, #15) and is Version 2 scope per `01_PRD.md`'s own repeated "belongs to Version 2" framing. `tests/fixtures/formulaCoverage.ts` is the canonical registry. |
| Cloud Database, Cloud Synchronization, Row-Level Security | N/A — cancelled by product decision | `docs/MILESTONE_8_SCOPE_CHANGE.md`; `PROJECT_STATUS.md` Conflict #34. Permanent, not deferred. |
| Performance measured against `localhost` only, not a real deployed origin | P3 (documented caveat) | `docs/PERFORMANCE_BASELINE.md` §5 — every route loads in well under 200ms, a 10x+ margin under the 2s target, making real-world network overhead an unlikely source of a target miss; no deployment target exists to measure against (self-hostable, no owned domain). |
| No license-audit tooling configured | P3 (documented gap) | `docs/SECURITY_REVIEW.md` M9-029 — a manual one-time scan found no GPL/AGPL-family license among direct dependencies; not automated/repeatable. |
| Per-layer (Engine/Services/UI/Stores) coverage breakdown uses a line-coverage proxy, not an exact statement-count breakdown | P3 (documentation precision) | `docs/DOD_COMPLIANCE_AUDIT.md` §1 — the blended, exact statement figure (96.33%) already clears every `04_BUILD_GUIDE.md` tier; only the *per-layer* statement breakdown is a proxy. |
| `01_PRD.md`/`04_BUILD_GUIDE.md` disagree on financial-accuracy tolerance, coverage-target framing, and one Simulation performance figure (Conflicts #35, #36, #37) | N/A (documentation conflict, not a code defect) | `docs/QUALITY_PLAN.md` §7 already records the working precedent followed (Build Guide's more implementation-precise figures); no incorrect behavior results from either reading. |

**Known limitations for release notes** (`06_TASKS.md` M9-063's own
"Known limitations are included in release notes where relevant"): see
`docs/CHANGELOG.md`'s "Known limitations" section — every P2/P3/N/A item
above with real user-facing relevance is named there in plain language.

**Conclusion**: zero open P0 defects, zero open (or unapproved) P1
defects. Every P2 has a documented workaround; every P3 and N/A item has
a documented decision. Per §2's release-blocking rules, **nothing found
in this review blocks a Version 1 release.**
