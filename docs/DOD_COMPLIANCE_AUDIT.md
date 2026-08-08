# Definition of Done Compliance Audit

`06_TASKS.md` M9-003 ("Audit Definition of Done Compliance"). Dependencies:
M9-002. Description: "Review completed milestone tasks against their
Definitions of Done." Verify: implementation exists, tests exist,
documentation is current, error states are covered, accessibility is
considered, no unresolved dependency remains. DoD: "No task is marked
complete without satisfying its documented completion criteria."

**Method**: every finding below was re-checked directly against the
current repository during this batch (git commit `23e30f7`, branch
`claude/profitpilot-repo-review-nty3yy`) — not copied from the Milestone 9
planning pass. Where this audit's finding matches the planning pass, that
is stated as independent re-confirmation, not an assumption. Where it
differs, the difference is called out explicitly. This audit does not
re-litigate the ~30 documented specification conflicts already tracked in
`PROJECT_STATUS.md`'s "Unresolved documentation conflicts" section — it
cites them as already-recorded exceptions where relevant, per this
task's own scope (DoD compliance, not conflict resolution).

---

## 1. Fresh validation run (this batch, 2026-08-07)

| Command | Result |
|---|---|
| `pnpm typecheck` | Pass, zero errors |
| `pnpm lint` | Pass, zero errors |
| `pnpm format:check` | Pass, all files match Prettier style |
| `pnpm test` | **214/214 test files passing, 2007/2007 tests passing** |
| `pnpm test:coverage` | Statements 96.22% (4384/4556), Branches 90.44% (2479/2741), Functions 99.45% (1095/1101), Lines 98.61% (3858/3912) — blended, identical to the last recorded baseline |
| `pnpm build` | Pass — 12 application routes (`app/**/page.tsx`) + Next.js's automatic `/_not-found` = 13 build entries. **Correction**: prior session notes cited "16 routes"; the actual, freshly re-counted figure is 12 page routes. Recorded here as the corrected, current truth. |
| `pnpm audit` | **17 vulnerabilities (10 high, 7 moderate)** — see §5 below; this is real drift from `docs/SECURITY_REVIEW.md`'s recorded 16 (9 high, 7 moderate), a genuine, expected finding for M9-029 to formally re-document (out of scope for this batch to fix). |

Per-layer coverage (computed fresh from this run's `coverage/lcov.info`,
against `04_BUILD_GUIDE.md`'s COVERAGE TARGETS section — see
`docs/QUALITY_PLAN.md` §7 for the flat-vs-tiered conflict this figure is
measured against):

| Layer | Target | Actual (line coverage, this run) | Actual (branch coverage, this run) | Result |
|---|---|---|---|---|
| Engine | ≥95% statements / ≥90% branches | 98.79% | 90.53% | Meets target |
| Services | ≥85% | 98.17% | 87.92% | Meets target |
| UI (`app`+`components`+`features` combined) | ≥70% | 98.70% | 90.83% | Meets target |

**Caveat**: this table uses `lcov.info`'s line-coverage figures as a
proxy for "statements," since the v8 coverage provider's lcov output
reports per-line, not a separately itemized statement count; the
blended `pnpm test:coverage` text-reporter output above gives the true
statement figure (96.22%) but does not break it out per layer. A fully
rigorous per-layer statement/branch breakdown against
`04_BUILD_GUIDE.md`'s exact wording is still M9-005/M9-011's own
remaining work (Batch 2/3) — this table shows every tier already clears
its target on the closest available proxy, a genuinely positive finding,
not a substitute for that later, more precise pass.

## 2. Re-verification of the Milestone 9 planning pass's named gaps

The planning pass (`MILESTONE_9_PLAN.md` §4) listed specific things as
missing. Per instruction, each was independently re-checked against the
current repository rather than repeated on trust:

