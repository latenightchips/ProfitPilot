# Milestone 4 Completion Report — Portfolio Management

Date: 2026-07-26
Status: **Complete.** All 18 documented tasks (M4-001 through M4-018) addressed per `docs/06_TASKS.md`.

This document is a permanent record of Milestone 4, maintained alongside
`PROJECT_STATUS.md` (which remains the live, continuously-updated tracker).
Unlike `PROJECT_STATUS.md`, this file is a fixed snapshot taken at the
milestone boundary and is not edited as later milestones proceed. It is not
part of the `docs/` specification set.

---

## 1. Completed Tasks

Implementation proceeded in 11 batches (Batch 0 plus Batches 1–10), one
commit per batch, each validated (typecheck, lint, format, full test suite,
coverage, production build, architecture/traceability audit) before commit.

| Batch | Tasks                  | Scope                                                                                              | Commit    |
| ----- | ---------------------- | -------------------------------------------------------------------------------------------------- | --------- |
| 0     | Conflict #20 fix       | Zero-debt portfolio summary handling — prerequisite for M4-002/M4-003                              | `ce2085d` |
| 1     | M4-001–M4-003          | Portfolio types, Zod schemas, Zustand store                                                        | `85c0b56` |
| 2     | M4-004, M4-010, M4-016 | Portfolio list scaffold, active-portfolio switcher (`AppHeader`), delete confirmation              | `787127a` |
| 3     | M4-005, M4-006         | Portfolio creation and details forms (plus an `@hookform/resolvers` dependency-version correction) | `8701586` |
| 4     | M4-007, M4-008         | Collateral and debt position management forms                                                      | `0aa6a28` |
| 5     | M4-009                 | Portfolio action preview (Preview → Apply confirmation gate)                                       | `01de0cb` |
| 6     | M4-011, M4-012         | Duplicate / Archive / Unarchive / Delete flows                                                     | `61654b9` |
| 7     | M4-014, M4-015         | Manual price controls, protocol parameter controls                                                 | `253a513` |
| 8     | M4-013                 | Portfolio auto-save state and stale-preview protection                                             | `6c7d689` |
| 9     | M4-017                 | Portfolio error recovery (calculation-failure banner, retry, recovery export)                      | `3aac154` |
| 10    | M4-018                 | Portfolio workflow tests (integration + Playwright), final Milestone 4 task                        | `0401e01` |

All 18 tasks (M4-001–M4-018) are accounted for above; none were skipped.

---

## 2. Architecture Decisions

- **Layering held with zero violations across all 11 batches.** UI reads and
  writes only through `stores/portfolioStore.ts`, which calls `services/`,
  which call `engine/`. `engine/` source was untouched in every batch except
  Batch 0's Conflict #20 fix, confirmed each batch via `git diff --stat -- engine/`.
- **Conflict A (single collateral position + single debt position, no
  arrays)** — upheld in every task; Version 0.1 scope was never silently
  widened to multi-position support.
- **Conflict B (no persistence infrastructure before Milestone 8)** — upheld
  throughout; the Store remains in-memory only. Where later tasks' literal
  wording implied persistence-like behavior (M4-013's "auto-save," M4-017's
  recovery flow), the implementation built only what is honestly real in a
  synchronous, non-persisted, non-networked architecture rather than
  fabricating a fake persistence or network narrative:
  - `saveStatus` transitions (`saving`/`saved`/`error`) are genuinely real
    and independently verifiable via a direct Zustand `subscribe`, but
    `saving` is never React-paintable (every Store mutation is synchronous),
    and `offline` was deliberately never wired to `navigator.onLine` since
    the Store has no network dependency to be offline from.
  - Portfolio recovery export (Batch 9) is a local-only Blob download, not a
    server-backed save.
- **Two previously-unused Services wired into the UI for the first time**
  (Batch 7): `normalizeMarketQuote` and `normalizeProtocolQuote`, built in
  Milestone 3 but not consumed by any UI until Manual Price / Protocol
  Configuration Controls required them.
- **One pre-existing regression found and fixed in test code only**
  (Batch 10): `tests/e2e/navigation.spec.ts`, a Milestone-1-era Playwright
  test, had been silently broken since Batch 2 (M4-010's `AppHeader` links
  made the sidebar's own "Portfolio" link ambiguous to unscoped role-name
  matching). Fixed by scoping the locator to the sidebar's `nav[aria-label="Primary"]`
  landmark — a test-precision fix; the sidebar link was never actually
  ambiguous to a real user, and no application code changed.

---

## 3. Resolved Documentation Conflicts

Only one conflict was resolved to closure during Milestone 4:

- **Conflict #20** — `calculatePortfolioSummary` / `calculateLiquidationPrice`
  (F-024) left liquidation price undefined for a zero-debt portfolio, with
  no documented behavior for that case. Resolved standalone in Batch 0,
  before any Milestone 4 task requiring zero-debt support was implemented.

---

## 4. Unresolved Documentation Conflicts

**27 conflicts remain open** (28 raised across the project to date, minus
#20). Full detail and exact wording live in `PROJECT_STATUS.md` under
"Unresolved documentation conflicts"; titles are reproduced here for the
permanent record.

### Carried forward from Milestones 2–3 (19 open, unaffected by Milestone 4)

1. Health Factor risk-band thresholds disagree across four documents —
   blocks Milestone 2 (Formula F-026/F-060) and **Milestone 5 (Dashboard)**
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

### Raised during Milestone 4 (8 open)

21. M3-013 asks Services to receive "persistence adapters," but no
    persistence Service or task exists anywhere in Milestone 3
22. M4-001 names "Settings" as a required Portfolio field with no defined
    shape
23. `03_UI.md`'s page inventory has no room for a "Portfolio List" page,
    which Milestone 4 requires
24. M4-005's "preset" protocol-parameter option has no documented preset
    values anywhere
25. M4-008 names "Price" and "Rate type" debt-position fields with no
    counterpart in the data model
26. M4-009's DoD requires confirmation for "risk-increasing" changes, a
    term never defined
27. M4-012 never says whether an archived portfolio remains independently
    selectable
28. M4-013 requires "auto-save," but M4-009 requires the opposite (explicit
    confirmation) for the same fields, and two of M4-013's four DoD save
    states are not honestly buildable in this architecture. Practically
    resolved by keeping M4-009's more specific, already-approved rule and
    building only the real states (see Architecture Decisions above); the
    documentation conflict itself remains open.

**Most likely to affect Milestone 5 directly:** #1 (Health Factor
thresholds — the Dashboard needs a single settled definition) and
#9/#11/#12 (Recommendation Engine formula gaps the Dashboard may need to
surface).

---

## 5. Validation Statistics

| Check                                    | Result                                |
| ---------------------------------------- | ------------------------------------- |
| `pnpm typecheck`                         | Pass                                  |
| `pnpm lint`                              | Pass                                  |
| `pnpm format:check`                      | Pass                                  |
| `pnpm test` (Vitest, unit + integration) | **892 / 892 passing** (84 test files) |
| `pnpm test:e2e` (Playwright, Chromium)   | **12 / 12 passing**                   |
| `pnpm build` (production)                | Pass                                  |

Both test layers required by M4-018's DoD ("Critical portfolio workflows
pass in integration and Playwright tests") independently cover the same
"Cover" checklist at two different layers: `tests/integration/portfolio/portfolioWorkflows.test.ts`
(Store/Service-level, no rendering) and `tests/e2e/portfolioWorkflows.spec.ts`
(real Chromium browser, real navigation). Batch 10 was also the first batch
in the entire engagement to run the full Playwright suite as part of its own
validation pipeline, which is what surfaced the pre-existing `navigation.spec.ts`
regression described above.

---

## 6. Coverage

Project-wide, `vitest.config.ts` scope (`engine/**`, `services/**`,
`utils/**`, `types/**`, `stores/**`, `app/portfolio/**`, `app/portfolios/**`,
`components/layout/AppHeader.tsx`):