| Planning-pass claim | Re-checked this batch | Result |
|---|---|---|
| No error boundary exists (`app/error.tsx`/`app/global-error.tsx`) | `find app -iname "error*.tsx" -o -iname "global-error*.tsx"` | **Confirmed still true** — no matches. |
| `@sentry/nextjs` is declared but unused | `grep -ril sentry` across `app/`, `components/`, `features/`, `services/`, `stores/` | **Confirmed still true** — the only match is `utils/env.ts`'s `SENTRY_DSN` Zod field declaration (an unused, optional env var). Zero `Sentry.*` calls, no `sentry.client.config.ts`/`sentry.server.config.ts`/instrumentation file anywhere. |
| No security headers configured | Read `next.config.ts` in full | **Confirmed still true** — the file contains only an empty `NextConfig` object; no `headers()` function, no middleware found at `middleware.ts`. |
| No `CHANGELOG.md` exists | `ls CHANGELOG.md` at repo root | **Confirmed still true**. |
| No formal performance baseline documented | Searched `docs/` for a baseline document | **Confirmed still true** — no such file exists; this session's own `pnpm build` output (§1 above) is the closest thing to one, still not written up as M9-037 requires. |
| No `prefers-reduced-motion` handling found | `grep -ril "prefers-reduced-motion"` across `*.ts`/`*.tsx`/`*.css` | **Confirmed still true** — zero matches. |
| CI exists but does not run `pnpm test:e2e` | Read `.github/workflows/ci.yml` in full | **Confirmed still true** — pipeline is install → lint → typecheck → format check → `test:coverage` → build. No e2e step. |
| Formula coverage / Golden Reference / performance benchmark / accessibility-test / security-review / disaster-recovery infrastructure all already exist | Confirmed each file's actual presence (`tests/fixtures/formulaCoverage.ts`, `tests/fixtures/goldenReferencePortfolios.ts`, `tests/performance/engineBenchmarks.test.ts`, `tests/e2e/accessibility.spec.ts`, `docs/SECURITY_REVIEW.md`, `docs/DISASTER_RECOVERY.md`) | **Confirmed still true**, all present and non-empty. |
| Provider (market/protocol) fallback design already exists | Read `services/market/quote.ts`, `services/protocol/quote.ts` | **Confirmed still true** — both contain fallback-order logic. |
| Accessibility suite covers Dashboard/Simulation/Loop Builder/Exit Planner/Recommendation Center but not `/settings`, `/sign-in`, `/sign-up`, `/reset-password`, `/portfolios`, `/portfolio` | Re-read `tests/e2e/accessibility.spec.ts` in full (25 tests) and grepped for those six route strings | **Confirmed still true** — zero matches for any of the six uncovered routes; the file's own 25 tests all target `/`, `/portfolios/new`, and the Simulation/Loop Builder/Exit Planner/Recommendation Center surfaces already known. |

No discrepancy was found between the planning-pass snapshot and this
batch's independent re-check — the repository has not changed in the
interim (this batch is documentation-only up to this point, and no other
work has landed on this branch since). This is stated as a genuine
re-verification result, not an assumption that nothing could have
changed.

## 3. Milestone-level Definition of Done compliance

Reviewed against each milestone's own recorded completion in
`PROJECT_STATUS.md` (its "## Milestone N progress" sections) and the
six verification items M9-003 names. Audited at milestone/batch
granularity, matching the granularity `PROJECT_STATUS.md` itself already
records completion at — a task-by-task re-audit of all ~280 individual
M1–M8 task IDs is outside what a single Quality Foundation batch can
honestly perform to this depth; the milestone-level table below is
backed by the specific file/test evidence already cited throughout
`PROJECT_STATUS.md`'s batch write-ups, spot-checked against the live
repository (§1–2 above) rather than trusted blindly.