| Metric     | Coverage           |
| ---------- | ------------------ |
| Statements | 95.42% (1480/1551) |
| Branches   | 88.58% (745/841)   |
| Functions  | 100% (249/249)     |
| Lines      | 98.64% (1308/1326) |

---

## 7. Lessons Learned

- **Verifying a claimed sync beats trusting it.** During Batch 9, a
  confirmation that "Batch 9 has been synchronized to GitHub" was checked
  against `git ls-remote origin main` directly and found to be false —
  `origin/main` was still at the prior batch's commit. Flagging the
  discrepancy immediately, rather than proceeding on an unconfirmed base or
  silently working around it, is the correct response; `git fetch`'s summary
  line alone is not sufficient confirmation — a direct `git ls-remote` plus
  an empty `git diff origin/main..HEAD --stat` is.
- **A test that fails can be more informative than the assumption it was
  written to confirm.** Batch 9's Retry mechanism was initially assumed to
  "recover" a calculation error once underlying data was fixed; a test
  written to prove this failed, revealing that every other mutating Store
  action already keeps cached summaries in sync with committed data, so a
  cached summary is never stale relative to what's committed. The
  documentation was corrected to state Retry's real, more limited effect
  rather than adjusting the test to match the original assumption.
  Don't assume a mechanism's effect — write the test that would falsify
  the assumption before documenting it as fact.
  Applies equally to reachability claims: M4-017's premise (that
  calculation failures are genuinely reachable via Zod-valid input) was
  confirmed by dispatching a subagent to find real cases before writing any
  recovery UI, not assumed from the task description.
- **Running the full validation surface, not just the parts a batch's own
  diff touches, finds regressions nothing else will.** `pnpm test:e2e` had
  never been run as part of any batch's pipeline before Batch 10 — only
  `pnpm test` (Vitest) had. Running it for the first time surfaced a
  regression that had been silently broken since Batch 2. A batch's
  validation pipeline should exercise the full suite the project defines,
  not only the layer the batch's own changes are expected to touch.
- **Later-numbered tasks don't automatically override earlier, more
  specific, already-approved ones.** M4-013's general "auto-save" DoD
  appeared to conflict with M4-009's more specific explicit-confirmation
  gate for the same fields. Rather than regressing the already-shipped,
  more specific behavior to satisfy the newer task's looser wording, the
  more specific rule was kept and the conflict was documented (#28) instead
  of silently resolved by picking whichever task came later.
- **An honest partial implementation is preferable to a complete but
  fabricated one.** Both `saveStatus`'s unreachable `saving`/`offline`
  states (Batch 8) and Retry's real-but-limited effect (Batch 9) were
  documented as exactly what they are, rather than staged with artificial
  delays or a fake network-dependency narrative to make all DoD states
  appear equally real.

---

## 8. Recommendations for Milestone 5

1. **Re-read `docs/06_TASKS.md`'s Milestone 5 section fresh before
   implementing anything**, the same Batch-0-style review that produced
   Conflict #20's resolution ahead of Milestone 4 — do not assume Milestone
   5's task boundaries or numbering mirror Milestone 4's.
2. **Address Conflict #1 before or alongside the first Dashboard-related
   task.** It is the single conflict most explicitly named as blocking
   Milestone 5 in the existing record; starting Dashboard work without a
   settled Health Factor risk-band definition risks the same kind of
   collision Batch 7 hit with M4-013 (#28).
3. **Check whether any Milestone 5 task depends on #9, #11, or #12**
   (Recommendation Engine formula gaps) before committing to a batch
   pairing — a Dashboard summary or recommendation surface may need exactly
   those formulas.
4. **Continue the established batch workflow** (verify sync → implement one
   documented batch → run the full validation pipeline including
   `pnpm test:e2e` → architecture/traceability audit → document conflicts →
   stop for approval before committing). This workflow caught every
   regression and false assumption recorded in this report before it
   reached a commit.
5. **Verify synchronization directly** (`git ls-remote origin main` plus an
   empty `git diff origin/main..HEAD --stat`) at the start of Milestone 5's
   first batch and after every confirmed sync going forward, per the lesson
   in Section 7.