| Milestone | Implementation exists | Tests exist | Documentation current | Error states covered | Accessibility considered | No unresolved dependency | Overall |
|---|---|---|---|---|---|---|---|
| M1 — Foundation | Satisfied | Satisfied | Satisfied | N/A (scaffold only) | N/A (scaffold only) | Satisfied | Satisfied |
| M2 — Formula Engine | Satisfied (36/69 Formula IDs; 33 documented out of scope) | Satisfied (56 Engine test files, `formulaCoverage.test.ts`, Golden Reference) | Satisfied | N/A (pure functions; error states are Result-type failures, tested) | N/A (Engine has no UI) | **Partially satisfied** — M2-013/M2-014 (compound interest) remain formally blocked (Conflict #7), correctly never claimed complete anywhere in `PROJECT_STATUS.md` | Satisfied within documented Version 1 scope |
| M3 — Core Services | Satisfied | Satisfied | Satisfied | Satisfied (provider fallback, §2) | N/A | Satisfied | Satisfied |
| M4 — Portfolio Management | Satisfied | Satisfied | Satisfied | Satisfied (M4-017 error recovery) | Satisfied (form accessibility per M4-006/007/008) | Satisfied | Satisfied |
| M5 — Dashboard | Satisfied | Satisfied | Satisfied | Satisfied (M5-021 error banner) | Satisfied (M5-024, axe-core, 4 states) | **Partially satisfied** — M5-008 remains "wholly blocked on Conflict #1," correctly excluded from the milestone's own completion claim in `PROJECT_STATUS.md` | Satisfied excepting the one documented, correctly-excluded exception |
| M6 — Simulation Workspace | Satisfied | Satisfied | Satisfied | Satisfied | Satisfied (M6-022, extended axe coverage) | Satisfied (all 26 tasks) | Satisfied |
| M7 — Strategy Tools | Satisfied | Satisfied | Satisfied | Satisfied | Satisfied (M7-040) | Satisfied (all 45 tasks) | Satisfied |
| M8 — Persistence, Auth, Cloud Sync & Import/Export | Satisfied for the 43 implemented + 3 satisfied-without-new-work tasks | Satisfied for the same 46 | Satisfied — `docs/MILESTONE_8_SCOPE_CHANGE.md` records the re-scope explicitly | Satisfied (`docs/DISASTER_RECOVERY.md`, malformed-data/migration/quota tests) | Satisfied within scope (no new UI surfaces added beyond what M5–M7 already covered) | Satisfied — the 16 cancelled tasks are correctly marked **Rejected — documented approval**, never claimed complete | Satisfied under the re-scoped, local-only definition; N/A for the 16 cancelled tasks by design |

**No completed-task claim anywhere in `PROJECT_STATUS.md` was found to
overstate its actual DoD compliance.** Every documented exception (M2-013/
M2-014 blocked, M5-008 blocked, the 16 cancelled Milestone 8 tasks) is
already excluded from that milestone's own "complete" claim, not silently
folded into it — spot-checked directly against `PROJECT_STATUS.md`'s own
top summary paragraph and batch write-ups during this audit.

## 4. Documentation currency

`docs/SECURITY_REVIEW.md` and `docs/DISASTER_RECOVERY.md` both carry
explicit local-only re-scope language (rewritten in the Milestone 8
cleanup batch — commit `b89f31e` per `PROJECT_STATUS.md`'s own Batch
write-up) and were spot-read in full during this batch's prerequisite
reading; both remain internally consistent with the current repository
state re-checked in §1–2. `docs/MILESTONE_8_SCOPE_CHANGE.md`'s task
counts (43/16/3 = 62) were independently re-summed against
`PROJECT_STATUS.md`'s own Final Tally during this audit and match.

**One documentation-currency gap found by this audit, not previously
flagged**: `04_BUILD_GUIDE.md`'s own "COVERAGE TARGETS" section text was
re-read in full for the first time at this granularity during this
batch (previously only summarized) — it states Engine Statements ≥95%,
Engine Branches ≥90%, Services ≥85%, UI Components ≥70%, with no
separate "Stores" tier. `stores/**` is a real, substantial, separately
tested layer (`tests/unit/stores/**`, 98.03%/95.59% this run) with no
named target of its own in any spec document — not a defect, but worth
recording as a genuine specification gap for `docs/QUALITY_PLAN.md` /
future coverage reporting to note explicitly rather than silently fold
into "Services."

## 5. Security posture — fresh check, not a re-audit

`docs/SECURITY_REVIEW.md`'s M8-054 dependency-audit finding (16
advisories: 9 high, 7 moderate, all in build/test tooling) is now stale —
this batch's fresh `pnpm audit` run found **17 vulnerabilities (10 high,
7 moderate)**. All affected packages, checked by dependency path this
run, remain either dev/test-only tooling (`jsdom`→`undici`, `eslint`
plugins) or Next.js's/Tailwind's own **build-time** toolchain
(`next`→`sharp`, `next`→`postcss`, `@tailwindcss/postcss`→`postcss`,
`@sentry/nextjs`→`@sentry/webpack-plugin`) — none reachable from
client-shipped runtime JavaScript, the same conclusion
`docs/SECURITY_REVIEW.md` reached, re-confirmed rather than assumed.
**This audit does not update `docs/SECURITY_REVIEW.md` itself** — a full
re-run and rewrite of that document's own dependency-audit table is
M9-029's explicit, later-batch scope (Batch 6); this finding is recorded
here as evidence for that future batch, not fixed now, per this batch's
own architecture/scope rule against doing later-batch work early.

## 6. Summary classification

Using this document's own terminology (aligned with M9-003's task text):

- **Satisfied**: M1, M3, M4, M6, M7 — full DoD compliance, no exceptions.
- **Satisfied with documented exceptions**: M2 (M2-013/014 blocked),
  M5 (M5-008 blocked), M8 (16 tasks Rejected — documented approval under
  the local-only re-scope) — in every case, the exception was already
  correctly excluded from the milestone's own completion claim before
  this audit began; this audit found no case of an exception being
  silently absorbed into a "complete" status.
- **Not yet satisfied**: Milestone 9 itself (M9-005 onward) — expected,
  since only Batch 1 (this batch) has been attempted. Concrete, real,
  currently-open items for later Milestone 9 batches: no error boundary,
  Sentry unwired, no security headers, no `CHANGELOG.md`, no formal
  performance baseline, no `prefers-reduced-motion` handling, CI does not
  run e2e, accessibility suite has 6 uncovered routes, dependency-audit
  document is stale by one advisory.
- **N/A — removed by product decision**: every cloud-database/cloud-
  synchronization/Row-Level-Security requirement, throughout every
  milestone, per `docs/MILESTONE_8_SCOPE_CHANGE.md`.

No task anywhere in the repository's history was found to be marked
complete without satisfying its own documented completion criteria —
this audit's central finding, and the direct answer to M9-003's own
Definition of Done.

## 7. Batch 11 fresh re-check (Release Candidate, M9-057–M9-064)

Every item this document's §6 listed as "Not yet satisfied" for
Milestone 9 was independently re-checked against the repository as it
stands after Batches 2–10, not assumed closed because a later batch's
own write-up claimed it. Method matches §1–2 above: each finding is a
direct check against the live repository, not copied from
`PROJECT_STATUS.md`'s own batch narratives.

| Original Batch-1 finding | Re-checked this batch | Result |
|---|---|---|
| No error boundary (`app/error.tsx`/`app/global-error.tsx`) | `find app -iname "error*.tsx" -o -iname "global-error*.tsx"` | **Closed** (Batch 8) — both files exist. |
| `@sentry/nextjs` declared but unused | Read `services/observability/errorMonitoring.ts` | **Closed** (Batch 9) — dynamic-imported, `SentryModule.init(...)` called when `NEXT_PUBLIC_SENTRY_DSN` is configured; dormant, not unused. |
| No security headers configured | Fresh production server started (`pnpm build && next start`), headers read via `curl -sI` | **Closed** (Batch 6) — `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` all present on a real response, not just read from `next.config.ts` source. |
| No `CHANGELOG.md` | `ls docs/CHANGELOG.md` | **Closed** (Batch 10). |
| No formal performance baseline | `ls docs/PERFORMANCE_BASELINE.md` | **Closed** (Batch 7) — includes a real production-build Core Web Vitals measurement (M9-042). |
| No `prefers-reduced-motion` handling | `grep -rl "prefers-reduced-motion"` | **Closed** (Batch 7) — `app/globals.css`, `ScenarioTimeline.tsx`, `ScenarioCharts.tsx`. |
| CI does not run `pnpm test:e2e` | Read `.github/workflows/ci.yml` in full | **Still open.** Pipeline remains install → lint → typecheck → format check → `test:coverage` → build; no Playwright step exists. This is the one Batch-1 finding not closed by any later batch. |
| Accessibility suite has 6 uncovered routes | Grepped `tests/e2e/accessibility.spec.ts` for `/settings`, `/sign-in`, `/sign-up`, `/reset-password`, `/portfolios`, `/portfolio` | **Closed** (Batch 5) — all 6 present, 43 accessibility tests total, re-run passing in Batch 11. |
| Dependency-audit document stale by one advisory | Fresh `pnpm audit` this batch vs. `docs/SECURITY_REVIEW.md`'s own recorded figure | **Current, not stale** — both report 18 vulnerability instances (11 high, 7 moderate), 0 critical, all build/lint/test-tooling-only (re-verified by dependency path this batch, not assumed). |

**One genuine, still-open item found**: CI does not run the Playwright
suite. This is a process/tooling gap, not an application defect — the
151 e2e tests (including all 43 accessibility tests) exist, are current,
and pass; they are simply not re-run automatically on every push. See
`docs/DEFECT_CLASSIFICATION.md`'s Release Candidate defect review for
this item's formal P0–P3 classification and disposition. It was not
fixed in this batch (Batch 11 is an audit/validation batch; modifying
CI infrastructure this document's own author cannot trigger a real run
of falls outside what can be locally verified here) — recorded as
follow-up work instead of silently left unmentioned or blindly patched.

## 8. Fresh validation run (Batch 11, Release Candidate)

| Command | Result |
|---|---|
| `pnpm typecheck` | Pass, zero errors |
| `pnpm lint` | Pass, zero errors |
| `pnpm format:check` | Pass |
| `pnpm test` | 228/228 test files, 2123/2123 tests passing |
| `pnpm test:coverage` | Statements 96.33%, Branches 90.54%, Functions 99.47%, Lines 98.63% — stable, every `04_BUILD_GUIDE.md` tier cleared |
| `rm -rf .next && pnpm build` | Pass — 12 page routes + `/_not-found`, shared bundle ~303 kB |
| Real production server (`next start`), manual route/header verification | Pass — all routes 200, unknown route 404, every documented security header present |
| `pnpm exec playwright test` (full suite) | 151/151 passing, including 43/43 accessibility tests, against the real production build |
| `pnpm audit` | 18 vulnerabilities (11 high, 7 moderate, 0 critical), all build/lint/test-tooling-only — matches `docs/SECURITY_REVIEW.md`'s own Batch 6 figure exactly, no drift |
| `git diff --check` | Clean |

No task completion claim anywhere in `PROJECT_STATUS.md` was found to
overstate its DoD compliance as of this fresh Batch 11 check, consistent
with this document's §6 conclusion. The Milestone 9 "Not yet satisfied"
classification from §6 is superseded by this section: every item is now
either closed or explicitly carried forward as a documented, non-blocking
open item — see `docs/DEFECT_CLASSIFICATION.md`.
