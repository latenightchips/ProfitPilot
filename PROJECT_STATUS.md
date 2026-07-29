# ProfitPilot — Project Status

Last updated: 2026-07-29
Current milestone: **Milestone 4 — Portfolio Management is complete and synchronized to GitHub** — all 18 tasks (M4-001 through M4-018) addressed across Batch 0 (standalone Conflict #20 follow-up) and Batches 1–10, per `docs/06_TASKS.md`; a permanent snapshot lives in `MILESTONE_4_COMPLETION.md`. **Milestone 5 — Dashboard is complete and synchronized to GitHub**: all 18 batches (M5-001–M5-007, M5-009–M5-028, excluding M5-008) are synchronized; a permanent snapshot lives in `MILESTONE_5_COMPLETION.md`. M5-008 remains wholly blocked on Conflict #1. Milestone 5 found and documented Conflict #30, a large drift between `03_UI.md`'s own Page 3 Dashboard mockup and the `06_TASKS.md`-driven implementation this milestone actually followed. **Milestone 6 — Simulation Workspace is in progress**: Batches 1–11 (M6-001–M6-012) are synchronized to GitHub; Batch 12 (M6-013 — Simulation Assumptions Panel) is implemented and awaiting approval. **Milestone 3 — Core Services is complete** — all 14 tasks (M3-001 through M3-014) addressed. **Milestone 2 — Formula Engine is complete within the documented Version 1 scope** (M2-001 through M2-032 all addressed; M2-013/M2-014 formally blocked; 33 of 69 Formula IDs and multi-asset scenarios intentionally documented as out of scope rather than implemented — see that section's Batch 16 write-up and conflicts #5/#7/#15).

This file is maintained by the implementation process (not part of the
`docs/` specification set) and tracks real build status, deviations, and
open documentation conflicts. It is not a specification document.

---

## Completed tasks

| Task                                  | Status  | Notes                                                                                                                                                                                                                                                    |
| ------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1-001 Create Next.js Project         | ✅ Done | Next.js 15.5.21, App Router, TypeScript, Turbopack dev/build                                                                                                                                                                                             |
| M1-002 Install Core Dependencies      | ✅ Done | All packages from the documented list installed (see "Dependency versions" below)                                                                                                                                                                        |
| M1-003 Create Repository Structure    | ✅ Done | `app/ components/ features/ engine/ services/ stores/ hooks/ types/ utils/ constants/ providers/ styles/ tests/ supabase/ docs/` created per Build Guide's M1-003 directory list; empty dirs hold `.gitkeep`                                             |
| M1-004 Configure Code Quality         | ✅ Done | ESLint (flat config) + Prettier + `eslint-config-prettier` + `eslint-plugin-simple-import-sort`; TypeScript strict mode (already on from scaffold); path alias `@/*`. **Not done:** committed editor "format-on-save" config — declined; see Deviations. |
| M1-005 Configure Testing              | ✅ Done | Vitest (jsdom, v8 coverage, `tests/unit/`) + Playwright (`tests/e2e/`, Chromium via sandbox-installed browser). 6 unit tests / 2 e2e tests passing.                                                                                                      |
| M1-006 Create Application Layout      | ✅ Done | `AppShell`/`AppHeader`/`AppSidebar` (03_UI.md page 2 layout), dark theme default, Inter font, 6 placeholder routes (`/`, `/portfolio`, `/simulation`, `/loop-builder`, `/exit-planner`, `/settings`). No business logic.                                 |
| M1-007 Configure Environment          | ✅ Done | `.env.example` + `utils/env.ts` (Zod-validated, all fields optional/defaulted so Manual Mode runs with zero external config, per REQ-010).                                                                                                               |
| M1-008 Configure CI Pipeline          | ✅ Done | `.github/workflows/ci.yml`: install → lint → typecheck → format check → unit tests (coverage) → build. Not yet run on GitHub (no push performed).                                                                                                        |
| M1-010 Create Developer Documentation | ✅ Done | `CONTRIBUTING.md`: setup, dev/test commands, structure, contribution workflow.                                                                                                                                                                           |

**Deferred:**

| Task                              | Status     | Notes                                                                                                                                                                                                                     |
| --------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1-009 Deploy Initial Application | ⏸ Deferred | Explicitly excluded from this pass per instruction. Project builds cleanly and is deployable to Vercel with zero extra config, but **no Vercel project has been created and none should be until explicitly instructed.** |

---

## Validation results — Milestone 1 (historical, at time of completion)

| Command                                           | Result                                                                                            |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`                                  | ✅ Pass, no errors                                                                                |
| `pnpm lint`                                       | ✅ Pass, no errors (after autofix of import ordering)                                             |
| `pnpm format:check`                               | ✅ Pass (spec docs excluded from Prettier scope — see below)                                      |
| `pnpm test` (Vitest, 6 tests)                     | ✅ Pass                                                                                           |
| `pnpm test:coverage`                              | ✅ Pass, 100% on covered files (`utils/cn.ts`, `utils/env.ts` — the only files with logic so far) |
| `pnpm exec playwright test --list` (config check) | ✅ Valid, discovers 2 tests                                                                       |
| `pnpm exec playwright test` (actual run, bonus)   | ✅ Pass, 2/2                                                                                      |
| `pnpm build` (production, Turbopack)              | ✅ Pass, 6 routes statically prerendered                                                          |
| `pnpm validate` (full pipeline, mirrors CI)       | ✅ Pass end-to-end                                                                                |

No test, lint, or build failures were left unresolved.

---

## Milestone 2 progress

Implementation order follows the sequence proposed in the Milestone 2 review
(Foundation → Portfolio → Risk → Interest → Loop → Simulation → Exit →
Recommendations → Verification), one batch at a time, tests run after each
batch, commit only when a batch passes.

### Batch 1 — Engine Foundation (M2-001 through M2-005)

| Task                                         | Status  | Notes                                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M2-001 Create Formula Engine Foundation      | ✅ Done | `engine/{portfolio,health,liquidation,interest,loop,simulation,exit,recommendation,validation,shared}/` + `engine/index.ts` public entry point. No framework dependencies.                                                                                                                                                                                                                                             |
| M2-002 Implement Shared Financial Types      | ✅ Done | `engine/shared/types.ts` — `MarketPrices`, `CollateralPosition`, `DebtPosition`, `ProtocolParameters`, `PortfolioInput`. Single-asset (BTC collateral / one stablecoin debt), per `01_PRD.md` REQ-003 v0.1 scope — see conflict #5 below. Simulation/Exit-plan/Recommendation input types deferred to the batches that implement those modules, so their shapes come from real formulas rather than being guessed now. |
| M2-003 Configure Decimal Arithmetic          | ✅ Done | `engine/shared/decimal.ts` — Decimal.js configured globally (34-digit precision, `ROUND_HALF_UP`), `toDecimal`/`roundForDisplay`/`toOutputNumber` conversion helpers, `DISPLAY_PRECISION` table. See conflict #6 (Health Factor decimal places).                                                                                                                                                                       |
| M2-004 Create Standard Formula Result Model  | ✅ Done | `engine/shared/result.ts` — `FormulaResult<T>` discriminated union (`FormulaSuccess`/`FormulaFailure`), `FormulaWarning`, `FormulaError`, `FormulaMetadata`, `createSuccess`/`createFailure` constructors.                                                                                                                                                                                                             |
| M2-005 Implement Engine Validation Utilities | ✅ Done | `engine/validation/validate.ts` — `validateFinite/NonNegative/Positive/Percentage/Price/TokenQuantity/Rate/Threshold/TimePeriod`, plus composite `validateProtocolParameters` (also enforces the documented invariant maxLTV ≤ liquidationThreshold).                                                                                                                                                                  |

**Framework-independence audit (post-implementation, pre-commit)**: confirmed
zero imports of React/Next.js/Zustand/Supabase/UI anywhere in `engine/`. The
audit did surface two things that reached outside "Decimal.js + its own
shared modules + TypeScript stdlib" without being on that explicit forbidden
list, both fixed:

- `engine/shared/result.ts` imported the host app's `../../package.json` for
  `engineVersion`. Replaced with a hardcoded `ENGINE_VERSION` constant; a new
  test (`tests/unit/engine/shared/result.test.ts`) guards against it drifting
  from `package.json`'s real version.
- `engine/validation/validate.ts` imported its sibling `engine/shared/*`
  modules via the `@/...` path alias, which only resolves via this app's
  `tsconfig.json`. Changed to relative imports (`../shared/...`) so the
  Engine's internal module graph doesn't depend on the host app's build
  configuration — relevant if the Engine is ever extracted as an independent
  package (04_BUILD_GUIDE.md).

**Validation — Batch 1**

| Command              | Result                                                          |
| -------------------- | --------------------------------------------------------------- |
| `pnpm typecheck`     | ✅ Pass                                                         |
| `pnpm lint`          | ✅ Pass                                                         |
| `pnpm format:check`  | ✅ Pass                                                         |
| `pnpm test`          | ✅ Pass, 51/51 (45 new)                                         |
| `pnpm test:coverage` | ✅ 100% statements/branches/functions/lines on all Batch 1 code |
| `pnpm build`         | ✅ Pass                                                         |

No test, lint, or build failures were left unresolved.

**Sync status**: committed as `4315a41`, exported as patch/bundle, applied
locally, and confirmed present on `origin/main` (re-derived hashes `2cf8c1a`
Milestone 1 / `226876a` Batch 1 — expected from patch reapply, content
identical). Verified by fetching `origin/main` directly and walking its
ancestry from this session.

### Batch 2 — Portfolio Mathematics (M2-006 through M2-008)

| Task                                          | Status  | Notes                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M2-006 Implement Portfolio Value Calculations | ✅ Done | `engine/portfolio/{calculateCollateralValue,calculateDebtValue,calculatePortfolioValue,calculateNetWorth}.ts` — F-001, F-002, F-003, F-004. "Asset/debt allocation percentages" sub-bullets skipped: no Formula ID, and trivially 100% under the approved single-asset/single-debt scope.                                                                                        |
| M2-007 Implement Loan-to-Value Calculations   | ✅ Done | `engine/portfolio/calculateLoanToValue.ts` (F-020); `engine/loop/calculateBorrowCapacity.ts` adds `calculateMaximumBorrowLimit` (F-021) and `calculateAvailableBorrow` (F-013). "Weighted maximum LTV" sub-bullet skipped: multi-collateral only, N/A under approved scope.                                                                                                      |
| M2-008 Implement Leverage Calculations        | ✅ Done | `engine/portfolio/{calculateExposure,calculateEffectiveLeverage}.ts` — F-010, F-011 ("Equity" reuses F-004). "Debt-to-equity ratio" and "Collateral multiplier" sub-bullets skipped: no Formula ID in `02_Formulas.md`, would mean inventing a formula. "Effective BTC exposure" is documented as equal to F-010 under single-asset scope rather than given a separate function. |

**Formula ID duplication found and handled**: `02_Formulas.md` documents the
identical equation (Collateral Value × Max LTV) twice — F-012 "Borrow
Capacity" (Leverage & Loop chapter) and F-021 "Maximum Borrow Limit" (Aave
Risk chapter). Implemented once (`computeBorrowCapacity`, private) with two
public, correctly-tagged wrappers (`calculateBorrowCapacity` for F-012,
`calculateMaximumBorrowLimit` for F-021), so both Formula IDs have a
canonical, traceable implementation without duplicating the math.

**Framework-independence**: re-audited after Batch 2 — still zero
React/Next.js/Zustand/Supabase/UI imports, and no `@/...` alias usage inside
`engine/` (all internal imports are relative).

**Validation — Batch 2**

| Command              | Result                                                          |
| -------------------- | --------------------------------------------------------------- |
| `pnpm typecheck`     | ✅ Pass                                                         |
| `pnpm lint`          | ✅ Pass                                                         |
| `pnpm format:check`  | ✅ Pass                                                         |
| `pnpm test`          | ✅ Pass, 89/89 (38 new)                                         |
| `pnpm test:coverage` | ✅ 100% statements/branches/functions/lines on all Batch 2 code |
| `pnpm build`         | ✅ Pass                                                         |

Every test asserts against a worked example from `02_Formulas.md` (or, where
noted, the "UNIT TEST EXAMPLES" scenarios in the Leverage & Loop chapter)
wherever one exists, plus edge/invalid-input cases per the M2 Testing
Requirements. No test, lint, or build failures were left unresolved.

**Traceability audit (Batch 2, pre-commit)**: every public function carries
its Formula ID in both a doc comment and its runtime `FormulaResult`
metadata; all 10 implemented Formula IDs (F-001, F-002, F-003, F-004, F-010,
F-011, F-012, F-013, F-020, F-021) have an explicit
`metadata.formulaId`-asserting test; no Formula ID called for by M2-006
through M2-008 was omitted.

**Finding: F-005–F-008 (Equity Ratio, Debt Ratio, Portfolio Gain, Portfolio
Return — the rest of `02_Formulas.md`'s Portfolio Metrics chapter) have no
task assigned anywhere in `06_TASKS.md`** — confirmed by a full-document
search, zero matches. Not a Batch 2 omission (never assigned to M2-006 or
any other task). **Decision: intentionally not implemented at this time.**
Treated as an unassigned documentation gap, to be picked up at the Formula
Traceability Audit milestone (M2-032) or whenever `06_TASKS.md` is updated
to assign them — not implemented speculatively now.

---

### Batch 3 — Risk Mathematics (M2-009 through M2-011)

| Task                                               | Status     | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| -------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M2-009 Implement Health Factor Calculations        | ⚠️ Partial | `engine/health/calculateHealthFactor.ts` — F-022, including the "Health Factor without debt" sub-item (returns `Infinity` with a `NO_DEBT` warning, satisfying the "handles zero-debt safely" DoD). "Weighted liquidation threshold" / "Adjusted collateral value" skipped: multi-collateral only, N/A under approved single-asset scope (Adjusted collateral value equals F-002 under current scope, documented in code). **"Health Factor status classification" (F-026) intentionally not implemented — blocked by the still-unresolved Health Factor risk-band conflict (item 1 below).** |
| M2-010 Implement Liquidation Price Calculations    | ✅ Done    | `engine/liquidation/{calculateLiquidationPrice,calculateLiquidationDistance,calculateLiquidationBuffer}.ts` — F-024, F-023, F-025. "Price decline to liquidation" and "Debt increase to liquidation" sub-bullets satisfied by F-025 and F-027 respectively (no separate functions needed). "Required collateral price for a target Health Factor" and "Collateral reduction to liquidation" skipped: no distinct Formula ID in `02_Formulas.md`.                                                                                                                                              |
| M2-011 Implement Target Health Factor Calculations | ✅ Done    | `engine/health/calculateAdditionalBorrow.ts` — F-027, signed result (negative = repayment required), satisfying "Debt repayment required". "Resulting Health Factor verification" (DoD) implemented as an internal self-check that recomputes F-022 and attaches a warning on any mismatch. "Collateral addition required" and "Collateral withdrawal available" skipped: no distinct Formula ID.                                                                                                                                                                                             |

F-026 remains intentionally unimplemented pending resolution of the
documented Health Factor threshold conflict. This is a specification
decision rather than an implementation defect.

**A second Formula ID duplication found and handled**: `02_Formulas.md`
documents `(Collateral × Liquidation Threshold) / Target HF` twice — as the
first term of F-027 "Maximum Additional Debt" (Aave Risk chapter, this
batch) and as F-040 "Target Debt" (Exit Strategy chapter, assigned to the
later task M2-023). Implemented the shared math as a **private**,
non-exported helper inside `calculateAdditionalBorrow.ts` rather than a
public F-040-tagged function, to stay scoped to this batch's assigned
Formula IDs. When M2-023 is implemented, this should be promoted to a
shared public implementation (same pattern as F-012/F-021 from Batch 2)
rather than duplicated.

**A documented exception to "never return Infinity"**: `calculateHealthFactor`
and `calculateLiquidationDistance` return `Infinity` (with an explanatory
`NO_DEBT` warning) for zero-debt portfolios, rather than a structured error —
this is the mathematically correct limit of the formula and directly
required by M2-009's "handles zero-debt portfolios safely" DoD. This is a
deliberate, judgment-call exception to `01_PRD.md` REQ-002's general
"never return ... Infinity" rule, which is understood to target _accidental_
unhandled division-by-zero, not this explicitly anticipated case.

**Framework-independence**: re-audited after Batch 3 — still zero
React/Next.js/Zustand/Supabase/UI imports, no `@/...` alias usage inside
`engine/`.

**Traceability audit (pre-commit)**: every public function carries its
Formula ID in both a doc comment and its runtime metadata; all 5 newly
implemented Formula IDs (F-022, F-023, F-024, F-025, F-027) have an explicit
`metadata.formulaId`-asserting test; every M2-009/010/011 sub-bullet was
cross-checked and is either implemented, or skipped with a documented
Formula-ID-based reason (no formula exists, or blocked by conflict #1).

**Validation — Batch 3**

| Command              | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`     | ✅ Pass                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `pnpm lint`          | ✅ Pass                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `pnpm format:check`  | ✅ Pass                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `pnpm test`          | ✅ Pass, 114/114 (25 new)                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `pnpm test:coverage` | ✅ 99.6% statements / 99.13% branches / 100% functions / 99.53% lines — one branch (`TARGET_VERIFICATION_MISMATCH` in `calculateAdditionalBorrow.ts`) is a defensive check that's mathematically unreachable given valid inputs (the resulting debt is provably always non-negative), left untested rather than forced via internal mocking. Both figures clear `04_BUILD_GUIDE.md`'s documented Engine coverage targets (≥95% statements, ≥90% branches). |
| `pnpm build`         | ✅ Pass                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

Every test asserts against a worked example from `02_Formulas.md` wherever
one exists (deriving equivalent inputs where the doc's example numbers
don't map directly onto this function's parameters), plus edge/invalid-input
cases. No test, lint, or build failures were left unresolved.

---

### Batch 4 — Interest Mathematics (M2-012 through M2-014)

| Task                                            | Status                       | Notes                                                                                                                                                                                                                                                                                                                                                                                           |
| ----------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M2-012 Implement Simple Interest Calculations   | ✅ Done                      | `engine/interest/{calculateDailyInterest,calculateMonthlyInterest,calculateAnnualInterest,calculateProratedInterest}.ts` — F-030, F-031, F-032. "Prorated interest cost" (no distinct Formula ID) satisfied by generalizing F-030's own equation to an arbitrary day count, the same way `02_Formulas.md` itself derives F-031 from F-030 ("Daily Interest × 30") — tagged F-030, not invented. |
| M2-013 Implement Compound Interest Calculations | ⛔ Not implemented — blocked | `02_Formulas.md` F-030–F-034 are simple-interest only; F-033 states explicitly: _"Future versions may support continuous compounding."_ No compound-interest formula exists anywhere in the document to implement against. Per instruction, stopped rather than inventing one. Nothing was written for this task.                                                                               |
| M2-014 Implement Variable Rate Projection       | ⛔ Not implemented — blocked | Formally depends on M2-013 (blocked). Its own sub-bullets (constant/increasing/decreasing/custom rate scenarios) also have no Formula ID — every F-030–F-039 formula assumes a single constant APR. Nothing was written for this task.                                                                                                                                                          |

**Comprehensive finding, same pattern as the F-005–F-008 gap (Batch 2)**: a
full-document search shows **F-034 (Position Decay), F-035 (Health Factor
Over Time), F-036 (Liquidation Price Over Time), F-038 (Time to Target
Health Factor), and F-039 (Time to Danger) have no task assigned anywhere
in `06_TASKS.md`** — zero matches for any of their names/concepts. (F-037
"Break-Even BTC Appreciation" _is_ correctly assigned, to the later M2-017.)
Additionally, **F-033 "Debt Growth" has ambiguous ownership**: it's a fully
documented, simple (non-compounding) formula whose concept ("Future Debt")
is the closest match to M2-013's "Projected debt balance" sub-bullet, but
M2-013 as a whole is scoped to _compound_ interest and F-033 explicitly
isn't. It wasn't implemented this batch since M2-012 (the batch's other,
unblocked task) never mentions "debt growth" or "future debt" as one of its
own sub-bullets — assigning it there would have been a scoping guess, not
something documented. **Not a Batch 4 omission** (none of these six Formula
IDs were ever assigned to M2-012 specifically) — flagged for the same
eventual resolution as F-005–F-008: the M2-032 Formula Traceability Audit,
or a `06_TASKS.md` update.

**Framework-independence**: re-audited after Batch 4 — still zero
React/Next.js/Zustand/Supabase/UI imports, no `@/...` alias usage inside
`engine/`.

**A documentation-internal tension found and resolved in favor of the
stricter stated rule**: `02_Formulas.md`'s own F-031 worked example
("Daily $6.85 × 30 = Monthly $205.50") multiplies the already-_rounded_
daily figure — but the same document's "ROUNDING POLICY" states "Never
round intermediate calculations" and explicitly labels
round-then-calculate-then-round-again as "Incorrect." `calculateMonthlyInterest`
follows the ROUNDING POLICY (full-precision daily value × 30 ≈ $205.48, not
the example's pre-rounded $205.50) rather than reproducing the example's
literal number — tests assert the full-precision value, with a comment
explaining the discrepancy.

**Traceability audit (pre-commit)**: every public function carries its
Formula ID in both a doc comment and its runtime metadata; all 3 newly
implemented Formula IDs (F-030, F-031, F-032) have an explicit
`metadata.formulaId`-asserting test; every M2-012/013/014 sub-bullet was
cross-checked and is either implemented, or explicitly documented as
blocked (compound-interest scope gap) rather than silently skipped.

**Validation — Batch 4**

| Command              | Result                                                                                                                                                                 |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`     | ✅ Pass                                                                                                                                                                |
| `pnpm lint`          | ✅ Pass                                                                                                                                                                |
| `pnpm format:check`  | ✅ Pass                                                                                                                                                                |
| `pnpm test`          | ✅ Pass, 133/133 (19 new)                                                                                                                                              |
| `pnpm test:coverage` | ✅ 100% on all new Batch 4 code (99.66%/99.23%/100%/99.6% overall — the one uncovered line is the same pre-existing, already-documented defensive branch from Batch 3) |
| `pnpm build`         | ✅ Pass                                                                                                                                                                |

No test, lint, or build failures were left unresolved.

---

### Batch 5 — Loop Mathematics (M2-015 through M2-017 only; M2-018 out of scope for this batch)

| Task                                      | Status     | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ----------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M2-015 Implement Loop Step Mathematics    | ✅ Done    | `engine/loop/{calculateLoopCapital,calculateBtcPurchasedPerLoop,calculateLoopStep}.ts` — F-014, F-015, composing F-013/F-002/F-020/F-022. "Collateral after resupply" and "Debt after borrowing" are plain additions with no dedicated Formula ID, computed directly rather than routed through a formula-tagged function. `calculateLoopStep` reconciles all 7 documented outputs in one call, per the DoD.                                                                                                                                                                                                                                                                                                                                                                                  |
| M2-016 Implement Multi-Step Loop Strategy | ✅ Done    | `engine/loop/calculateLoopStrategy.ts` — F-018, realizing 02_Formulas.md's own documented pseudo-algorithm ("intentionally avoids a fixed mathematical formula... determines this iteratively"). Also realizes F-016 "Recursive Exposure" conceptually (cumulative BTC holdings across `steps[]`) without a separate F-016-tagged function, since M2-016 does not name "exposure" as a distinct output. Stops safely (does not commit a step that would breach the configured minimum Health Factor) per the DoD. **"Fees and slippage assumptions" (a documented M2-016 input) is not accepted as a parameter** — no equation for fees or slippage exists anywhere in `02_Formulas.md` (same gap as M2-017 below); inventing a deduction formula would violate "do not invent architecture." |
| M2-017 Implement Loop Cost Calculations   | ⚠️ Partial | `engine/loop/{calculateBreakEvenAppreciation,calculateLoopCosts}.ts` — F-037 (new), reusing F-032 (Annual Interest, M2-012) for "Borrowing interest". Four of the six documented sub-bullets are **not implemented, due to missing specification** — see the individual breakdown immediately below the table. `calculateLoopCosts` itemizes each as `unavailable`, with a reason, rather than silently omitting them or inventing zeros — satisfying the DoD's "every cost is itemized" as far as honestly possible.                                                                                                                                                                                                                                                                         |

**M2-017 — individually itemized unimplemented sub-bullets** (mirrors the
`unavailable` array `calculateLoopCosts` returns at runtime):

- **Swap fees** — not implemented, due to missing specification. No Formula
  ID or equation for swap fees exists anywhere in `02_Formulas.md`.
- **Slippage** — not implemented, due to missing specification. No Formula
  ID or equation for slippage exists anywhere in `02_Formulas.md`.
- **Gas estimate** — not implemented, due to missing specification. No
  Formula ID or equation for gas estimation exists anywhere in
  `02_Formulas.md`.
- **Total implementation cost** — not implemented, due to missing
  specification. It would need to sum swap fees, slippage, and gas
  estimate, all three of which are themselves undocumented; it cannot be
  honestly computed while they are.

("Borrowing interest" and "Break-even BTC appreciation," the other two
M2-017 sub-bullets, **are** implemented — F-032 and F-037 respectively —
and are excluded from this list.)

**Formula ID reused as a composite's primary tag, third occurrence of this
pattern**: `calculateLoopStep` (M2-015) and `calculateLoopStrategy` (M2-016)
each compose several already-tagged Formula IDs into one multi-field result,
matching `02_Formulas.md`'s own LOOP DEPENDENCY GRAPH chaining. Neither
`06_TASKS.md` task names its own dedicated Formula ID, so each composite is
tagged with the Formula ID whose documented purpose most directly describes
the whole function (F-014 "Loop Capital" for the step; F-018 "Maximum Loop
Count" for the multi-step strategy, since F-018 is explicitly the iterative
algorithm this function implements). Every other Formula ID each composes is
documented per-field in code comments and independently tested via its own
standalone function.

**Task-dependency-graph inconsistency found**: `06_TASKS.md` lists M2-017's
dependencies as "M2-016, M2-013" — but M2-013 (Compound Interest) is
blocked (conflict #7), while M2-017's own "Borrowing interest" sub-item is
fully satisfiable using the already-implemented _simple_-interest chain
(F-030–F-032, M2-012), independent of compound interest. Implemented
"Borrowing interest" on that basis rather than treating the whole task as
blocked by a dependency that, on inspection, doesn't actually gate the one
sub-item that's implementable. The formally-declared M2-013 dependency
remains unsatisfied and is why M2-017 is marked Partial rather than Done —
if M2-013 is ever unblocked and introduces additional interest-cost
sub-items, M2-017 will need revisiting.

**Framework-independence**: re-audited after Batch 5 — still zero
React/Next.js/Zustand/Supabase/UI imports, no `@/...` alias usage inside
`engine/`.

**Traceability audit (pre-commit)**: every public function carries its
Formula ID in both a doc comment and its runtime metadata; all newly
implemented Formula IDs (F-014, F-015, F-037) have an explicit
`metadata.formulaId`-asserting test, as do the reused IDs exercised through
the new composites (F-002, F-013, F-020, F-022, F-004, F-011, F-032); every
M2-015/016/017 sub-bullet was cross-checked and is either implemented, or
explicitly documented as skipped/blocked with a reason — F-017 (Loop
Efficiency) and F-019 (Loop Amplification Ratio) were checked and correctly
excluded, since neither is named as a required M2-016 output ("Final
leverage" maps to the already-implemented F-011, not F-019).

**Validation — Batch 5**

| Command              | Result                                                                                                                                                                                                                                                                                                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`     | ✅ Pass                                                                                                                                                                                                                                                                                                                                                                               |
| `pnpm lint`          | ✅ Pass                                                                                                                                                                                                                                                                                                                                                                               |
| `pnpm format:check`  | ✅ Pass                                                                                                                                                                                                                                                                                                                                                                               |
| `pnpm test`          | ✅ Pass, 163/163 (30 new)                                                                                                                                                                                                                                                                                                                                                             |
| `pnpm test:coverage` | ✅ 97.18% statements / 93.71% branches / 100% functions / 99.16% lines. Two new uncovered branches (`calculateLoopStep.ts`, `calculateLoopStrategy.ts`) are defensive re-validation of already-validated data, mathematically unreachable given valid inputs — same pattern as the pre-existing Batch 3 defensive branch, commented in place rather than forced via internal mocking. |
| `pnpm build`         | ✅ Pass                                                                                                                                                                                                                                                                                                                                                                               |

Every test asserts against a worked example from `02_Formulas.md` where one
exists (F-014, F-015, F-037 examples; the "Scenario A" BTC-purchase example
from the Leverage & Loop unit test examples), plus hand-derived multi-step
scenarios for `calculateLoopStrategy`'s three stop conditions and
edge/invalid-input cases. No test, lint, or build failures were left
unresolved.

---

### Batch 6 — Loop Safety Validation (M2-018 only)

Scoped to M2-018 alone: it is the sole remaining task from the original
Loop chapter (M2-015–M2-018), was explicitly deferred out of Batch 5, has
no dependents among M2-019/M2-020 (Price/Interest Scenario Simulation,
which start the next chapter and depend on M2-006/M2-009/M2-010/M2-014
instead), and — as detailed below — turned out to be a materially
different kind of task (validation/orchestration, not a new formula),
worth landing and reviewing on its own before opening the Simulation
chapter.

| Task                                    | Status     | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M2-018 Implement Loop Safety Validation | ⚠️ Partial | `engine/loop/validateLoopStrategySafety.ts`. 6 of the 7 documented checks implemented, each grounded in an already-documented formula or definition (see breakdown below); "Excessive cost" is not implemented — see below. Wraps `calculateLoopStrategy` (F-018, M2-016) with a pre-flight/post-hoc safety gate; per the DoD, a well-formed but unsafe strategy returns `ok: true` with `viable: false` and explicit `error`-severity findings, rather than a failed result or a false-positive success. |

**Why `validateLoopStrategySafety` is tagged F-018 instead of its own
Formula ID — intentional reuse, not a missing implementation:**

1. **M2-018 is an orchestration/validation task, not a new calculation.**
   Its title is "Implement Loop Safety **Validation**": it runs already-
   computed values through a set of pass/fail safety checks (per its own
   DoD, "unsafe strategies return explicit errors or warnings"), the same
   category of work as `engine/validation/validate.ts` (M2-005), not a new
   piece of math with its own equation.
2. **No Formula ID exists for M2-018 anywhere in the documentation.**
   `06_TASKS.md`'s M2-018 task text names no `F-xxx` reference at all —
   the first M2 task encountered so far where that's true — and
   `02_Formulas.md` defines no "Loop Safety Validation" formula anywhere
   (confirmed by a full-document search for "loop safety" / "safety
   validation": zero matches beyond the task title itself, and one
   unrelated Milestone 7 UI task, `M7-013 Implement Loop Safety Analysis`,
   a display/frontend task, out of scope).
3. **Reusing F-018 is a deliberate, documented choice, not an omission.**
   `validateLoopStrategySafety`'s core computation is a direct call to
   `calculateLoopStrategy`, which _is_ F-018 ("Maximum Loop Count" — the
   iterative loop algorithm, M2-016). Tagging the wrapper with the same ID
   as the function it wraps and re-verifies is consistent with the
   established F-012/F-021 (Batch 2) and F-014 (Batch 5) dual-tagging
   precedent, not a substitute for a Formula ID that was never written for
   this task in the first place.

**The 6 implemented checks, each individually grounded** (mirrors the
`LoopSafetyCheck` union `validateLoopStrategySafety` returns at runtime):

- **Valid protocol parameters** — reuses `validateProtocolParameters`
  (already implemented, M2-005).
- **Liquidation proximity** — the _starting_ position's Health Factor
  (F-022) must be above 1.0. Not an invented threshold: F-022's own Human
  Explanation states "Above 1.0 Safe / Near 1.0 Danger / Below 1.0
  Liquidation" — 1.0 is the equation's own documented liquidation boundary.
- **Minimum Health Factor** — the _configured_ `minHealthFactor` floor
  itself must be above 1.0, for the same documented reason: a configured
  floor at or below the liquidation boundary can never be safe, regardless
  of what the strategy computes.
- **Borrowing capacity** — Available Borrow (F-013) on the starting
  position; zero or negative produces a **warning**, not an error — having
  no capacity to loop is non-actionable, not unsafe.
- **Maximum LTV** and **Maximum loop count** — re-verified against the
  computed strategy's actual outcome (Loan-to-Value F-020; `steps.length`
  vs. the configured `maxLoops`) as defense-in-depth. `calculateLoopStrategy`
  already guarantees both structurally (steps are bounded by `maxLoops`;
  each step only ever borrows up to available capacity, so LTV can never
  exceed `maxLoanToValue`), so these two checks are expected to never fire
  for valid inputs — same defensive-branch pattern as the pre-existing
  Batch 3/5 findings, left uncovered by tests with an explanation rather
  than forced via internal mocking.

**"Excessive cost" — not implemented, due to missing specification.**
`02_Formulas.md`'s only cost-related safety rule, F-065 "Interest Warning"
(`Annual Interest > Expected Annual Portfolio Growth` → warning), requires
an "Expected Annual Portfolio Growth" figure that has no formula or
definition anywhere in `02_Formulas.md`. Separately, **F-065 itself is not
assigned to any task in `06_TASKS.md`** (confirmed by search) — the same
unassigned-Formula-ID pattern as F-005–F-008 (Batch 2) and F-034/035/036/
038/039 (Batch 4). Implementing it would require inventing an "expected
growth" assumption, which is out of scope. This is a new instance of the
pattern, not a new root cause.

**Framework-independence**: re-audited after Batch 6 — still zero
React/Next.js/Zustand/Supabase/UI imports, no `@/...` alias usage inside
`engine/`.

**Traceability audit (pre-commit)**: `validateLoopStrategySafety` carries
its (reused) Formula ID in both a doc comment and its runtime metadata;
every reused Formula ID (F-013, F-018, F-020, F-022) is cited per-check in
code comments and already covered by its own standalone tests; a new test
asserts `metadata.formulaId === 'F-018'`; all four reachable checks
(`VALID_PROTOCOL_PARAMETERS`, `LIQUIDATION_PROXIMITY`,
`MINIMUM_HEALTH_FACTOR`, `BORROWING_CAPACITY`) have a dedicated test firing
that exact finding; the two structurally-unreachable checks
(`MAXIMUM_LTV`, `MAXIMUM_LOOP_COUNT`) are documented as such rather than
silently untested; the one M2-018 sub-bullet with no implementable formula
("Excessive cost") is explicitly flagged rather than omitted; public
exports (`validateLoopStrategySafety`, `LoopSafetyCheck`,
`LoopSafetyFinding`, `LoopSafetyValidationResult`) are wired through both
`engine/loop/index.ts` and `engine/index.ts`.

**Validation — Batch 6**

| Command              | Result                                                                                                                                                                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm typecheck`     | ✅ Pass                                                                                                                                                                                                                                                |
| `pnpm lint`          | ✅ Pass                                                                                                                                                                                                                                                |
| `pnpm format:check`  | ✅ Pass                                                                                                                                                                                                                                                |
| `pnpm test`          | ✅ Pass, 171/171 (8 new)                                                                                                                                                                                                                               |
| `pnpm test:coverage` | ✅ 96.16% statements / 91.7% branches / 100% functions / 98.48% lines. Three new uncovered lines in `validateLoopStrategySafety.ts` are the two structurally-unreachable defensive checks described above, same documented pattern as Batches 3 and 5. |
| `pnpm build`         | ✅ Pass                                                                                                                                                                                                                                                |

No test, lint, or build failures were left unresolved.

---

### Batch 7 — Simulation (M2-019, M2-020)

| Task                                          | Status     | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M2-019 Implement Price Scenario Simulation    | ✅ Done    | `engine/simulation/{resolveScenarioPrice,simulatePriceScenario}.ts` — F-050, F-051, composing F-002/F-003/F-004/F-020/F-022/F-023/F-007. All 7 documented outputs (Collateral value, Debt value, Net equity, LTV, Health Factor, Liquidation distance, Profit or loss) implemented. DoD ("the same function supports both absolute prices and percentage changes") satisfied by `resolveScenarioPrice` (F-051), which both scenario shapes resolve through before any other calculation runs. |
| M2-020 Implement Interest Scenario Simulation | ⚠️ Partial | `engine/simulation/{calculateDebtGrowth,simulateInterestScenario}.ts` — F-033, reusing F-030 (generalized, M2-012) for accrued interest and F-002/F-004/F-022. All 5 documented items (Time horizon, Rate assumptions, Projected debt, Projected equity, Projected Health Factor) implemented. Formally depends on M2-014 (blocked); see the dependency-graph finding below for why it's Partial rather than Done despite every sub-bullet being implemented.                                 |

**A new formula chapter found: 02_Formulas.md's "Scenario Simulation &
Forecast Engine" (page 7, F-050–F-059)**, not previously read in detail.
F-050 "Price Change Simulation" and F-051 "Percentage Price Movement" map
directly onto M2-019 — F-051 in particular hands over the exact documented
equation for the DoD's percentage-change requirement (`New Price = Current
Price × (1 + Change%)`), removing what would otherwise have been an
invented conversion. F-052–F-059 (Portfolio Projection, Scenario
Difference, Best/Worst Case, Break-Even Scenario, Target Achievement,
Scenario Ranking Score, Simulation Summary) were read for context but are
out of scope for M2-019/M2-020 specifically — some (F-053 Scenario
Difference) look relevant to the later M2-022 (Scenario Comparison, Batch
8), others (F-056/F-057/F-058, iterative solvers and undefined scoring
weights) will need the same scrutiny M2-018's "Excessive cost" got before
assuming they're implementable as documented.

**Correction to the Batch 2 finding on F-005–F-008**: implementing
"Profit or loss" (M2-019) required finding a Formula ID for it. The only
match is **F-007 "Portfolio Gain"** (`Gain = Current Value − Initial
Investment`) — one of the four IDs the Batch 2 finding reported as
"unassigned anywhere in `06_TASKS.md`". **What the earlier conclusion was
based on**: Batch 2 searched for each formula's literal name ("Portfolio
Gain", "Equity Ratio", etc.) directly against `06_TASKS.md` and found zero
matches — an accurate result for that method, since `06_TASKS.md` task
text never cites Formula IDs or their exact names directly (every task in
this milestone uses plain-English phrasing, cross-referenced to
`02_Formulas.md` by hand). **What changed**: implementing M2-019 required
mapping its plain-English "Profit or loss" output to a real equation, and
that mapping landed on F-007 — demonstrating F-007 is in fact required,
something a literal-name search could not have surfaced. **This is a
correction to the Batch 2 documentation analysis, not a code change**:
nothing built in Batch 2 was wrong or is being modified; F-007 simply
did not have an implementation to assign to a task until M2-019 needed
one. F-007 is now implemented, assigned to M2-019, and tested. **F-005
(Equity Ratio), F-006 (Debt Ratio), and F-008 (Portfolio Return) remain
unassigned** — nothing in M2-019 or M2-020's task text maps to those three
specifically (LTV, already required by M2-019, is F-020, not F-006's
differently-defined Debt Ratio).

**Task-dependency-graph inconsistency, same pattern as M2-017/M2-013
(Batch 5)**: `06_TASKS.md` lists M2-020's dependencies as "M2-014, M2-019"
— M2-014 (Variable Rate Projection) is blocked (conflict #7). But M2-020's
"Projected debt" sub-item does not need variable-rate or compound
projection: **F-033 "Debt Growth"** (`Future Debt = Current Debt + Accrued
Interest`) is an explicitly simple, single-constant-rate equation — its
own text ends "Future versions may support continuous compounding,"
meaning this version is exactly the addition M2-020 needs. This is the
same formula the Batch 4 finding identified as "the closest documented
match for M2-013's 'Projected debt balance,'" left unassigned there because
M2-013 is scoped to compound interest specifically; M2-020 turns out to be
its correct home. All 5 of M2-020's documented sub-items are implemented
on this basis. The formally-declared M2-014 dependency remains unsatisfied
— that's why M2-020 is marked Partial, not because any sub-item is
missing.

**Implementation-quality finding, unrelated to documentation**: while
building `resolveScenarioPrice` (F-051), a genuine bug was caught before
it shipped: `decimal.js`'s `Decimal.isPositive()` treats `0` as positive
(sign-based: `+0` has a positive sign), not `> 0` as the name suggests. An
initial `!newPrice.isPositive()` guard against a percentage change
crashing the price to zero silently passed 0 through as "valid," caught by
a test asserting `percentageChange: -1` (a 100% drop) is rejected. Fixed
with an explicit `!newPrice.greaterThan(0)` check. Audited the rest of
`engine/` for the same pattern (`grep -rn "isPositive()" engine/`): the
only other call site, `validatePositive` in `engine/validation/validate.ts`
(M2-005), already explicitly ORs in `isZero()` to compensate — no latent
bug there. Worth a permanent note for any future decimal.js "positive"
checks in this codebase.

**Framework-independence**: re-audited after Batch 7 — still zero
React/Next.js/Zustand/Supabase/UI imports, no `@/...` alias usage inside
`engine/`.

**Traceability audit (pre-commit)**: every public function carries its
Formula ID in both a doc comment and its runtime metadata; all newly
implemented Formula IDs (F-007, F-033, F-050, F-051) have an explicit
`metadata.formulaId`-asserting test, as do the reused IDs exercised through
the two composites (F-002, F-003, F-004, F-020, F-022, F-023, F-030); every
M2-019/M2-020 "Include"/output item was cross-checked against the
implementation — all 7 of M2-019's and all 5 of M2-020's are present; the
M2-020/M2-014 dependency-graph inconsistency is documented rather than
silently resolved either way; public exports (`resolveScenarioPrice`,
`simulatePriceScenario`, `calculatePortfolioGain`, `calculateDebtGrowth`,
`simulateInterestScenario`, and their types) are wired through both
`engine/simulation/index.ts` and `engine/index.ts`.

**Validation — Batch 7**

| Command              | Result                                                                                                                                                                                                                                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm typecheck`     | ✅ Pass                                                                                                                                                                                                                                                                                                            |
| `pnpm lint`          | ✅ Pass                                                                                                                                                                                                                                                                                                            |
| `pnpm format:check`  | ✅ Pass                                                                                                                                                                                                                                                                                                            |
| `pnpm test`          | ✅ Pass, 200/200 (29 new)                                                                                                                                                                                                                                                                                          |
| `pnpm test:coverage` | ✅ 95.11% statements / 89.51% branches / 100% functions / 98.33% lines. New uncovered lines in `simulateInterestScenario.ts` and `simulatePriceScenario.ts` are defensive re-validation of already-validated data, mathematically unreachable given valid inputs — same documented pattern as Batches 3, 5, and 6. |
| `pnpm build`         | ✅ Pass                                                                                                                                                                                                                                                                                                            |

Every test asserts against a worked example from `02_Formulas.md` where one
exists (F-007, F-033, F-050, F-051 examples), plus hand-derived combined
scenarios (price movement + interest accrual together, per the M2-020 DoD)
and edge/invalid-input cases. No test, lint, or build failures were left
unresolved.

---

### Batch 8 — Simulation, continued (M2-021, M2-022)

| Task                                           | Status  | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M2-021 Implement Collateral and Debt Scenarios | ✅ Done | `engine/simulation/simulatePositionChange.ts` — F-052, composing F-002/F-003/F-004/F-020/F-022/F-023. A single signed-delta interface (`collateralDelta`, `debtDelta`) covers all 5 documented sub-bullets (add/withdraw collateral, borrow more/repay debt, combined actions) without 5 separate functions. DoD ("each simulated action returns both before and after portfolio states") satisfied literally with a `before`/`after` snapshot pair. |
| M2-022 Implement Scenario Comparison           | ✅ Done | `engine/simulation/{compareScenarios,rankScenarios}.ts` — F-053 for comparison, all 6 documented "Compare" metrics (Equity, Profit or loss, Health Factor, Liquidation distance, Debt cost, Leverage) present as `ScenarioSummary` fields. "Ranked" satisfied by `rankScenarios`, a plain sort utility — see the F-058 finding below for why it is not F-058 itself.                                                                                 |

**Design choice: `ScenarioSummary` is a caller-assembled input, not a type
`compareScenarios`/`rankScenarios` compute themselves.** M2-022's DoD
("scenarios can be ranked and displayed without recalculating values in
the UI") means these two functions consume already-computed values rather
than deriving them from raw portfolios. None of M2-019/M2-020/M2-021's
result types natively contain all 6 of M2-022's named metrics in one
place (e.g. `simulateInterestScenario` has no `profitOrLoss` field;
`simulatePositionChange` has no `leverage` field) — assembling a
`ScenarioSummary` from whichever scenario function produced a result is
left to the caller (a future UI/store layer), rather than retroactively
changing Batch 7's already-synchronized result shapes, which was out of
this batch's documented scope.

**Finding: 02_Formulas.md F-058 "Scenario Ranking Score" cannot be
implemented as documented.** Stated plainly: `rankScenarios` is a utility
helper, not a formula implementation; it is explicitly **not** an
implementation of F-058; and F-058 itself remains unimplemented because no
scoring equation or weighting model exists anywhere in `02_Formulas.md`
for it. M2-022's DoD says "ranked," and F-058 is the
only formula in the Scenario Simulation & Forecast Engine chapter
(page 7) that names "ranking" as its purpose — but F-058 documents no
equation: it lists 6 inputs (Expected Return, Health Factor, Debt,
Interest Cost, Risk Score, Target Completion) and says the output is
"0–100, higher = more attractive," with no formula, weights, or worked
example combining them. Implementing it would mean inventing a scoring
model. **`rankScenarios` instead sorts by one caller-chosen
`ScenarioSummary` metric at a time** — a literal, non-invented reading of
"ranked" that doesn't require F-058's undefined methodology. Because it is
not a formula computation, `rankScenarios` does not return a `FormulaResult`
or carry a Formula ID, the same treatment `engine/validation/validate.ts`
(M2-005) gives its own plain utility functions.

**Implementation-quality finding, same class as Batch 7's decimal.js
`isPositive()` bug**: `calculateHealthFactor` (F-022) legitimately returns
`Infinity` for a zero-debt portfolio (a documented Batch 3 exception), and
`ScenarioSummary.healthFactor` can carry that value into
`compareScenarios`. A naive `validateFinite`-style rejection would have
made comparing any zero-debt scenario fail outright. Instead,
`compareScenarios` only rejects `NaN`, computes `Infinity`-aware
differences via plain JS arithmetic when either side is non-finite, and
attaches a warning (rather than failing) for the one genuinely undefined
case — two infinite Health Factors compared against each other
(`Infinity − Infinity`). Caught and fixed before shipping, via a test
asserting this exact zero-debt-vs-zero-debt comparison.

**Framework-independence**: re-audited after Batch 8 — still zero
React/Next.js/Zustand/Supabase/UI imports, no `@/...` alias usage inside
`engine/`.

**Traceability audit (pre-commit)**: every public function carries its
Formula ID in both a doc comment and its runtime metadata (except
`rankScenarios`, whose lack of one is itself documented and justified);
both newly implemented Formula IDs (F-052, F-053) have an explicit
`metadata.formulaId`-asserting test, as do the reused IDs exercised
through `simulatePositionChange`'s composite snapshot (F-002, F-003,
F-004, F-020, F-022, F-023); every M2-021 sub-bullet and every M2-022
"Compare" metric was cross-checked against the implementation — all
present; the F-058 gap is documented rather than silently invented or
silently dropped; public exports (`simulatePositionChange`,
`compareScenarios`, `rankScenarios`, and their types) are wired through
both `engine/simulation/index.ts` and `engine/index.ts`.

**Validation — Batch 8**

| Command              | Result                                                                                                                                                                                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm typecheck`     | ✅ Pass                                                                                                                                                                                                                                                                                    |
| `pnpm lint`          | ✅ Pass                                                                                                                                                                                                                                                                                    |
| `pnpm format:check`  | ✅ Pass                                                                                                                                                                                                                                                                                    |
| `pnpm test`          | ✅ Pass, 219/219 (19 new)                                                                                                                                                                                                                                                                  |
| `pnpm test:coverage` | ✅ 94.97% statements / 89.22% branches / 100% functions / 98.51% lines. Remaining uncovered lines in `simulatePositionChange.ts` are defensive re-validation of already-validated data, mathematically unreachable given valid inputs — same documented pattern as Batches 3, 5, 6, and 7. |
| `pnpm build`         | ✅ Pass                                                                                                                                                                                                                                                                                    |

Every test asserts against a worked example from `02_Formulas.md` where
one exists (F-053's own Net Worth example), plus hand-derived combined-action
and zero-debt/`Infinity` scenarios, and edge/invalid-input cases. No test,
lint, or build failures were left unresolved.

---

### Batch 9 — Exit Strategy (M2-023, M2-024)

| Task                                        | Status     | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M2-023 Implement Exit Position Calculations | ✅ Done    | `engine/exit/{calculateRequiredDebtRepayment,calculateBtcSaleRequired,calculateExitPosition}.ts` — F-041, F-042, composing F-002/F-004. A single `targetDebt` parameter covers both "Full-exit result" (0) and "Partial-exit result" (any value between 0 and current debt). "BTC quantity retained" and "Remaining equity" reconcile with current balances per the DoD. "Exit transaction costs" is not computed — see the extended conflict #8 note below.                                                                                                                     |
| M2-024 Implement Target Exit Calculations   | ⚠️ Partial | `engine/exit/{calculateTargetDebt,calculateTargetExit}.ts` — F-040 (promoted from a private helper, see below). 3 of 5 documented target types implemented (Target debt balance, Target Health Factor, Target retained BTC); "Target BTC price" is satisfied structurally by `calculateExitPosition`'s own optional scenario-price parameter rather than a 4th target-type branch; "Target cash proceeds" is not implemented — genuinely ambiguous mechanics, see below. DoD ("reports when a target is mathematically infeasible") satisfied for every implemented target type. |

**F-040 "Target Debt" promoted from a private helper to a shared public
implementation, as flagged in Batch 3.** `calculateAdditionalBorrow.ts`
(F-027, M2-011) originally computed `(Collateral × Liquidation Threshold) /
Target HF` as a private, non-exported `computeTargetDebt` helper, with its
own comment stating this equation is also F-040 and should be promoted
"when M2-023 is reached." That promotion is done: `engine/exit/calculateTargetDebt.ts`
is now the canonical, publicly F-040-tagged implementation (following the
F-012/F-021 dual-tagging pattern), and `calculateAdditionalBorrow` calls it
instead of duplicating the equation. All 6 of `calculateAdditionalBorrow`'s
existing Batch 3 tests still pass unmodified — this was a refactor, not a
behavior change.

**Finding: "Target BTC price" is not a standalone M2-024 target type.**
`06_TASKS.md` M2-024 lists it under "Targets may include," but a later
milestone's UI task read for context, M7-021 ("Implement Exit Type
Selection"), enumerates the actual selectable exit _types_ — Full exit /
Partial debt repayment / Target Health Factor / Target retained BTC /
Target debt balance / Target cash proceeds — and "Target BTC price" is
**not** among them; it only appears in the separate M7-022 form-fields
list, alongside "Fees / Slippage / Gas estimate." This indicates "Target
BTC price" is a price-scenario override usable with any exit calculation,
not its own target type. `calculateExitPosition` (M2-023) accordingly
accepts an optional `scenarioBtcPriceUsd`, which every M2-024 target type
can use — no separate "Target BTC price" branch was needed or added.

**Finding: "Target cash proceeds" is not implemented — genuinely
ambiguous, not merely undocumented.** Unlike swap fees / slippage / gas
estimate (no formula exists at all), "cash proceeds" has an implicit
equation derivable from a later milestone's task text (M7-024's "Net cash
proceeds = Gross sale value − Debt repaid − ... "), but its _mechanics_ as
a standalone exit target are not determinable: does selecting "Target cash
proceeds" leave debt untouched (sell BTC purely for liquidity, worsening
LTV) or does it imply a full debt repayment with the specified amount left
over afterward? Both are plausible, materially different exits, and
`06_TASKS.md`/`02_Formulas.md` do not disambiguate. Implementing either
guess would mean inventing architecture. Flagged rather than guessed, per
instruction. Logged as conflict #10 below.

**Extending conflict #8 (swap fees / slippage / gas estimate)**: the same
undocumented-transaction-cost gap that blocked parts of M2-017 (Batch 5)
also blocks M2-023's "Exit transaction costs." `calculateExitPosition`
itemizes `swapFees`, `slippage`, and `gasEstimate` as `unavailableCosts`
with reasons, the same treatment `calculateLoopCosts` established — not a
new root cause, an additional occurrence of the same one.

**Finding: F-043, F-044, F-046, F-047, F-048, and F-049 (the rest of the
Exit Strategy chapter — Exit Profit, Capital Preservation Ratio,
Recommended Partial Exit, Risk Reduction Efficiency, Optimal Exit Window,
Exit Confidence Score) have no task assignment found in `06_TASKS.md`**
by name search — the same unassigned-Formula-ID pattern as F-005–F-008
(Batch 2), F-034–F-039 (Batch 4), and F-060–F-069 (Batch 6). Not a Batch 9
omission: none map to M2-023/M2-024's own "Include"/"Targets may include"
lists. Whether any of these six are assigned to a _later_-phrased task
(the same way "Profit or loss" turned out to be F-007, Batch 7) has not
been exhaustively re-checked against every M2-025–M2-032 task text —
flagged for verification whenever a later batch's scope might plausibly
touch profit/return/confidence-scoring concepts, rather than claimed
resolved now.

**Framework-independence**: re-audited after Batch 9 — still zero
React/Next.js/Zustand/Supabase/UI imports, no `@/...` alias usage inside
`engine/`.

**Traceability audit (pre-commit)**: every public function carries its
Formula ID in both a doc comment and its runtime metadata; all newly
implemented/promoted Formula IDs (F-040, F-041, F-042) have an explicit
`metadata.formulaId`-asserting test, as do the reused IDs exercised
through `calculateExitPosition`'s composite (F-002, F-004) and F-027's
refactored reuse of F-040; every M2-023 sub-bullet and every implemented
M2-024 target type was cross-checked against the implementation; the two
unimplemented items ("Exit transaction costs," "Target cash proceeds")
are documented as blocked rather than silently omitted; public exports
(`calculateTargetDebt`, `calculateRequiredDebtRepayment`,
`calculateBtcSaleRequired`, `calculateExitPosition`, `calculateTargetExit`,
and their types) are wired through both `engine/exit/index.ts` and
`engine/index.ts`.

**Validation — Batch 9**

| Command              | Result                                                                                                                                                                                                                                                      |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`     | ✅ Pass                                                                                                                                                                                                                                                     |
| `pnpm lint`          | ✅ Pass                                                                                                                                                                                                                                                     |
| `pnpm format:check`  | ✅ Pass                                                                                                                                                                                                                                                     |
| `pnpm test`          | ✅ Pass, 251/251 (32 new; all 6 pre-existing `calculateAdditionalBorrow` tests still pass unmodified after the F-040 refactor)                                                                                                                              |
| `pnpm test:coverage` | ✅ 95% statements / 89.35% branches / 100% functions / 98.56% lines. Remaining uncovered lines are defensive re-validation of already-validated data, mathematically unreachable given valid inputs — same documented pattern as Batches 3, 5, 6, 7, and 8. |
| `pnpm build`         | ✅ Pass                                                                                                                                                                                                                                                     |

Every test asserts against a worked example from `02_Formulas.md` where
one exists (F-040, F-041, F-042 examples), plus a full-exit/partial-exit/
target-Health-Factor/target-retained-BTC cross-check (all four resolve to
the same underlying numbers for an equivalent scenario), infeasibility
cases for each implemented target type, and edge/invalid-input cases. No
test, lint, or build failures were left unresolved.

---

### Batch 10 — Recommendation Engine (M2-025, M2-026)

| Task                                           | Status     | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M2-025 Implement Recommendation Rule Framework | ⚠️ Partial | `engine/recommendation/{calculateBorrowRecommendation,calculateRepaymentRecommendation,calculateAdditionalCollateralRecommendation,calculateLoopRecommendation,generateRecommendations}.ts` — F-061, F-062, F-063, F-064, composing F-006 (promoted this batch), F-013, F-022, F-032, F-040, F-041, F-042, F-014. 3 of 6 documented "Recommendation categories" implemented (Debt management, Collateral management, Leverage); Safety (F-060) and Interest cost (F-065) remain blocked by pre-existing conflicts; "Exit readiness" has no mapped Formula ID at all — see below. |
| M2-026 Implement Recommendation Explanations   | ✅ Done    | Every recommendation-producing function returns the shared `Recommendation` shape (`engine/recommendation/types.ts`) with all 6 documented fields (Triggering condition, Relevant values, Expected effect, Risk level, Suggested action, Formula references) populated from the moment it is created — M2-026 adds no Formula ID of its own, only this shape requirement on M2-025's outputs, satisfied for every recommendation that is generated.                                                                                                                              |

**F-006 "Debt Ratio" promoted from unassigned to implemented, third
instance of the F-007 pattern (Batch 7).** F-061 "Borrow Recommendation"
explicitly conditions on "Debt Ratio below target." `engine/portfolio/calculateDebtRatio.ts`
implements it, following `calculateLoanToValue`'s (F-020) established
zero-collateral-analog pattern for the zero-portfolio-value edge case
(02_Formulas.md documents no explicit edge case for F-006 itself). F-005
(Equity Ratio) and F-008 (Portfolio Return) remain unassigned.

**A genuinely useful discovery: 02_Formulas.md's "DECISION PRIORITY" list
(page 8), read fresh for this batch.** The Recommendation Engine chapter
documents an explicit, ordered priority — 1. Prevent Liquidation, 2.
Maintain Target Health Factor, 3. Reduce Interest Costs, 4. Improve
Capital Efficiency, 5. Achieve User Goals ("Safety always has higher
priority than profitability") — used as every `Recommendation`'s
`decisionPriority` field (the M2-026 "Risk level" requirement), instead of
the disputed numeric Health Factor risk bands (conflict #1). This keeps
every implemented recommendation's risk framing fully independent of that
unresolved conflict.

**F-062 "Repayment Recommendation" is a fourth instance of the
same-equation-different-chapter duplication pattern** (after F-012/F-021,
F-027/F-040, and now this): its own equation ("Required Repayment =
Current Debt − Target Debt", "Reference: F-040") is identical to F-041
"Required Debt Repayment" (M2-023, Batch 9), itself built on F-040.
`calculateRepaymentRecommendation` reuses `calculateTargetDebt` (F-040)
and `calculateRequiredDebtRepayment` (F-041) rather than duplicating
either.

**F-063 "Additional Collateral Recommendation" has no equation
documented, but one was derivable without inventing anything**: F-022's
own equation (Health Factor = (Collateral Value × Liquidation Threshold) /
Debt) rearranged for Collateral Value gives exactly the collateral needed
for a target Health Factor — the algebraic mirror of F-040 solved for the
other variable. Verified by recomputing F-022 with the resulting
collateral value, the same verification pattern `calculateAdditionalBorrow`
(F-027, Batch 3) established.

**F-060 (Safety) and F-065 (Interest cost) remain blocked — no new root
cause, both already-documented gaps recurring in a new task.** F-060
"Health Factor Recommendation" needs a risk-band scheme, and the
documented bands disagree across README.md / 01_PRD.md REQ-001 / REQ-005 /
F-026 / F-060 itself (conflict #1). F-065 "Interest Warning" needs an
"Expected Annual Portfolio Growth" figure with no formula anywhere
(the same gap that blocked part of M2-018's "Excessive cost" check).
Neither is implemented; both are itemized in `generateRecommendations`'s
`unavailableCategories` output with reasons, not silently dropped.

**Finding: "Exit readiness" (an M2-025 category) has no Formula ID
anywhere in the Recommendation Engine chapter (F-060–F-069).** Checked
every one of F-060 through F-069 individually — none names or implies
"exit readiness" as its purpose. This is not the same class of gap as
F-060/F-065 (a documented-but-blocked formula); it is a category listed
in `06_TASKS.md` with nothing in `02_Formulas.md` to implement against at
all. Not implemented; itemized in `unavailableCategories`. (F-066 Profit
Target Recommendation, F-067 Simple Portfolio Score, F-068 Primary
Recommendation, and F-069 Recommendation Summary were also read this
batch and confirmed not required by M2-025/M2-026's specific category
list — see the next finding for F-067 specifically.)

**Finding: F-067 "Simple Portfolio Score" has partial documentation —
weights given, component formulas missing.** Unlike F-058 "Scenario
Ranking Score" (Batch 8, no weights at all), F-067 documents explicit
weights (Health Factor 40%, Debt Ratio 20%, Interest Cost 15%, Leverage
15%, Portfolio Growth 10%) and a 0–100 output with example bands. But it
never defines how each raw component (e.g. a Health Factor of 1.6) maps
to its own 0–100 sub-score before weighting — that normalization is
undocumented, and 02_Formulas.md's own "IMPLEMENTATION NOTES" for this
chapter state "No hidden scoring," which reinforces not inventing one.
Not required by M2-025/M2-026; flagged for whichever later task (if any)
is assigned F-067, since the gap is narrower than F-058's but still real.

**Framework-independence**: re-audited after Batch 10 — still zero
React/Next.js/Zustand/Supabase/UI imports, no `@/...` alias usage inside
`engine/`.

**Traceability audit (pre-commit)**: every public function carries its
Formula ID in both a doc comment and its runtime metadata; all newly
implemented/promoted Formula IDs (F-006, F-061, F-062, F-063, F-064) have
an explicit `metadata.formulaId`-asserting test, as do the reused IDs
exercised through the four recommendation functions (F-013, F-022, F-032,
F-040, F-041, F-042, F-014); every `Recommendation` includes all 6 M2-026
fields, verified by a dedicated test; the three unimplemented categories
(Safety, Interest cost, Exit readiness) are itemized with reasons rather
than silently omitted; public exports (`calculateDebtRatio`,
`calculateBorrowRecommendation`, `calculateRepaymentRecommendation`,
`calculateAdditionalCollateralRecommendation`, `calculateLoopRecommendation`,
`generateRecommendations`, and their types) are wired through
`engine/portfolio/index.ts`, `engine/recommendation/index.ts`, and
`engine/index.ts`.

**Validation — Batch 10**

| Command              | Result                                                                                                                                                                                                                                                |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`     | ✅ Pass                                                                                                                                                                                                                                               |
| `pnpm lint`          | ✅ Pass                                                                                                                                                                                                                                               |
| `pnpm format:check`  | ✅ Pass                                                                                                                                                                                                                                               |
| `pnpm test`          | ✅ Pass, 292/292 (41 new)                                                                                                                                                                                                                             |
| `pnpm test:coverage` | ✅ 95.25% statements / 90.4% branches / 100% functions / 98.78% lines. Remaining uncovered lines are defensive re-validation of already-validated data, mathematically unreachable given valid inputs — same documented pattern as every prior batch. |
| `pnpm build`         | ✅ Pass                                                                                                                                                                                                                                               |

Every test asserts against a worked example from `02_Formulas.md` where
one exists (a cross-checked scenario shared across all four rule
functions and `generateRecommendations`), plus every documented
"otherwise" branch (do-not-recommend / stop-looping / no-repayment-needed
/ no-additional-collateral-needed), and edge/invalid-input cases. No
test, lint, or build failures were left unresolved.

---

### Batch 11 — Engine Invariants (M2-027)

| Task                               | Status  | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M2-027 Implement Engine Invariants | ✅ Done | `engine/validation/invariants.ts` — 5 plain boolean-predicate functions, one per `06_TASKS.md` "Example," exercised by `tests/unit/engine/invariants/` against real, already-implemented engine functions across multiple scenarios (not just unit-tested in isolation). No new Formula ID: M2-027 is a cross-cutting property-check task over already-implemented formulas, not a new calculation, so nothing is tagged/composed the way M2-001–M2-026's functions were. |

Scoped to M2-027 alone: its dependency list is "M2-006 through M2-026" —
essentially the whole Engine built so far — while M2-028 (Golden Reference
Portfolios) depends on M2-027 and is a different kind of work (creating
immutable fixtures), a natural batch boundary.

**Design choice: invariants are plain predicates, not `FormulaResult`s.**
`06_TASKS.md`'s own M2-027 DoD says "Invariant violations fail **tests**,"
and its Description says "Add automated **checks**" — both point to a
test-suite-and-predicate-function shape rather than a new user-facing
calculation. `engine/validation/invariants.ts` follows
`engine/validation/validate.ts`'s (M2-005) existing precedent for
non-formula boolean helpers, rather than wrapping pass/fail judgments in
the `FormulaResult` envelope meant for derived values with their own
Formula ID.

**A genuine implementation defect found and documented (not silently
patched) by this batch's own invariant #3 ("Target Health Factor results
reproduce the target"): `calculateTargetExit`'s `'healthFactor'` target
type (M2-024, Batch 9) does not actually reproduce the requested target.**
F-040 "Target Debt" computes its target assuming collateral stays fixed —
matching `02_Formulas.md`'s own EXIT DEPENDENCY GRAPH, which chains
F-040 → F-041 → F-042 sequentially with no correction step. But
`calculateExitPosition` (M2-023) actually **sells BTC** to fund the
repayment F-040/F-041 compute, which reduces collateral value too — an
effect F-040 never accounts for (unlike F-045 "Target Price Exit", which
explicitly says its own target is solved "iteratively"; F-040 has no such
note). Concretely, for collateral $120,000 / debt $60,000 / threshold
80% / target HF 2.00: F-040 says target debt is $48,000, but actually
reaching $48,000 debt requires selling $12,000 of BTC, which drops
collateral to $108,000 — producing an actual Health Factor of **1.80**,
not the requested 2.00.

**Decision: implement F-040 exactly as documented (matching the EXIT
DEPENDENCY GRAPH literally) rather than inventing a corrective,
undocumented equation that would exactly reproduce the target.** The
mathematically "more correct" equation is straightforward to derive
(solve `H = ((C − R) × T) / (D − R)` for `R`, the self-consistent
repayment), but it does not appear anywhere in `02_Formulas.md`, and
`02_Formulas.md` gives no indication F-040 is meant to be solved this way
for the exit case — inventing it would be exactly the kind of
undocumented-behavior addition the standing instructions prohibit. The
discrepancy is now explicitly documented in `calculateTargetExit.ts`'s
own code comment at the point it occurs, and asserted precisely (not
hidden) by a dedicated invariant test that expects the violation and
checks its exact magnitude, rather than silently passing or being
deleted. Every other function checked against this same invariant
(`calculateAdditionalBorrow` F-027, `calculateRepaymentRecommendation`
F-062, `calculateAdditionalCollateralRecommendation` F-063) reproduces
its target exactly, because none of them sell collateral to fund the
change — this self-referential effect only exists in the sell-based exit
path. Action needed: either author a documented, self-consistent
"Target Debt" equation for the exit-sells-collateral case in
`02_Formulas.md`, or accept the approximation and document it as intended
behavior at the specification level (not just in this codebase).

**Framework-independence**: re-audited after Batch 11 — still zero
React/Next.js/Zustand/Supabase/UI imports, no `@/...` alias usage inside
`engine/`.

**Traceability audit (pre-commit)**: all 5 documented M2-027 "Examples"
have a corresponding check function in `engine/validation/invariants.ts`
and at least one dedicated cross-cutting test exercising it against real
engine output (not synthetic numbers only); public exports
(`checkNetWorthInvariant`, `checkAllocationInvariant`,
`checkTargetHealthFactorInvariant`, `checkLoopReconciliationInvariant`,
`checkFullRepaymentInvariant`) are wired through `engine/index.ts`; no new
Formula ID was needed or invented; the one genuine defect the invariant
suite surfaced is documented in both code and this file rather than
silently fixed with an undocumented equation or silently ignored.

**Validation — Batch 11**

| Command              | Result                                                                                                                                                                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`     | ✅ Pass                                                                                                                                                                                                                                           |
| `pnpm lint`          | ✅ Pass                                                                                                                                                                                                                                           |
| `pnpm format:check`  | ✅ Pass                                                                                                                                                                                                                                           |
| `pnpm test`          | ✅ Pass, 320/320 (28 new)                                                                                                                                                                                                                         |
| `pnpm test:coverage` | ✅ 95.32% statements / 90.57% branches / 100% functions / 98.8% lines. `engine/validation/invariants.ts` itself is 100% covered; remaining uncovered lines elsewhere are the same documented defensive/unreachable branches as every prior batch. |
| `pnpm build`         | ✅ Pass                                                                                                                                                                                                                                           |

Every invariant is checked against multiple realistic scenarios (not just
one), including different loop-strategy stop reasons and a zero-debt
edge case. No test, lint, or build failures were left unresolved.

---

### Batch 12 — Golden Reference Portfolios (M2-028)

| Task                                      | Status     | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M2-028 Create Golden Reference Portfolios | ⚠️ Partial | `tests/fixtures/goldenReferencePortfolios.ts` (5 immutable fixtures) + `tests/unit/engine/goldenReferencePortfolios.test.ts`. 5 of the 7 named reference cases are implemented (No debt, Conservative leverage, Moderate leverage, High-risk leverage, Near liquidation); "Multiple collateral assets" and "Multiple debt assets" are explicitly out of scope — see below. No new Formula ID: M2-028 exercises already-implemented formulas (F-001, F-002, F-003, F-004, F-006, F-010, F-011, F-020, F-022, F-023, F-024, F-025, F-030, F-031, F-032) against fixed, hand-verified portfolios. |

**A pre-existing "official" Golden Reference Portfolio was found in
`02_Formulas.md` itself** (its own "GOLDEN REFERENCE PORTFOLIO" /
"REFERENCE OUTPUTS" / "ACCEPTABLE ERROR" section, not previously acted on
by any earlier batch), separate from `06_TASKS.md` M2-028's 7-scenario
list. It specifies one exact input scenario (Initial Capital $100,000,
BTC Price $30,000, Initial BTC Purchased 3.33333333 BTC, Max LTV 70%,
Liquidation Threshold 80%, Borrow APR 5%, Target Health Factor 1.80, Loop
Strategy Automatic/Stop at Target HF) and names which Formula ID computes
each of 8 "Reference Outputs" — but, notably, **gives no actual numeric
expected values**, only the formula-to-output mapping; the numbers
themselves are left for the implementer to derive and verify, which is
exactly M2-028's own DoD ("Expected results are manually verified and
stored as immutable test fixtures"). The two documents are complementary,
not conflicting: the `NO_DEBT` fixture below uses this official scenario's
exact figures for its pre-loop (zero-debt) starting state, and is
simultaneously M2-028's "No debt" reference case.

**Every `expected` value in the fixture file was derived independently**
by hand-applying the documented equations with decimal.js at the Engine's
own working precision, in a scratch calculation kept outside the
repository (not by calling the Engine's own functions and copying their
output) — the actual point of "manually verified," per M2-028's DoD.
Comparisons in the test file use `02_Formulas.md`'s own "ACCEPTABLE
ERROR" table (Currency ± $0.01, Health Factor ± 0.001, etc.) rather than
exact floating-point equality — the first batch to explicitly apply that
table, which existed in the spec but had gone unused until now.

**Fixture design**: all 5 fixtures share the same BTC quantity
(3.33333333), BTC price ($30,000), and protocol parameters, varying only
the debt balance — isolating leverage as the sole variable across the
family. "Near liquidation" (debt $77,000, ~77% LTV) intentionally exceeds
the 70% Max LTV: Max LTV (F-012 "Borrow Capacity") only constrains _new_
borrowing, not an existing position's LTV drifting upward after the debt
was already drawn (e.g. from price decline), so this is a realistic
post-origination state, not an invented rule. Only the Liquidation
Threshold (F-022, F-024) governs actual liquidation risk, and this
fixture's Health Factor is just above 1.0 (~1.039) as intended.

**Not implemented, and why (neither invented nor silently skipped):**

- **"Multiple collateral assets" / "Multiple debt assets"** (2 of the 7
  named M2-028 reference cases) — `PortfolioInput` models exactly one BTC
  collateral position and one stablecoin debt position (approved
  single-asset scope, conflict #5). No Formula ID defines multi-asset
  aggregation (e.g. a weighted Liquidation Threshold across several
  collateral assets), so building these fixtures would require inventing
  an aggregation formula absent from `02_Formulas.md`.
- **The "loop to Target Health Factor 1.80" step** of `02_Formulas.md`'s
  own official Golden Reference Portfolio is not reproduced as a fixture
  — see conflict #14 below.
- **Portfolio Score (F-067)**, named in the official portfolio's own
  "REFERENCE OUTPUTS" list, is not computed for any fixture — F-067 has
  no implementation (conflict #12).

**Framework-independence**: re-audited after Batch 12 — still zero
React/Next.js/Zustand/Supabase/UI imports, no `@/...` alias usage inside
`engine/`. The new fixture and test files live under `tests/`, use the
`@/engine/...` alias as every other test file does, and are excluded from
the `engine/**` coverage scope (`vitest.config.ts`) as pure test data —
consistent with the M2-028 DoD framing these as "immutable test
fixtures," not a new Engine API surface, so nothing was added to
`engine/index.ts`.

**Traceability audit (pre-commit)**: all 15 Formula IDs referenced by the
fixtures (F-001, F-002, F-003, F-004, F-006, F-010, F-011, F-020, F-022,
F-023, F-024, F-025, F-030, F-031, F-032) already have canonical, tagged
implementations from prior batches — none new. Every fixture is exercised
against every applicable already-implemented function, including the two
documented no-debt failure paths (Liquidation Price / Liquidation Buffer
return structured `NOT_APPLICABLE_NO_DEBT` failures, asserted explicitly
rather than skipped). No public exports needed adding since M2-028
produces test fixtures, not Engine functionality.

**Validation — Batch 12**

| Command              | Result                                                                                                                                                     |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`     | ✅ Pass                                                                                                                                                    |
| `pnpm lint`          | ✅ Pass                                                                                                                                                    |
| `pnpm format:check`  | ✅ Pass                                                                                                                                                    |
| `pnpm test`          | ✅ Pass, 327/327 (7 new)                                                                                                                                   |
| `pnpm test:coverage` | ✅ 95.32% statements / 90.57% branches / 100% functions / 98.8% lines — identical to Batch 11 (fixtures/tests add no new `engine/` source lines to cover). |
| `pnpm build`         | ✅ Pass                                                                                                                                                    |

---

### Batch 13 — Formula Regression Suite (M2-029)

| Task                                      | Status     | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M2-029 Implement Formula Regression Suite | ⚠️ Partial | `tests/fixtures/formulaCoverage.ts` (69-entry registry, one per documented Formula ID F-001–F-069) + `tests/unit/engine/formulaCoverage.test.ts` (73 tests: registry completeness, bidirectional cross-check against real `engine/` and `tests/` source text) + `tests/unit/engine/criticalRiskBoundaryRegression.test.ts` (13 new boundary/error tests for the liquidation-critical formulas). All 3 documented Requirements addressed; DoD satisfied under the reading explained below, not the fully literal one. |

**All 3 Requirements addressed:**

1. **"Every Formula ID has at least one normal test."** For all 36
   currently-implemented Formula IDs — enforced, not just asserted:
   `formulaCoverage.test.ts` scans every `.ts` file under `engine/` for the
   literal pattern `FORMULA_ID = 'F-0XX'` / `formulaId: 'F-0XX'`, scans
   every `.ts` file under `tests/unit/engine/` for any mention of each ID,
   and fails if an `'implemented'` registry entry is missing either. This
   makes "has a test" an executable, continuously-checked fact rather than
   a one-time claim.
2. **"Critical risk formulas have boundary and error tests."** Every
   liquidation-critical formula already had error-case tests from its own
   batch (rejecting negative/out-of-range inputs, zero-collateral,
   zero-debt) — `criticalRiskBoundaryRegression.test.ts` adds the boundary
   case those per-function suites didn't have: the exact point of
   liquidation, checked **across** Formula IDs rather than within just one
   (Health Factor = 1.0 exactly when BTC price = Liquidation Price;
   Liquidation Buffer = 0% at that same point; Distance to Liquidation = 0
   at HF = 1.0; Available Borrow = 0 exactly at Borrow Capacity, negative
   the instant it's exceeded; Health Factor accepts a threshold of exactly
   1.0 and rejects one a hair above it). All reuse already-implemented
   functions (F-012, F-013, F-022, F-023, F-024, F-025) — no new formula
   or tolerance was introduced.
3. **"Golden Reference results remain unchanged unless formally
   approved."** Already enforced by Batch 12's
   `goldenReferencePortfolios.test.ts`, which asserts exact locked values
   against the fixtures — cross-referenced, not duplicated, in the new
   test file's own header comment.

**DoD interpretation, stated explicitly (see conflict #15 below):** the
literal DoD text — "A formula coverage report identifies no untested
Version 1 Formula IDs" — would require testing all 69 documented Formula
IDs, but 33 of them have no implementation to test (`02_Formulas.md`
never assigns most a task, several give only a discrete example table or
an "iterative solver" with no closed-form equation, one — F-009 — is
never even defined). Implementing all 33 to satisfy the DoD literally
would mean inventing formulas, scoring models, and numerical solvers
nowhere specified — directly against this batch's own "never invent
formulas" instruction, and against the same discipline followed in every
prior batch. The DoD is instead satisfied as: **no Formula ID is silently
untested** — `formulaCoverage.test.ts` mechanically enforces that all 69
IDs are accounted for, each either genuinely tested (36) or explicitly
documented with a specific reason (33), and fails if either set drifts
without the registry being updated to match.

**Two findings refine, rather than contradict, prior batches' analysis:**

- **F-045 "Target Price Exit"** was never individually added to Batch 9's
  "unassigned Exit Strategy formulas" list (F-043, F-044, F-046, F-047,
  F-048, F-049) — it's mentioned only in passing in conflict #13's prose.
  Building the coverage registry surfaced this gap in the prior
  documentation itself: F-045 is now explicitly registered with its own
  precise reason (`06_TASKS.md` M2-024 does not treat "Target BTC price"
  as a standalone exit target type, and F-045's own equation is stated as
  solved only "iteratively," not as a closed form) — no code changed.
- **F-028 "Health Factor After Price Change"** and **F-029 "Protocol
  Safety Score"** had never been flagged in any prior batch — a genuine
  gap in the Risk Mathematics chapter's own coverage. F-028 turns out to
  be realized conceptually (same pattern as F-016): `simulatePriceScenario`
  (F-050, Batch 7) already computes exactly F-028's equation by calling
  `calculateHealthFactor` (F-022) with a scenario's new collateral value.
  F-029 is a genuine gap of the F-058/F-067 class: only a discrete
  7-point example lookup table is given, with no interpolation rule
  between points.

**Framework-independence**: re-audited after Batch 13 — still zero
React/Next.js/Zustand/Supabase/UI imports, no `@/...` alias usage inside
`engine/`. The registry and its tests live under `tests/`, use
`node:fs`/`node:path` (fine for test infrastructure, never imported by
`engine/` itself) and the `@/engine/...` alias as every other test file
does.

**Traceability audit (pre-commit)**: all 69 Formula IDs are accounted for
in the registry (36 implemented + 33 not-implemented = 69, mechanically
verified); every implemented ID is cross-checked bidirectionally against
real source text (nothing in the registry is stale in either direction);
the 13 new critical-risk boundary tests all reuse already-tagged,
already-implemented functions; no new public exports were needed since
M2-029 produces a test suite and a report, not new Engine functionality.

**Validation — Batch 13**

| Command              | Result                                                                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm typecheck`     | ✅ Pass                                                                                                                                                      |
| `pnpm lint`          | ✅ Pass                                                                                                                                                      |
| `pnpm format:check`  | ✅ Pass                                                                                                                                                      |
| `pnpm test`          | ✅ Pass, 413/413 (86 new)                                                                                                                                    |
| `pnpm test:coverage` | ✅ 95.32% statements / 90.57% branches / 100% functions / 98.8% lines — identical to Batch 12 (test-only additions, no new `engine/` source lines to cover). |
| `pnpm build`         | ✅ Pass                                                                                                                                                      |

---

### Batch 14 — Benchmark Engine Performance (M2-030)

| Task                                | Status     | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M2-030 Benchmark Engine Performance | ⚠️ Partial | `tests/performance/engineBenchmarks.test.ts` — 7 timed benchmarks covering all 6 of M2-030's named "Benchmark" items (2 for "Single scenario": price and position-change variants). No new Formula ID: M2-030 measures already-implemented functions' execution time, it doesn't compute anything new. "Partial" because 2 of the 6 named items had to be mapped onto the closest documented Build Guide category rather than a category matching their own name exactly — see below. |

**Targets sourced from `04_BUILD_GUIDE.md` specifically, per the DoD's own
wording** ("Calculations satisfy the performance targets defined in the
**Build Guide**"). `04_BUILD_GUIDE.md` states its Engine-benchmark numbers
identically in 3 separate places (Page 3's "PERFORMANCE TARGETS," the
later app-level "PERFORMANCE TARGETS," and the dedicated "PERFORMANCE
TESTS" section — "Benchmark critical calculations" / "Targets," the most
directly on-point one): **Single portfolio calculation < 10ms, Optimal
loop calculation < 20ms, Standard simulation < 50ms, Recommendation
evaluation < 20ms.** All 4 numbers are used verbatim; none is invented.

**Two gaps found while mapping M2-030's 6 named items onto these 4
categories** (see conflict #16 for the full writeup):

1. `02_Formulas.md` has its own, differently-numbered "PERFORMANCE
   TARGETS" section (Portfolio Calculation < 50ms, Scenario Simulation
   < 100ms — both looser than the Build Guide's < 10ms / < 50ms). Not
   used here, since the DoD names the Build Guide specifically, but
   flagged as a cross-document disagreement.
2. M2-030 names 6 targets (Portfolio summary, Health Factor, Liquidation
   calculations, Loop strategy, Single scenario, Scenario comparison) but
   the Build Guide only defines 4 categories — it has no line item for
   "Health Factor," "Liquidation calculations," or "Scenario comparison"
   specifically. "Health Factor" and "Liquidation calculations" are
   benchmarked against "Single portfolio calculation" (< 10ms) — both are
   steps in `02_Formulas.md`'s own FORMULA DEPENDENCY GRAPH chain
   starting at "Portfolio Value," the same chain "Portfolio summary"
   draws from. "Scenario comparison" is benchmarked against "Standard
   simulation" (< 50ms), the closest documented category — comparing two
   already-computed `ScenarioSummary` objects (no recomputation, per
   Batch 8's `compareScenarios` design) is if anything lighter-weight
   than running a full simulation, so this reuse is a conservative
   (not an invented) threshold choice.

**Methodology**: each benchmark uses a real Golden Reference Portfolio
(M2-028) as input — "representative inputs," per `04_BUILD_GUIDE.md`'s
own "PERFORMANCE TESTS" guidance — runs a warmup pass (20 iterations) to
avoid JIT-compilation skew, then measures the **median** of 200 timed
calls via `performance.now()`, rather than a single cold-start
measurement. All 7 benchmarks pass comfortably under their target (pure
`decimal.js` arithmetic on these input sizes runs in well under a
millisecond per call in practice), so no threshold needed loosening to
pass.

**Framework-independence**: re-audited after Batch 14 — still zero
React/Next.js/Zustand/Supabase/UI imports, no `@/...` alias usage inside
`engine/`. The new benchmark file lives under `tests/performance/` (a new
top-level test category, alongside `tests/unit/` and `tests/e2e/`,
signaling these are timing-sensitive rather than pure correctness tests)
and uses the `@/engine/...` alias like every other test file.

**Traceability audit (pre-commit)**: all 6 of M2-030's named benchmark
items have a corresponding timed test; every threshold traces to one of
the 4 numbers actually written in `04_BUILD_GUIDE.md`'s "PERFORMANCE
TESTS" section, with the 2 non-exact-name mappings explicitly documented
above and in the test file's own header comment; no new public exports
were needed since M2-030 produces a test suite, not new Engine
functionality.

**Validation — Batch 14**

| Command              | Result                                                                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm typecheck`     | ✅ Pass                                                                                                                                                      |
| `pnpm lint`          | ✅ Pass                                                                                                                                                      |
| `pnpm format:check`  | ✅ Pass                                                                                                                                                      |
| `pnpm test`          | ✅ Pass, 420/420 (7 new)                                                                                                                                     |
| `pnpm test:coverage` | ✅ 95.32% statements / 90.57% branches / 100% functions / 98.8% lines — identical to Batch 13 (test-only additions, no new `engine/` source lines to cover). |
| `pnpm build`         | ✅ Pass                                                                                                                                                      |

---

### Batch 15 — Publish Formula Engine API (M2-031)

| Task                              | Status  | Notes                                                                                                                                                                                                                                                                                                                                                                                                               |
| --------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M2-031 Publish Formula Engine API | ✅ Done | `engine/index.ts` curated (previously a re-export-everything barrel by its own prior header comment's admission) + `tests/unit/engine/publicApiSurface.test.ts` (69 new tests). All 4 Requirements addressed; DoD satisfied and directly demonstrated by an end-to-end test using only `@/engine` imports. No new Formula ID: M2-031 curates already-implemented, already-tagged exports — it computes nothing new. |

**All 4 Requirements addressed:**

1. **"Expose only supported public functions."** Every Formula-ID-tagged
   calculation, plus `rankScenarios` (explicitly Service/UI-facing per its
   own M2-022 DoD despite carrying no Formula ID), remains exported.
2. **"Hide internal helpers."** Two modules were removed from the barrel
   (still fully implemented, tested, and directly importable from their
   own file — nothing was deleted, only un-curated from the top-level
   entry point):
   - `engine/validation/invariants.ts`'s 5 check functions
     (`checkNetWorthInvariant` and siblings) — M2-027's own
     Description/DoD frame these as an automated **test**-time
     consistency check ("Invariant violations fail **tests**"), not a
     Service-facing calculation. Every existing consumer already imports
     them directly from `./validation/invariants`, never through the
     barrel — removing them from `engine/index.ts` broke nothing.
   - `engine/validation/validate.ts`'s validator functions
     (`validateNonNegative` and siblings) — internal plumbing every
     formula function already uses to build its own `FormulaResult`
     error; a Service never needs to pre-validate, since every formula
     call already validates and returns a structured error itself
     (01_PRD.md REQ-002). Confirmed (not assumed) by finding that
     `06_TASKS.md`'s own later Milestone 3/4 tasks ("Create Portfolio
     Validation Schemas," "Use Zod validation") establish a **separate**
     Zod-based schema layer for actual Service/UI-facing input
     validation — these granular Engine-internal validators were never
     meant to cross the Engine/Service boundary.
3. **"Export shared public types."** `PortfolioInput` and its component
   types, the full `FormulaResult`/`FormulaError`/`FormulaMetadata`/
   `FormulaWarning` contract, and every calculation's own result/params
   type remain exported.
4. **"Document each public operation."** Each export block now carries a
   one-line category comment (e.g. "Leverage & Loop Mathematics —
   F-012–F-015, F-018, F-037; M2-015–M2-018") naming its Formula ID range
   and source tasks, making `engine/index.ts` itself a legible index of
   the whole public surface — on top of each function's own existing,
   detailed Formula-ID doc comment in its own file, not a replacement for
   it.

**DoD directly demonstrated, not just claimed**:
`publicApiSurface.test.ts`'s last test runs a representative
Collateral Value → Health Factor → Recommendation pipeline using **only**
`import * as Engine from '@/engine'` — no internal module path — proving
"Application Services can use the Engine without importing internal
module files" rather than asserting it in prose.

**Judgment call, documented as conflict #17**: `06_TASKS.md` does not
enumerate which specific functions count as "internal helpers" — that
determination required interpreting each candidate against its own
task's Description/DoD framing (test-tooling vs. Service-facing
calculation) rather than a rule stated anywhere in the docs. See conflict
#17 for the full reasoning and the specific evidence (the Zod-schema
finding) that resolved the `validate.ts` case.

**Framework-independence**: re-audited after Batch 15 — still zero
React/Next.js/Zustand/Supabase/UI imports, no `@/...` alias usage inside
`engine/`.

**Traceability audit (pre-commit)**: no new Formula ID was introduced;
every previously-implemented Formula ID remains reachable and unchanged
(only re-export wiring moved); `publicApiSurface.test.ts` mechanically
verifies both the presence of every expected public export and the
absence of every hidden internal one, plus a full pipeline test proving
the DoD; no existing test broke from the curation (all 55 prior test
files already imported from specific submodule paths, never the barrel).

**Validation — Batch 15**

| Command              | Result                                                                                                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm typecheck`     | ✅ Pass                                                                                                                                                                              |
| `pnpm lint`          | ✅ Pass                                                                                                                                                                              |
| `pnpm format:check`  | ✅ Pass                                                                                                                                                                              |
| `pnpm test`          | ✅ Pass, 489/489 (69 new)                                                                                                                                                            |
| `pnpm test:coverage` | ✅ 95.32% statements / 90.57% branches / 100% functions / 98.8% lines — identical to Batch 14 (re-export wiring and test-only additions add no new `engine/` executable statements). |
| `pnpm build`         | ✅ Pass                                                                                                                                                                              |

---

### Batch 16 — Complete Formula Traceability Audit (M2-032) — FINAL MILESTONE 2 BATCH

| Task                                       | Status  | Notes                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------ | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M2-032 Complete Formula Traceability Audit | ✅ Done | Extended `tests/unit/engine/formulaCoverage.test.ts` (M2-029) with 2 new mechanical checks (110 tests total, up from 73) + the consolidated audit table below. One genuine documentation gap found and fixed (`engine/simulation/simulateInterestScenario.ts` — see below). No new Formula ID, no business-logic change: M2-032 is a verification task over the 36 already-implemented Formula IDs. |

**Per 06_TASKS.md's own 5-point checklist ("For every Formula ID
confirm..."), each mechanically verified — not just asserted in prose:**

1. **"Documentation exists."** New check: every `engine/` file that tags
   a Formula ID must also cite `02_Formulas.md` in its own doc comment
   (the established convention). **Found one violation**:
   `simulateInterestScenario.ts` (F-033) cited `06_TASKS.md M2-020`
   extensively but never wrote "02_Formulas.md" — a real gap this audit
   exists to catch. **Fixed** (doc comment only, no logic change): its
   header now explicitly reads "...realizing 02_Formulas.md F-033 'Debt
   Growth'..." Every other of the 36 implemented Formula IDs already
   passed this check without modification.
2. **"Canonical implementation exists."** Confirmed via
   `tests/fixtures/formulaCoverage.ts` (M2-029), re-verified this batch:
   36 Formula IDs implemented, each with exactly the equation
   `02_Formulas.md` documents (re-confirmed by re-reading each
   implementation's own doc comment against its source formula, not
   re-reading the whole spec from scratch).
3. **"Tests exist."** Already true (M2-029), re-confirmed unchanged.
4. **"Public output includes the correct Formula ID."** New, stricter
   check: `formulaCoverage.test.ts`'s prior check only confirmed a
   Formula ID was _mentioned_ somewhere in a test file (which a
   description string or comment alone would satisfy); this batch adds a
   check for the actual **runtime assertion**
   (`result.metadata.formulaId).toBe('F-0XX')`) specifically. All 36
   already had one — no gap found, but the claim is now mechanically
   enforced rather than merely likely.
5. **"Dependencies are known."** Every one of the 8 Formula IDs tagged in
   more than one file (F-014, F-018, F-030, F-033, F-037, F-040, F-042,
   F-061) was individually re-verified this batch (via direct source
   inspection, not assumed from memory) to share one computational core
   through a real function call — none duplicates its equation:
   `calculateLoopStep` calls `calculateLoopCapital` (F-014);
   `validateLoopStrategySafety` (F-018) takes an already-computed
   `LoopStrategyResult` rather than recomputing the loop;
   `calculateProratedInterest` reuses `calculateDailyInterest`'s shared
   `computeInterestForPeriod` helper (F-030);
   `simulateInterestScenario` calls `calculateDebtGrowth` (F-033);
   `calculateLoopCosts` calls `calculateBreakEvenAppreciation` (F-037);
   `calculateTargetExit` calls `calculateTargetDebt` (F-040);
   `calculateExitPosition` calls `calculateBtcSaleRequired` (F-042);
   `generateRecommendations` calls `calculateBorrowRecommendation`
   (F-061). The cross-Formula-ID sharing established in earlier batches
   (F-012/F-021 sharing `computeBorrowCapacity`; F-027 calling F-040's
   `calculateTargetDebt`) was also re-confirmed still holds.

**DoD ("No undocumented, duplicated, or untested Version 1 calculations
remain") — read consistently with conflict #15's established
"tracked vs. implemented" distinction**: "Version 1 calculations" means
the 36 Formula IDs actually implemented, not all 69 documented — the 33
unimplemented ones are documented _gaps_ with reasons, not calculations
requiring an audit trail. Under that reading, the DoD holds: zero of the
36 are undocumented (after the one fix above), zero duplicate their
equation (5-point check #5), and zero are untested (5-point checks #3/#4).

**Consolidated Formula Traceability Table** (all 36 implemented Formula
IDs; ✓ means mechanically verified by `formulaCoverage.test.ts`, not
manually claimed):

| Formula ID | Title                                | Canonical Implementation                                               | Reuses / Composed by                                                                          | Doc | Test | Metadata |
| ---------- | ------------------------------------ | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | :-: | :--: | :------: |
| F-001      | Portfolio Value                      | `engine/portfolio/calculatePortfolioValue.ts`                          | Reuses F-002                                                                                  |  ✓  |  ✓   |    ✓     |
| F-002      | Collateral Value                     | `engine/portfolio/calculateCollateralValue.ts`                         | —                                                                                             |  ✓  |  ✓   |    ✓     |
| F-003      | Debt Value                           | `engine/portfolio/calculateDebtValue.ts`                               | —                                                                                             |  ✓  |  ✓   |    ✓     |
| F-004      | Net Portfolio Value                  | `engine/portfolio/calculateNetWorth.ts`                                | Reuses F-001, F-003                                                                           |  ✓  |  ✓   |    ✓     |
| F-006      | Debt Ratio                           | `engine/portfolio/calculateDebtRatio.ts`                               | —                                                                                             |  ✓  |  ✓   |    ✓     |
| F-007      | Portfolio Gain                       | `engine/simulation/calculatePortfolioGain.ts`                          | —                                                                                             |  ✓  |  ✓   |    ✓     |
| F-010      | Exposure                             | `engine/portfolio/calculateExposure.ts`                                | Reuses F-002                                                                                  |  ✓  |  ✓   |    ✓     |
| F-011      | Effective Leverage                   | `engine/portfolio/calculateEffectiveLeverage.ts`                       | Reuses F-010, F-004                                                                           |  ✓  |  ✓   |    ✓     |
| F-012      | Borrow Capacity                      | `engine/loop/calculateBorrowCapacity.ts`                               | Shares core with F-021                                                                        |  ✓  |  ✓   |    ✓     |
| F-013      | Available Borrow                     | `engine/loop/calculateBorrowCapacity.ts`                               | Reuses F-012                                                                                  |  ✓  |  ✓   |    ✓     |
| F-014      | Loop Capital                         | `engine/loop/calculateLoopCapital.ts`                                  | Reused by `calculateLoopStep`                                                                 |  ✓  |  ✓   |    ✓     |
| F-015      | BTC Purchased Per Loop               | `engine/loop/calculateBtcPurchasedPerLoop.ts`                          | —                                                                                             |  ✓  |  ✓   |    ✓     |
| F-018      | Maximum Loop Count                   | `engine/loop/calculateLoopStrategy.ts`                                 | Composes F-014, F-015; validated by `validateLoopStrategySafety` (same ID, different concern) |  ✓  |  ✓   |    ✓     |
| F-020      | Loan-to-Value (LTV)                  | `engine/portfolio/calculateLoanToValue.ts`                             | —                                                                                             |  ✓  |  ✓   |    ✓     |
| F-021      | Maximum Borrow Limit                 | `engine/loop/calculateBorrowCapacity.ts`                               | Shares core with F-012                                                                        |  ✓  |  ✓   |    ✓     |
| F-022      | Health Factor                        | `engine/health/calculateHealthFactor.ts`                               | —                                                                                             |  ✓  |  ✓   |    ✓     |
| F-023      | Distance to Liquidation              | `engine/liquidation/calculateLiquidationDistance.ts`                   | Reuses F-022                                                                                  |  ✓  |  ✓   |    ✓     |
| F-024      | Liquidation Price                    | `engine/liquidation/calculateLiquidationPrice.ts`                      | —                                                                                             |  ✓  |  ✓   |    ✓     |
| F-025      | Liquidation Buffer                   | `engine/liquidation/calculateLiquidationBuffer.ts`                     | Reuses F-024                                                                                  |  ✓  |  ✓   |    ✓     |
| F-027      | Maximum Additional Debt              | `engine/health/calculateAdditionalBorrow.ts`                           | Reuses F-040                                                                                  |  ✓  |  ✓   |    ✓     |
| F-030      | Daily Interest                       | `engine/interest/calculateDailyInterest.ts`                            | Shared core reused by `calculateProratedInterest`                                             |  ✓  |  ✓   |    ✓     |
| F-031      | Monthly Interest                     | `engine/interest/calculateMonthlyInterest.ts`                          | Reuses F-030                                                                                  |  ✓  |  ✓   |    ✓     |
| F-032      | Annual Interest                      | `engine/interest/calculateAnnualInterest.ts`                           | —                                                                                             |  ✓  |  ✓   |    ✓     |
| F-033      | Debt Growth                          | `engine/simulation/calculateDebtGrowth.ts`                             | Reused by `simulateInterestScenario`                                                          |  ✓  |  ✓   |    ✓     |
| F-037      | Break-Even BTC Appreciation          | `engine/loop/calculateBreakEvenAppreciation.ts`                        | Reused by `calculateLoopCosts`                                                                |  ✓  |  ✓   |    ✓     |
| F-040      | Target Debt                          | `engine/exit/calculateTargetDebt.ts`                                   | Reused by F-027, `calculateTargetExit`                                                        |  ✓  |  ✓   |    ✓     |
| F-041      | Required Debt Repayment              | `engine/exit/calculateRequiredDebtRepayment.ts`                        | Reused by `calculateRepaymentRecommendation`                                                  |  ✓  |  ✓   |    ✓     |
| F-042      | BTC Sale Required                    | `engine/exit/calculateBtcSaleRequired.ts`                              | Reused by `calculateExitPosition`                                                             |  ✓  |  ✓   |    ✓     |
| F-050      | Price Change Simulation              | `engine/simulation/simulatePriceScenario.ts`                           | Composes F-002/F-003/F-004/F-020/F-022/F-023/F-007                                            |  ✓  |  ✓   |    ✓     |
| F-051      | Percentage Price Movement            | `engine/simulation/resolveScenarioPrice.ts`                            | Reused by F-050, `simulateInterestScenario`                                                   |  ✓  |  ✓   |    ✓     |
| F-052      | Portfolio Projection                 | `engine/simulation/simulatePositionChange.ts`                          | Composes F-002/F-003/F-004/F-020/F-022/F-023                                                  |  ✓  |  ✓   |    ✓     |
| F-053      | Scenario Difference                  | `engine/simulation/compareScenarios.ts`                                | —                                                                                             |  ✓  |  ✓   |    ✓     |
| F-061      | Borrow Recommendation                | `engine/recommendation/calculateBorrowRecommendation.ts`               | Reuses F-006, F-013, F-022; composed by `generateRecommendations` (same ID)                   |  ✓  |  ✓   |    ✓     |
| F-062      | Repayment Recommendation             | `engine/recommendation/calculateRepaymentRecommendation.ts`            | Reuses F-040, F-041, F-042                                                                    |  ✓  |  ✓   |    ✓     |
| F-063      | Additional Collateral Recommendation | `engine/recommendation/calculateAdditionalCollateralRecommendation.ts` | Derived from F-022's equation                                                                 |  ✓  |  ✓   |    ✓     |
| F-064      | Loop Recommendation                  | `engine/recommendation/calculateLoopRecommendation.ts`                 | Reuses F-014 (via `calculateLoopStep`), F-032                                                 |  ✓  |  ✓   |    ✓     |

**Framework-independence**: re-audited after Batch 16 — still zero
React/Next.js/Zustand/Supabase/UI imports, no `@/...` alias usage inside
`engine/`.

**Traceability audit (pre-commit)**: this batch's own work product **is**
the traceability audit — see the consolidated table above and the 5-point
checklist. All 110 `formulaCoverage.test.ts` tests pass, including the 2
new checks added this batch. No public exports changed (M2-032 verifies
and documents; it does not add or remove Engine functionality).

**Validation — Batch 16**

| Command              | Result                                                                                                                                                                 |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`     | ✅ Pass                                                                                                                                                                |
| `pnpm lint`          | ✅ Pass                                                                                                                                                                |
| `pnpm format:check`  | ✅ Pass                                                                                                                                                                |
| `pnpm test`          | ✅ Pass, 526/526 (37 new: 2 new `formulaCoverage.test.ts` checks × their `it.each` expansion)                                                                          |
| `pnpm test:coverage` | ✅ 95.32% statements / 90.57% branches / 100% functions / 98.8% lines — identical to Batch 15 (the one source change is a doc-comment edit, no executable statements). |
| `pnpm build`         | ✅ Pass                                                                                                                                                                |

**MILESTONE 2 — FORMULA ENGINE IS COMPLETE WITHIN THE DOCUMENTED VERSION
1 SCOPE.** That qualifier is deliberate, not boilerplate — stated
directly: "complete" here means every task and Formula ID that
`06_TASKS.md`/`02_Formulas.md` actually define for Version 1 has been
implemented, tested, and traced; it does **not** mean every formula
`02_Formulas.md` mentions exists in code, or that every ambiguity the
specification contains has been resolved. Three categories of
intentionally-not-implemented work remain **documented, not built**, and
none of them are omissions:

- **33 of the 69 documented Formula IDs are intentionally unimplemented**
  (`tests/fixtures/formulaCoverage.ts`, conflict #15) — no task assigns
  most of them, several give only a discrete example table or an
  unspecified "iterative solver" with no closed-form equation to
  implement, and one (F-009) is never defined at all anywhere in
  `02_Formulas.md`. Each has its own recorded reason; none was skipped
  silently.
- **2 tasks are formally blocked** (M2-013/M2-014 — no compound-interest
  formula exists anywhere in `02_Formulas.md` to implement against,
  conflict #7) — every downstream consumer was routed around the block
  using the documented simple-interest alternative instead of an invented
  compounding formula.
- **Multi-asset scenarios are out of scope** (conflict #5, `01_PRD.md`
  REQ-003's own "Version 0.1 assumes Bitcoin only" / "one stablecoin") —
  `PortfolioInput` models exactly one collateral asset and one debt asset;
  "Multiple collateral assets" and "Multiple debt assets" (2 of M2-028's
  7 named Golden Reference Portfolio cases) were documented as
  out-of-scope rather than built against an invented multi-asset model.

All 32 M2 tasks (M2-001 through M2-032) have been addressed: 30 fully or
partially done, 2 formally blocked as above. 17 unresolved documentation
conflicts remain open, carried forward as product/specification decisions
for whoever picks up Milestone 3 — several (#1 Health Factor risk bands,
#7 compound interest, #8 transaction costs, #9 Recommendation Engine
gaps) should likely be resolved before Milestone 3 builds UI/Services on
top of the Engine, since they affect what those layers can correctly
display or compute.

---

## Milestone 3 progress

### Batch 1 — Create Service Foundation (M3-001)

| Task                             | Status  | Notes                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M3-001 Create Service Foundation | ✅ Done | `services/{portfolio,market,protocol,simulation,loop,exit,recommendation,persistence,import,export,shared}/index.ts` + root `services/index.ts` — the exact 11-subdirectory tree M3-001's own "Include" code block specifies, plus the root entry point it lists alongside them. `tests/unit/services/serviceFoundation.test.ts` (14 tests) mechanically verifies both DoD sentences. |

**Scope, stated precisely**: M3-001 is structural only — "Create the
Service layer structure defined in the Build Guide," with a DoD about
entry points and dependency direction, not about any Service's actual
behavior. Nothing behavioral was invented to fill the empty directories;
each subdirectory's `index.ts` is a documented, intentionally empty
module (`export {};`) whose doc comment states which later, dependent
Milestone 3 task will build it, cross-referencing whichever
`04_BUILD_GUIDE.md` section already describes that Service's
responsibilities (`SERVICE RESPONSIBILITIES` for portfolio/simulation/
loop/exit/recommendation; the explicit `IMPORT / EXPORT DIRECTORY` file
tree for import/export). Two subdirectories — `market/` and `protocol/`
— have no responsibilities detailed anywhere in `04_BUILD_GUIDE.md`
beyond being named in `06_TASKS.md`'s own Milestone 3 Deliverables list
("Market Data Service implemented," "Protocol Parameter Service
implemented"); `persistence/` has no responsibilities detailed at all
yet. All three are left equally empty rather than having a responsibility
guessed for them.

**Naming note, not a conflict**: `04_BUILD_GUIDE.md`'s own "SERVICES
DIRECTORY" example list names a `PriceService` where `06_TASKS.md`'s
M3-001/Deliverables instead say "Market Data Service" / `market/`. Not
flagged as a specification conflict requiring a stop, since `06_TASKS.md`
— the document this task is drawn from — is unambiguous and internally
consistent about the name and folder; `04_BUILD_GUIDE.md`'s example list
reads as an earlier or looser naming pass, not a contradiction that
blocks this task.

**Dependency-direction check** (`04_BUILD_GUIDE.md` "DEPENDENCY RULES":
"Services → UI" is forbidden; only Services may import the Engine
directly): re-verified by the same grep-based technique
`engine/`'s own framework-independence checks used all through Milestone
2, applied to `services/` in the other direction — no file under
`services/` imports `react`, `next`, or `@/components`. `engine/` itself
was not touched by this batch; the only deletion is the now-redundant
`services/.gitkeep` placeholder from Milestone 1, superseded by real
files.

**Traceability audit (pre-commit)**: M3-001 introduces no Formula ID, so
the Milestone 2 Formula traceability apparatus doesn't apply — instead,
every one of the 11 named subdirectories and the root entry point from
M3-001's own "Include" tree was checked present, and
`serviceFoundation.test.ts` enforces both DoD sentences mechanically
(existence/importability of entry points; absence of forbidden imports)
rather than by inspection alone.

**Validation — Batch 1 (Milestone 3)**

| Command              | Result                                                                                                                                                                                        |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`     | ✅ Pass                                                                                                                                                                                       |
| `pnpm lint`          | ✅ Pass                                                                                                                                                                                       |
| `pnpm format:check`  | ✅ Pass                                                                                                                                                                                       |
| `pnpm test`          | ✅ Pass, 540/540 (14 new)                                                                                                                                                                     |
| `pnpm test:coverage` | ✅ 95.32% statements / 90.57% branches / 100% functions / 98.8% lines — unchanged from Milestone 2 (the new `services/` files are empty modules with no executable statements to instrument). |
| `pnpm build`         | ✅ Pass                                                                                                                                                                                       |

No Milestone 2 code (`engine/`, its tests, or its fixtures) was modified
by this batch.

---

### Batch 2 — Standard Service Result Model + Application Error Model (M3-002, M3-003)

**Batch scoping, decided before implementation**: M3-002 and M3-003 were
batched together (M3-004 deliberately excluded) because M3-003 formally
depends on M3-002, and M3-002's own "Errors" field is exactly what M3-003
defines — building the result model without the error model would leave
that field provisionally typed, then need revising the moment M3-003
landed. M3-004 (Portfolio Mapping Utilities) has no dependency on either
and is a different concern (data transformation between layers, not the
result/error contract), so it was left for a future batch rather than
included to pad this one's size. This scoping proposal, including the
architecture question below, was presented to and approved before any
code was written.

| Task                                        | Status  | Notes                                                                                                                                                                                                                                                               |
| ------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M3-002 Create Standard Service Result Model | ✅ Done | `services/shared/result.ts` — `ServiceResult<T>` discriminated union (`ServiceSuccess<T>` / `ServiceFailure`), covering exactly M3-002's "Include" list (Data, Warnings, Errors, Metadata → Source status, Calculation timestamp, Engine version, Formula version). |
| M3-003 Implement Application Error Model    | ✅ Done | `services/shared/errors.ts` — `ApplicationError` covering exactly the 9 documented categories (Validation, Calculation, Persistence, Provider, Authentication, Synchronization, Import, Export, Unknown).                                                           |

**Architecture decision (approved before implementation, not defaulted
on silently)**: `ServiceResult<T>` reuses the Engine's own
`FormulaResult<T>` discriminated-union shape (`{ok:true}` / `{ok:false}`)
rather than a single envelope with nullable `data`/`errors` fields. This
was flagged as a genuine ambiguity before writing any code — M3-002's
"Include" list names `Data`, `Warnings`, `Errors`, and `Metadata` in a
way compatible with either design, and `04_BUILD_GUIDE.md` never
elaborates the exact shape. The discriminated union was chosen because
it reuses a convention already proven across all 45 Engine functions,
keeps the codebase consistent, and avoids introducing partial-success
semantics (simultaneous `data` and `errors`) that no document defines.

**One deliberate, literal departure from the Engine's own naming**:
`ServiceFailure.errors` is plural (an `ApplicationError[]`), unlike the
Engine's singular `FormulaFailure.error`. This follows M3-002's own
"Include" list, which names "Errors" (plural) — and is substantively
justified, not just literal: a Service call can legitimately aggregate
more than one validation failure at once (e.g. two missing fields),
whereas an atomic Engine formula call always fails on the first invalid
input it checks.

**Two specification gaps found, both resolved by explicit instruction
rather than invention — see conflicts #18 and #19**:

- **"Source status"** (`ServiceMetadata.sourceStatus`) is named exactly
  once in the entire specification, with no documented enum or value
  domain anywhere. Typed as a plain `string` rather than a literal
  union — no taxonomy was invented.
- **"Formula version" aggregation** across a Service call that composes
  multiple Engine functions (e.g. the future Portfolio Summary Service,
  M3-005) is out of scope for M3-002, which only defines the per-call
  metadata shape. Explicitly deferred, not solved provisionally.

`ServiceMetadata.engineVersion` is not a separately hardcoded constant:
`CreateServiceResultOptions.engineVersion` is a required input a future
Service must supply from the real `FormulaResult.metadata.engineVersion`
it actually received from the Engine, avoiding a second version string
that could drift out of sync with the Engine's own (private,
unexported) `ENGINE_VERSION`.

**Dependency-direction and architecture audit**: re-verified (not
assumed) that `services/` still imports no `react`, `next`, or
`@/components` path — the same check `serviceFoundation.test.ts`
established in Batch 1, now covering real code instead of empty
placeholders. `services/shared/result.ts` and `errors.ts` import nothing
from `engine/` (this batch introduces no Engine calls at all — that
begins with M3-004/M3-005). No Milestone 2 file was modified.

**Traceability audit (pre-commit)**: both public entry points
(`createServiceSuccess`, `createServiceFailure`, `createApplicationError`,
plus every exported type) are reachable through `@/services` alone,
verified by `tests/unit/services/publicApiSurface.test.ts` — the same
"prove the DoD, don't just assert it" pattern used throughout Milestone
2's own `publicApiSurface.test.ts`. All 9 `ApplicationErrorCategory`
values are individually asserted constructible; both `ServiceResult<T>`
variants are asserted to genuinely lack the other variant's field
(`'errors' in result` is `false` on success; `'data' in result` is
`false` on failure) — a direct, mechanical check that the discriminated
union is real, not just typed as one while behaving like an envelope.

**Validation — Batch 2 (Milestone 3)**

| Command              | Result                                                                                                                                                                              |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`     | ✅ Pass                                                                                                                                                                             |
| `pnpm lint`          | ✅ Pass                                                                                                                                                                             |
| `pnpm format:check`  | ✅ Pass                                                                                                                                                                             |
| `pnpm test`          | ✅ Pass, 563/563 (23 new)                                                                                                                                                           |
| `pnpm test:coverage` | ✅ 95.34% statements / 90.59% branches / 100% functions / 98.81% lines — a slight improvement over Milestone 2's baseline (the new `services/shared/` code is fully, 100%-covered). |
| `pnpm build`         | ✅ Pass                                                                                                                                                                             |

No Milestone 2 code (`engine/`, its tests, or its fixtures) was modified
by this batch.

### Batch 3 — Portfolio Mapping Utilities (M3-004)

**Batch scoping, decided before implementation**: M3-004 was implemented
alone. It has no dependency on M3-005 (Portfolio Summary Service, the
first major Service-to-Engine calculation integration) — combining the
two would mix a data-transformation concern with a calculation concern.
This scoping proposal, including the dependency sketch below, was
presented to and approved before any code was written.

**Dependency sketch (`UI → Services → Engine`)**: nothing in the UI
layer calls this batch's code yet (no consuming component exists before
Milestone 4/5). Within Services, `services/portfolio/mapping.ts` is the
new leaf: it imports only `services/shared/errors.ts` (M3-003, for
`ApplicationError`) and `@/engine`'s published `PortfolioInput` type
(M2-002/M2-031) — it introduces no dependency on any other Service
subdirectory. `services/portfolio/models.ts` imports only `@/engine`'s
published domain types. Both stay one-directional: Services → Engine,
never the reverse, and neither imports React, Next.js, Zustand, or
`@/components`.

| Task                                         | Status  | Notes                                                                                                                                                                                                                                                             |
| -------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M3-004 Implement Portfolio Mapping Utilities | ✅ Done | `services/portfolio/models.ts` (persistence and application Portfolio shapes) + `services/portfolio/mapping.ts` (`mapPersistencePortfolioToApplicationPortfolio`, `mapApplicationPortfolioToEngineInput`), covering M3-004's 4 Requirements and its DoD directly. |

**Specification finding: a reverse dependency, not a missing one**.
`06_TASKS.md` lists M4-001 ("Define Application-Layer Portfolio Models")
as a later task, which might suggest M3-004 should build on top of it.
Reading M4-001's own text shows the opposite: **M4-001 depends on
M3-004**, not the other way around. So neither a persistence schema nor
a full application-layer Portfolio model is formally defined anywhere in
the specification at the point M3-004 is built. Resolved, per explicit
instruction, by building the smallest Engine-aligned shape that
satisfies M3-004's own Requirements and DoD — `ApplicationPortfolio`
reuses `@/engine`'s own `CollateralPosition`/`DebtPosition`/
`MarketPrices`/`ProtocolParameters` types directly (collateral, debt,
market, protocol only) — and explicitly **not** pre-inventing M4-001's
later identity, name, description, base-currency, settings, or
created/updated-timestamp fields. `services/portfolio/models.ts`
documents this in place so M4-001's implementer sees it immediately.

**Design decision: `MappingResult<T>`, not `ServiceResult<T>`**. This
batch introduces a third discriminated-union result type
(`services/portfolio/mapping.ts`), deliberately distinct from M3-002's
`ServiceResult<T>`. Reasoning: `ServiceResult`'s `ServiceMetadata`
(`engineVersion`, `formulaVersion`, `calculationTimestamp`) describes an
Engine _calculation_ — and M3-004's mapping functions perform none, they
only reshape data between layers. Forcing an `engineVersion` value onto
a mapping operation that never calls the Engine would mean fabricating a
value with no real source (the Engine's own `ENGINE_VERSION` constant is
intentionally unexported, per Milestone 2 Batch 15's public-API
curation). `MappingResult<T>` reuses `ApplicationError` (M3-003) for its
error shape rather than inventing a new error vocabulary, so a future
Service that calls this mapping (M3-005 onward) can pass a mapping
failure's `errors` array straight into a real `ServiceResult` failure at
the point it actually has genuine Engine metadata to report. This was a
judgment call made without a prior dedicated approval round (unlike the
M3-002 `ServiceResult` decision, which was raised as an explicit
pre-implementation question) — flagged here for visibility rather than
folded in silently, and reviewed and **explicitly approved** afterward.

**Architectural review (post-implementation, pre-commit)**: asked to
justify `MappingResult<T>` against three alternatives before approval —
(1) reusing `ServiceResult<T>` as-is, (2) making `ServiceMetadata`
optional on `ServiceResult<T>` instead of introducing a new type, and
(3) whether a third success/failure abstraction is simply one too many.
Reasoning, in summary: `ServiceMetadata`'s fields are a provenance claim
("this came from a real Engine calculation, just now"), and a mapping
operation that never calls the Engine cannot make that claim truthfully
— populating it would mean fabricating values. Optional metadata on
`ServiceResult<T>` was rejected because it would spread defensive
null-checking across every existing and future consumer of the Service
layer's primary result type, to accommodate a minority (non-calculation)
use case, rather than confining the difference to one narrowly-scoped
type. `MappingResult<T>` is not a parallel invented design — it is
`ServiceResult<T>`'s `{ok, data}` / `{ok, errors}` shape with the
provenance fields removed entirely, reusing `ApplicationError` from
M3-003. **Approved.** Future mapping utilities (Market Data, Protocol
Parameters, Import/Export) are expected to reuse this same type; it
should be promoted from `services/portfolio/mapping.ts` to
`services/shared/` the first time a second mapping utility needs it,
rather than moved preemptively now with only one consumer.

**"Validate required fields" implementation note**: validation happens
only at the persistence → application boundary
(`mapPersistencePortfolioToApplicationPortfolio`), where data may
legitimately be missing (a legacy record, a partially-filled draft, a
malformed import). `mapApplicationPortfolioToEngineInput` is infallible
by construction — every field of a valid `ApplicationPortfolio` is
already an Engine-compatible type, so there is nothing left to check.
Every field-level problem is aggregated into one `ApplicationError[]`
rather than stopping at the first (mirroring `ServiceFailure.errors`'
plural design from M3-002/M3-003) — verified directly by
`tests/unit/services/portfolio/mapping.test.ts`'s "aggregates every
field-level error" case, which supplies a fully-empty persistence
Portfolio and asserts all 9 expected error codes are present at once.

**"Avoid unsafe type casting" implementation note**: no `as` cast
appears anywhere in `mapping.ts`. Every value used in a constructed
object comes from a small typed helper (`readRequiredNumber`,
`readRequiredNonEmptyString`) whose own return type (`T | undefined`)
already proves validity to the compiler — chosen over relying on
multi-statement optional-chaining narrowing, which TypeScript does not
reliably preserve across separate statements. The one literal-type field
(`collateral.asset: 'BTC'`) is never read back from the validated input;
the returned object hardcodes the `'BTC'` literal directly, since by
that point in the function the only way execution reaches it is if the
source value already equaled `'BTC'`.

**Dependency-direction and architecture audit**: re-verified that
`services/` still imports no `react`, `next`, or `@/components` path.
`services/portfolio/mapping.ts` and `models.ts` import only from
`@/engine` (published types only, no deep `engine/` submodule imports)
and `services/shared/errors.ts` — no dependency on any other Service
subdirectory. No Milestone 2 file (`engine/`, its tests, or its
fixtures) was modified by this batch. `mapApplicationPortfolioToEngineInput`
reads exactly the 4 Engine-relevant fields and nothing else, satisfying
M3-004's DoD ("Portfolio data can move between layers without leaking
persistence-specific structures into the Engine") by construction —
verified by `mapping.test.ts`'s "drops unrelated fields" case, which
passes an object with extra `name`/`id` fields and asserts the Engine
input contains only `collateral`/`debt`/`market`/`protocol`.

**Traceability audit (pre-commit)**: both public mapping functions and
every exported type from `services/portfolio/` are reachable through
`@/services` alone, verified by a new `describe` block in
`tests/unit/services/publicApiSurface.test.ts` (M3-004), following the
same "prove the DoD, don't just assert it" pattern used throughout
Milestone 2 and Milestone 3 Batch 2. Both `MappingResult<T>` variants
are asserted to genuinely lack the other variant's field (`'data' in
result` is `false` on failure; `'errors' in result` is `false` on
success).

**Validation — Batch 3 (Milestone 3)**

| Command              | Result                                                                                                                                                                                          |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`     | ✅ Pass                                                                                                                                                                                         |
| `pnpm lint`          | ✅ Pass (after autofix of export ordering in `services/portfolio/index.ts`)                                                                                                                     |
| `pnpm format:check`  | ✅ Pass (after Prettier formatting of `services/portfolio/models.ts` and its test file)                                                                                                         |
| `pnpm test`          | ✅ Pass, 591/591 (28 new)                                                                                                                                                                       |
| `pnpm test:coverage` | ✅ 95.54% statements / 91.2% branches / 100% functions / 98.86% lines — the new `services/portfolio/` code is fully, 100%-covered (it does not appear as a partial-coverage row in the report). |
| `pnpm build`         | ✅ Pass                                                                                                                                                                                         |

No Milestone 2 code (`engine/`, its tests, or its fixtures) was modified
by this batch.

### Batch 4 — Portfolio Summary + Action Preview Services (M3-005, M3-006)

**Batch scoping, decided before implementation**: `06_TASKS.md` lists
M3-006 as formally depending on M3-005, and re-reading both together
(per instruction) confirmed the coupling is functional, not just
declared: M3-006's DoD — "each preview returns before-and-after values
and does not mutate the original portfolio" — is exactly the "snapshot,
apply change, snapshot again" pattern `engine/simulation/simulatePositionChange.ts`
(M2-021) already uses one layer down, for collateral/debt deltas
specifically. M3-006 is `calculatePortfolioSummary` called twice around
a pure portfolio transformation, not an independent calculation.
Building them apart risked designing M3-005's summary shape without
knowing the one real consumer that needs to run it twice and diff the
results. This cohesion finding, the dependency sketch, and four flagged
specification points (below) were presented and approved before any code
was written.

| Task                                              | Status  | Notes                                                                                                                                                                                             |
| ------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M3-005 Implement Portfolio Summary Service        | ✅ Done | `services/portfolio/summary.ts` — `calculatePortfolioSummary`, composing 10 public Engine functions into one `ServiceResult<PortfolioSummary>`, covering M3-005's "Include" list field-for-field. |
| M3-006 Implement Portfolio Action Preview Service | ✅ Done | `services/portfolio/actionPreview.ts` — `previewPortfolioAction`, applying a `PortfolioAction` to derive a hypothetical portfolio and calling `calculatePortfolioSummary` twice (before/after).   |

**Four points flagged before implementation, all approved as proposed**:

1. **`sourceStatus` is caller-supplied, never fabricated.** Neither
   Service has any way to know whether the market price it's summarizing
   is live or manual — that belongs to Market Data Service (M3-007, not
   yet built). Both `calculatePortfolioSummary` and
   `previewPortfolioAction` take `sourceStatus: string` as an explicit
   parameter rather than hardcoding a placeholder like `'unknown'`,
   extending the same "no fabricated metadata" principle M3-002
   established for `engineVersion`.
2. **Conflict #19 (formula-version aggregation) — approved checked
   stopgap, explicitly not a resolution.** M3-005 is the first Service
   composing multiple Engine calls (10, in one summary).
   `calculatePortfolioSummary` takes the first successful call's
   `engineVersion`/`formulaVersion` and checks every subsequent call
   against it; a real mismatch (impossible today — every public Engine
   function reports `formulaVersion: '1.0'`) returns a
   `ServiceFailure` (`FORMULA_VERSION_MISMATCH`) instead of silently
   picking one. Conflict #19 stays open in this document — this is a
   checked stopgap under today's data, not an aggregation algorithm.
3. **"Interest cost" interpreted as Annual Interest (F-032).**
   `06_TASKS.md`'s M3-005 "Include" list does not say which of the four
   interest formulas (Daily/Monthly/Annual/Prorated) is "the" cost
   figure. Annual was chosen because it pairs directly with `borrowApr`
   (already an annual rate on the portfolio) and is a point-in-time
   figure like every other summary field. Documented interpretation, not
   an invented formula.
4. **`PortfolioAction` — minimal, six named actions only, no
   extensibility.** `06_TASKS.md` names six actions with no interface of
   its own. The approved shape is a discriminated union with exactly one
   variant per named action, each carrying only its own parameter
   (`addCollateral`/`withdrawCollateral`: `quantity`;
   `borrow`/`repay`: `amount`; `changeMarketPrice`: `btcPriceUsd`;
   `changeProtocolParameters`: a full `ProtocolParameters` replacement,
   not a partial patch, since no field-level override semantics are
   documented anywhere to invent).

**"Liquidation information" bundled as one field, not itemized** — M3-005's
Include list names it as a single bullet. `PortfolioSummary.liquidation`
groups the three already-public liquidation formulas
(`calculateLiquidationPrice`/`Distance`/`Buffer`, F-024/F-023/F-025)
under one object — a structural grouping of existing formulas under the
label 06_TASKS.md already uses, not a new one.

**`applyAction` duplicates no Engine validation.** It is a pure data
transform (no Engine call, same category as M3-004's mapping functions)
— it does not check whether a withdrawal or repayment exceeds what the
portfolio holds. `calculateCollateralValue`/`calculateDebtValue` already
reject a negative `quantity`/`balance` via `validateTokenQuantity`, so an
over-withdrawal or over-repayment surfaces naturally as a
`ServiceFailure` (`INVALID_NON_NEGATIVE`) when the "after" summary is
computed. Verified directly by `actionPreview.test.ts`'s over-withdrawal
and over-repayment cases.

**Sequential dependency, not independent-field validation (unlike
M3-004).** Every metric in `calculatePortfolioSummary` after
Collateral/Debt Value consumes an already-computed value from an earlier
step (e.g. LTV needs Debt Value and Collateral Value). Unlike
`mapPersistencePortfolioToApplicationPortfolio`'s four independent
fields, these calculations genuinely depend on each other, so
`calculatePortfolioSummary` fails fast on the first Engine failure and
returns a single error — mirroring
`engine/simulation/simulatePositionChange.ts`'s own `computeSnapshot`
helper, which composes the same kind of dependent metric chain at the
Engine layer.

**New finding, documented as conflict #20**: `calculatePortfolioSummary`
cannot summarize a zero-debt portfolio. `calculateHealthFactor` (F-022)
succeeds for zero debt (returns `Infinity` with a `NO_DEBT` warning, a
deliberate Milestone 2 design), but `calculateLiquidationPrice` (F-024)
treats a zero-debt liquidation price as undefined and returns a
`FormulaFailure` (`NOT_APPLICABLE_NO_DEBT`) — so a debt-free BTC deposit
(a valid economic state) cannot get a Portfolio Summary today. This is
inherited Engine behavior, not something introduced here, and no
fallback value (e.g. `null` or `Infinity` for `liquidation.price`) was
invented to paper over it, per "never invent business rules." Verified
directly by `summary.test.ts`'s zero-debt cases. See conflict #20 below.

**Dependency-direction and architecture audit**: re-verified that
`services/` still imports no `react`, `next`, or `@/components` path.
`services/portfolio/summary.ts` imports only `@/engine` (published
functions/types) and `services/shared/`/`services/portfolio/mapping.ts`
and `models.ts`; `services/portfolio/actionPreview.ts` imports only
`@/engine` (type only), `services/shared/result.ts`,
`services/portfolio/models.ts`, and `services/portfolio/summary.ts` —
neither imports any other Service subdirectory (`market/`, `protocol/`,
etc.). No `engine/` file was modified by this batch.

**Traceability audit (pre-commit)**: `calculatePortfolioSummary` and
`previewPortfolioAction`, plus every exported type from both new files,
are reachable through `@/services` alone, verified by a new `describe`
block in `tests/unit/services/publicApiSurface.test.ts` (M3-005,
M3-006). Every Formula ID this batch relies on (F-002, F-003, F-004,
F-011, F-020, F-022, F-023, F-024, F-025, F-032) was already implemented
and traced in Milestone 2 — this batch composes existing public Engine
functions and claims no new Formula ID.

**Validation — Batch 4 (Milestone 3)**

| Command              | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`     | ✅ Pass                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `pnpm lint`          | ✅ Pass (after autofix of import ordering in `services/portfolio/summary.ts` and its test file)                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `pnpm format:check`  | ✅ Pass (after Prettier formatting of both new test files)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `pnpm test`          | ✅ Pass, 616/616 (25 new)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `pnpm test:coverage` | ✅ 95.04% statements / 90.32% branches / 100% functions / 98.73% lines. `summary.ts` is 87.5%/71.42% — the one uncovered branch is `FORMULA_VERSION_MISMATCH` (conflict #19's stopgap check), genuinely unreachable today since every public Engine function reports `formulaVersion: '1.0'`; kept for defense in depth, the same pattern already used in `engine/simulation/simulatePositionChange.ts`'s own documented unreachable branches. No coverage threshold is configured in `vitest.config.ts`, so this does not fail the pipeline. |
| `pnpm build`         | ✅ Pass                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

No Milestone 2 code (`engine/`, its tests, or its fixtures) was modified
by this batch.

### Batch 5 — Market Data Service (M3-007)

**Batch scoping, decided before implementation**: M3-007 and M3-008
(Protocol Parameter Service) both depend only on M3-002, not on each
other — no formal or functional dependency links them, unlike
M3-002/M3-003 (a real field dependency) or M3-005/M3-006 (a real "call
twice" dependency). They live in separate Service subdirectories
(`services/market/` vs `services/protocol/`) covering genuinely distinct
domains. Sharing a topical pattern ("data provenance") is not the same
kind of cohesion that justified prior groupings, so M3-007 was
implemented alone, the same call made for M3-004.

**Major finding, presented and approved before implementation**:
`04_BUILD_GUIDE.md`'s "PRICE SERVICE" / "PROTOCOL SERVICE" sections
describe a full external-integration design — a `PriceProvider`
interface, a CoinGecko adapter, an `infrastructure/` directory
(`infrastructure/pricing/CoinGeckoProvider.ts`, etc.), API client
timeout/retry/caching, Zod response validation, environment variables —
that **no task in `06_TASKS.md` ever assigns**. `06_TASKS.md` never
mentions `infrastructure/`, `PriceProvider`, `ProtocolProvider`,
`CoinGecko`, or `PriceQuote`, and no task before M3-007 (including
M1-003, which enumerated the directory tree actually built) creates an
`infrastructure/` directory; the repository has none today. Per explicit
instruction, this batch builds **only** the Service-layer normalization
logic — no `infrastructure/`, no provider adapters, no HTTP client, no
CoinGecko/Aave integration, no caching layer, no retry logic, no
environment variables, no network code.

| Task                                 | Status  | Notes                                                                                                                                                                                                  |
| ------------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| M3-007 Implement Market Data Service | ✅ Done | `services/market/quote.ts` — `normalizeMarketQuote`, classifying candidate prices by the documented freshness rule and picking one by the documented fallback order. No network, no Engine dependency. |

**Two rules implemented verbatim from `04_BUILD_GUIDE.md`, not
invented**:

- **Price Freshness** ("PRICE FRESHNESS"): Fresh — updated within 5
  minutes. Stale — older than 5 minutes. Unavailable — no valid price
  exists. "When price data is stale: display a warning, continue
  calculations only after clearly labeling the data as stale." "When
  price data is unavailable: use manual input or the last confirmed
  value. Do not silently invent a price."
- **Service Fallback Order** ("SERVICE FALLBACK ORDER", prices): Live
  provider → Last valid cached value → Manual input. "Every fallback
  must be visible to the user."

**Approved design implemented as specified**: `PriceFreshness = 'fresh'
| 'stale' | 'unavailable'`, `PriceOrigin = 'provider' | 'cache' |
'manual'`, both owned by `MarketQuote`. `ServiceResult`/`ServiceMetadata`
(M3-002/M3-003) were not modified.

**`MarketQuote` is a discriminated union on `freshness`, returned inside
`MappingResult<T>`, not `ServiceResult<T>`.** `normalizeMarketQuote`
makes no Engine call, so it has the identical "no real
`engineVersion`/`formulaVersion` to report" problem M3-004's mapping
functions already solved — reusing `MappingResult<T>` rather than
fabricating Engine provenance metadata. "No valid price exists" is
modeled as a **successful** `MarketQuoteUnavailable` result (a
legitimate domain state — the Service correctly determined there is no
price, it did not fail to compute one), the same way
`engine/health/calculateHealthFactor.ts` treats zero debt as a
successful `Infinity` rather than an error. `MappingFailure` is reserved
for genuinely malformed input (a non-finite/non-positive price, an
unparseable timestamp) — data integrity problems, not "no price
available." No separate `ServiceWarning`-style channel was added for
"stale must be labeled" or "fallback must be visible": both are already
visible directly on the returned `MarketQuote` (`freshness === 'stale'`,
`origin !== 'provider'`), so a future caller can act on them without a
parallel warnings array repeating the same information.

**Structural decision: `MappingResult<T>` relocated to
`services/shared/mappingResult.ts`.** M3-004's own write-up (Batch 3)
named the promotion trigger explicitly: "the first time a second mapping
utility needs it." `normalizeMarketQuote` is that second utility. The
type definition moved from `services/portfolio/mapping.ts` to
`services/shared/mappingResult.ts`; `mapping.ts` now re-exports the same
three names from the new location, so M3-004's already-committed public
API (`@/services`) is unchanged — verified by `mapping.test.ts` (Batch
3's tests) continuing to pass unmodified. This is a mechanical
relocation, not a semantic or contract change, so it was made directly
rather than raised as a separate pre-approval question — it was already
anticipated and documented in Batch 3.

**Dependency-direction and architecture audit**: re-verified that
`services/` still imports no `react`, `next`, or `@/components` path.
`services/market/quote.ts` imports only `services/shared/errors.ts` and
`services/shared/mappingResult.ts` — no `@/engine` import at all (Market
Data Service performs no calculation), and no dependency on any other
Service subdirectory. Grepped the new files for `fetch(`, `axios`,
`XMLHttpRequest`, `process.env`, and `infrastructure` as directory
references — none found outside doc comments explaining what was
deliberately not built. No `engine/` file was modified by this batch.

**Traceability audit (pre-commit)**: `normalizeMarketQuote` and every
exported type from `services/market/` are reachable through `@/services`
alone, verified by a new `describe` block in
`tests/unit/services/publicApiSurface.test.ts` (M3-007). This batch
introduces no Formula ID and makes no Engine claim.

**Validation — Batch 5 (Milestone 3)**

| Command              | Result                                                                                                                                                                            |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`     | ✅ Pass (after narrowing `MarketQuote`'s discriminated union on `freshness`, not just `ok`, in tests that read `origin`/`price`)                                                  |
| `pnpm lint`          | ✅ Pass (after autofix of import ordering in the new test file, and removing two now-unused type imports in `services/portfolio/mapping.ts` after the `MappingResult` relocation) |
| `pnpm format:check`  | ✅ Pass (after Prettier formatting of `services/market/quote.ts`, `services/shared/index.ts`, and the new test file)                                                              |
| `pnpm test`          | ✅ Pass, 636/636 (20 new)                                                                                                                                                         |
| `pnpm test:coverage` | ✅ 95.17% statements / 90.62% branches / 100% functions / 98.77% lines — `services/market/` is fully, 100%-covered (it does not appear as a partial-coverage row).                |
| `pnpm build`         | ✅ Pass                                                                                                                                                                           |

No Milestone 2 code (`engine/`, its tests, or its fixtures) was modified
by this batch.

### Batch 6 — Simulation + Recommendation Services (M3-009, M3-012)

**Batch scoping — chosen deliberately smaller than "all four ready
tasks," reasoning stated before implementation**: with M3-005 done, five
tasks became simultaneously ready: M3-008 (Protocol Parameter Service —
depends only on M3-002) and M3-009/M3-010/M3-011/M3-012 (Simulation,
Loop Strategy, Exit Planning, Recommendation — each depends only on
M3-005 plus a completed Milestone 2 module). `06_TASKS.md`'s own M3-014
("Create Service Integration Tests") depends on "M3-005 through M3-012"
as one range, textual evidence that the specification treats these as
one phase. M3-008 was excluded because it is architecturally a
data-provider Service (like M3-007), not a calculation-coordinator
Service like the other four — combining it would pad the batch without
real cohesion, the same distinction that kept M3-007 and M3-008 apart.

Of the remaining four coordinator Services, M3-010 (Loop Strategy) and
M3-011 (Exit Planning) were deliberately left for a **separate** batch:
reading their Engine dependencies surfaced that both are entangled with
pre-existing, already-documented Milestone 2 conflicts — M3-010's "Apply
cost assumptions" responsibility runs directly into conflict #8
(swap-fees/slippage/gas-estimate formula gap), and M3-011's exit
calculations touch conflicts #10 (ambiguous "target cash proceeds"
mechanics) and #13 (F-040's known exit-collateral-sale approximation).
Folding four large, conflict-dense tasks into one batch risked a
proposal and implementation too tangled to review cleanly. M3-009
(Simulation) and M3-012 (Recommendation) do not touch any open conflict
directly, so they were implemented together as this batch; M3-010 and
M3-011 are deferred to a batch where those specific conflicts can get
focused attention.

| Task                                    | Status  | Notes                                                                                                                                                                                 |
| --------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M3-009 Implement Simulation Service     | ✅ Done | `services/simulation/scenario.ts` — `simulateScenario`, coordinating price and interest scenarios against an "attached" M3-005 baseline, returning a `compareScenarios`-ready result. |
| M3-012 Implement Recommendation Service | ✅ Done | `services/recommendation/recommendations.ts` — `generateRecommendationSet`, wrapping `generateRecommendations` (M2-025/M2-026) with Decision-Priority ranking.                        |

**M3-009 scope: price and interest scenarios only, not position-change.**
`engine/simulation/simulatePositionChange.ts` (M2-021) is public and
exists, but forcing it into the same `ScenarioSummary` shape M2-022's
`compareScenarios`/`rankScenarios` use would require inventing a "profit
or loss" meaning for a deliberate capital contribution (adding
collateral raises net equity by exactly the contributed amount — that
is not profit). Position-change previewing is already M3-006's job
(`previewPortfolioAction`), which correctly has no `profitOrLoss`
concept at all. Excluding it here avoids inventing one; documented in
`scenario.ts`'s own header comment.

**"Attach current portfolio baseline" reuses `calculatePortfolioSummary`
(M3-005) directly**, the same reuse pattern M3-006 already established —
not a new architectural decision, but its first use _across_ Service
subdirectories (`services/simulation/` importing from
`services/portfolio/`) rather than within one. No rule prohibits
Service-to-Service composition (only "Only services communicate
directly with the Formula Engine" governs the Engine boundary); reusing
an already-built, already-tested Service function is preferable to
re-deriving equivalent portfolio metrics a second way. `services/recommendation/recommendations.ts`
does the same, more narrowly — reusing `mapApplicationPortfolioToEngineInput`
(M3-004) for its own portfolio-to-Engine-input conversion rather than
duplicating that mapping.

**Field completion per scenario type, not reimplementation.** Neither
`simulatePriceScenario` nor `simulateInterestScenario` returns every
field `ScenarioSummary` needs (`leverage` is never included by either;
`simulateInterestScenario` also omits `liquidationDistance` and
`profitOrLoss`). Rather than recomputing those functions' own logic
through a different composition path, `simulateScenario` calls the
documented M2-019/M2-020 functions directly for the fields they provide
(preserving their own Formula IDs, validation, and warnings) and
supplements only the missing fields with additional already-public
Engine calls (`calculateEffectiveLeverage`, `calculateLiquidationDistance`,
`calculatePortfolioGain`, and `calculateAnnualInterest` — reusing M3-005's
own "Annual Interest = debt cost" interpretation for consistency).

**"Preserve assumptions" interpreted as never discarding the caller's
scenario definition.** `SimulationResult.assumptions` echoes the exact
`SimulationScenario` the caller supplied (including `timeHorizonDays`/
`borrowApr` for interest scenarios) so a UI can always display what was
assumed alongside the numbers — a direct, non-speculative reading of the
Responsibility text.

**"Priority" (M3-012) — the one field `generateRecommendations` doesn't
already provide.** `engine/recommendation/types.ts` documents an
explicit, ordered five-tier "DECISION PRIORITY" list (02_Formulas.md's
Recommendation Engine chapter, page 8), already used as
`Recommendation.decisionPriority` ("Risk level"). `generateRecommendations`
itself returns recommendations in a fixed structural order (borrow,
repayment, additionalCollateral, loop), not priority-ordered. This
Service sorts by that same documented tier order and attaches a 1-based
`priority` rank, satisfying M3-012's "Priority" field and the DoD's
"ordered consistently" without inventing a new scheme — the tiers and
their order are the Formula chapter's own.

**`unavailableCategories` is preserved, not dropped.** `generateRecommendations`
already reports which of the six documented recommendation categories
(Safety, Interest cost, Exit readiness) are unavailable and why, tracing
to conflicts #1 and #11 and an interest-cost gap adjacent to #7 —
dropping that here would silently hide already-documented specification
gaps from anything consuming this Service.

**`RecommendationRuleConfig` is entirely caller-supplied**, the same
"never fabricate what the Service doesn't own" principle as `sourceStatus`
— thresholds like `userMinHealthFactor` and `loopBorrowPercentage` are
portfolio-owner preferences with no documented default anywhere.

**Structural decision: `formulaStep`/`TrackedFormulaVersion` relocated
to `services/shared/formulaStep.ts`.** M3-005 (`summary.ts`) originally
defined this conflict #19 stopgap mechanism locally; M3-009 needed the
identical mechanism for its own multi-Engine-call composition. Same
"relocate once a second consumer needs it" trigger already used for
`MappingResult<T>` at M3-007. `summary.ts` now imports the relocated
names under their original local aliases, so the rest of that file is
byte-for-byte unchanged; its own tests pass unmodified, confirming the
relocation is behavior-preserving. **Not** added to `services/shared/index.ts`'s
public barrel — unlike `MappingResult<T>` (which appears in public
function signatures), `formulaStep`/`TrackedFormulaVersion` are pure
internal plumbing no consumer needs to reference directly, matching
M2-031's own "hide internal helpers" precedent for the Engine's
`validate.ts`/`invariants.ts`.

**Coverage note**: extracting `formulaStep` moved its own well-covered
internal branches out of `summary.ts`'s file-level branch count, so
`summary.ts`'s reported branch coverage dropped (71.42% → 65%) even
though the exact same test scenarios exercise the exact same code paths
as before — a reporting-denominator shift, not a real coverage
regression. Both `summary.ts` and `scenario.ts` have uncovered
call-site branches for intermediate Engine-call failures beyond the
first (e.g. forcing _only_ `calculateNetWorth` to fail while collateral/
debt succeed is not constructible from a single portfolio); these mirror
the same category of "defense in depth" uncovered branches already
documented in `engine/simulation/simulatePositionChange.ts` and are not
new to this batch's pattern, just now visible under a smaller
denominator.

**Dependency-direction and architecture audit**: re-verified that
`services/` still imports no `react`, `next`, or `@/components` path.
`services/simulation/scenario.ts` imports `@/engine`, `services/shared/
{formulaStep,result}`, and `services/portfolio/{mapping,models,summary}`
— its one cross-Service-subdirectory dependency, documented above.
`services/recommendation/recommendations.ts` imports `@/engine`,
`services/shared/{errors,result}`, and `services/portfolio/mapping` only.
No `engine/` file was modified by this batch.

**Traceability audit (pre-commit)**: `simulateScenario` and
`generateRecommendationSet`, plus every exported type from both new
files, are reachable through `@/services` alone, verified by two new
`describe` blocks in `tests/unit/services/publicApiSurface.test.ts`
(M3-009, M3-012). Every Formula ID this batch relies on (F-050, F-051,
F-033, F-030, F-011, F-023, F-007, F-053, F-032, F-061-F-064) was
already implemented and traced in Milestone 2 — this batch composes
existing public Engine functions and claims no new Formula ID.

**Validation — Batch 6 (Milestone 3)**

| Command              | Result                                                                                                                                                                                                                      |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`     | ✅ Pass                                                                                                                                                                                                                     |
| `pnpm lint`          | ✅ Pass (after autofix of import ordering across the new/changed files)                                                                                                                                                     |
| `pnpm format:check`  | ✅ Pass (after Prettier formatting of the new Service and test files)                                                                                                                                                       |
| `pnpm test`          | ✅ Pass, 659/659 (23 new)                                                                                                                                                                                                   |
| `pnpm test:coverage` | ✅ 94.91% statements / 89.92% branches / 100% functions / 98.84% lines — see the coverage note above for the `summary.ts` branch-percentage shift. No coverage threshold is configured, so this does not fail the pipeline. |
| `pnpm build`         | ✅ Pass                                                                                                                                                                                                                     |

No Milestone 2 code (`engine/`, its tests, or its fixtures) was modified
by this batch.

### Batch 7 — Loop Strategy + Exit Planning Services (M3-010, M3-011)

**Revisiting the deferred conflicts, as instructed.** Batch 6 deferred
M3-010 and M3-011 specifically because their Responsibilities/Include
lists appear to require resolving conflicts #8 (swap fees/slippage/gas
estimate), #10 ("Target cash proceeds" ambiguity), and #13 (F-040's
fixed-collateral assumption). Re-reading each conflict's actual text
against what the Engine already implements showed all three are already
resolved _at the Engine layer_ — not by inventing a formula, but by
**scoping the affected sub-item out and documenting why**, exactly the
pattern conflict #9 already established for M3-012 in Batch 6:

- **Conflict #8**: `calculateLoopCosts` (M2-017) and
  `calculateExitPosition` (M2-023) are both fully implemented and
  tested. Neither fails or blocks on the missing fee/slippage/gas
  model — each computes what is documented (Borrowing Interest,
  Break-Even Appreciation for loops; Repayment, BTC Sale Required for
  exits) and itemizes what is not (`unavailable`/`unavailableCosts`,
  each with a reason) as part of a normal, successful result.
- **Conflict #10**: `calculateTargetExit`'s `ExitTarget` union
  (`debtBalance`/`healthFactor`/`retainedBtc`) already excludes "Target
  cash proceeds" as a target type — that scoping decision was made at
  M2-024, not left for a Service to resolve.
- **Conflict #13**: F-040's fixed-collateral approximation is a known,
  already-tested Engine behavior (`calculateTargetExit.ts`'s own code
  comment, `targetHealthFactorInvariant.test.ts`), not something a
  Service needs to correct.

Because none of the three actually prevents the underlying Engine
functions from running, M3-010 and M3-011 could be implemented as thin,
faithful Service-layer wrappers around them — resolving the conflicts
"without inventing behavior" means passing through the same itemized
gaps and documented approximations the Engine already reports, the same
treatment conflict #9 got in Batch 6. Both tasks share the same
"coordinator Service on an M3-005 baseline" architecture as M3-009/M3-012
and became simultaneously ready once M3-005 landed; re-confirmed neither
has a formal or functional dependency on the other, so they were
implemented together as one batch on that basis (same reasoning as
Batch 6, not "combined by default").

| Task                                   | Status  | Notes                                                                                                                                                                           |
| -------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M3-010 Implement Loop Strategy Service | ✅ Done | `services/loop/strategy.ts` — `planLoopStrategy`, wrapping `validateLoopStrategySafety` (M2-018) and `calculateLoopCosts` (M2-017) into one Service-ready result.               |
| M3-011 Implement Exit Planning Service | ✅ Done | `services/exit/plan.ts` — `planExit`, wrapping `calculateTargetExit` (M2-024) and a before/after `calculatePortfolioSummary` (M3-005) comparison into one Service-ready result. |

**M3-010: "Validate strategy settings" and "surface safety warnings"
reuse `validateLoopStrategySafety` directly** — it already performs
every documented safety check and returns `viable`/`findings` in
exactly the shape this Responsibility asks for, so no separate
validation layer was added. **"Load protocol parameters"**: no Protocol
Parameter Service (M3-008) exists yet — `protocol` comes from the
portfolio's own `ProtocolParameters` field (M3-004), the caller supplies
it, the same "accept what the Service doesn't own" principle as
`sourceStatus`. When M3-008 exists, its output naturally becomes this
field's source without any change here.

**M3-011: "Current portfolio baseline" and "Before-and-after comparison"
reuse `calculatePortfolioSummary` (M3-005) directly**, called once on
the unmodified portfolio and once on the resulting post-exit portfolio —
the same reuse pattern M3-006 and M3-009 already established, now used
a third time. **"Transaction assumptions"** is `calculateExitPosition`'s
own `unavailableCosts`, passed through unchanged.

**New finding, escalating conflict #20**: constructing M3-011's
"after" comparison for a **full exit** (`targetDebt: 0`, the single most
common and important exit type) always produces a zero-debt resulting
portfolio. `calculatePortfolioSummary` cannot summarize a zero-debt
portfolio (conflict #20, found in Batch 4) because
`calculateLiquidationPrice` treats liquidation price as undefined
without debt. This means **`planExit` currently fails for every full
exit**, not just the abstract edge case conflict #20 originally
described — pinned explicitly by
`tests/unit/services/exit/plan.test.ts`'s "full exit and conflict #20
interaction" test rather than left as a silent gap. **Not fixed here**:
a real fix (e.g. making `PortfolioLiquidationSummary`'s `price`/`buffer`
nullable, mirroring `calculateHealthFactor`'s own zero-debt-as-`Infinity`
precedent) would mean modifying `services/portfolio/summary.ts`, already
shipped and depended on by M3-006 and M3-009 — a change with cross-batch
blast radius deliberately left for its own dedicated decision point
rather than folded into this batch's scope, the same discipline that
kept M3-010/M3-011 themselves out of Batch 6. Conflict #20's entry below
is updated to reflect this escalated severity.

**Dependency-direction and architecture audit**: re-verified that
`services/` still imports no `react`, `next`, or `@/components` path.
`services/loop/strategy.ts` imports `@/engine`, `services/shared/
{formulaStep,result}`, and `services/portfolio/{mapping,models}`.
`services/exit/plan.ts` imports `@/engine`, `services/shared/
{formulaStep,result}`, and `services/portfolio/{mapping,models,summary}`.
No `engine/` file was modified by this batch.

**Traceability audit (pre-commit)**: `planLoopStrategy` and `planExit`,
plus every exported type from both new files, are reachable through
`@/services` alone, verified by two new `describe` blocks in
`tests/unit/services/publicApiSurface.test.ts` (M3-010, M3-011). Every
Formula ID this batch relies on (F-018, F-013, F-020, F-022, F-032,
F-037, F-040, F-041, F-042, F-002, F-004) was already implemented and
traced in Milestone 2 — this batch composes existing public Engine
functions and claims no new Formula ID.

**Validation — Batch 7 (Milestone 3)**

| Command              | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`     | ✅ Pass                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `pnpm lint`          | ✅ Pass (after autofix of import ordering across the new/changed files)                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `pnpm format:check`  | ✅ Pass (after Prettier formatting of the new Service and index files)                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `pnpm test`          | ✅ Pass, 682/682 (23 new). One test was corrected mid-implementation: an assumed `ok:false` Engine failure for invalid protocol parameters is actually a `viable:false` success (`validateLoopStrategySafety`'s own documented "unsafe as data, not a thrown failure" design) — fixed to assert the real behavior, and a genuine malformed-input failure case (negative collateral) was added in its place.                                                                                                     |
| `pnpm test:coverage` | ✅ 94.84% statements / 89.76% branches / 100% functions / 98.88% lines. `services/loop/strategy.ts` and `services/exit/plan.ts` each have a small number of uncovered intermediate-failure branches (e.g. `calculateExposure`/`calculateLoopCosts` failing independently of a valid strategy is not constructible from a single input) — the same category of already-documented "defense in depth" gap as `summary.ts`/`scenario.ts`. No coverage threshold is configured, so this does not fail the pipeline. |
| `pnpm build`         | ✅ Pass                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

No Milestone 2 code (`engine/`, its tests, or its fixtures) was modified
by this batch.

### Batch 8 — Protocol Parameter Service (M3-008) — FINAL SERVICE-IMPLEMENTATION BATCH OF MILESTONE 3's CORE SET

**Pre-implementation documentation review, as instructed.** Re-read
M3-008's exact text (`06_TASKS.md`) and `04_BUILD_GUIDE.md`'s "PROTOCOL
SERVICE" / "PROTOCOL PARAMETER MODEL" / "PROTOCOL ADAPTER" / "SERVICE
FALLBACK ORDER" sections in full before writing any code. Found the same
structural situation Batch 5 already diagnosed for M3-007: a
`ProtocolProvider` interface, an `AaveV3Provider` adapter, and an
`infrastructure/protocols/` directory are described, but re-confirmed
`06_TASKS.md` assigns none of it to any task (no mention of
`infrastructure/`, `ProtocolProvider`, or `AaveV3Provider` anywhere), and
no `infrastructure/` directory exists in the repository. Per instruction,
none of that adapter/network layer was built — this batch implements
only the Service-layer normalization logic, the same boundary M3-007
drew.

**One genuine difference from M3-007, found and deliberately not
papered over**: `04_BUILD_GUIDE.md` defines a concrete "PRICE FRESHNESS"
rule (5-minute Fresh/Stale/Unavailable) for prices, but **no equivalent
"PROTOCOL FRESHNESS" section exists anywhere in the document** — only a
raw `updatedAt` timestamp field and a separate, unassigned 24-hour
cache-duration hint under "API CLIENT RULES" (also infrastructure, not
built here). Confirmed with a full-document grep for "Freshness" and
"PROTOCOL" before designing the type, not assumed. `ProtocolQuote`
therefore reports a plain timestamp (M3-008's own "Freshness timestamp"
Include item) with no computed staleness classification — inventing one
with no documented basis would have been guessing at an undocumented
business rule.

| Task                                        | Status  | Notes                                                                                                                                                                                                     |
| ------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M3-008 Implement Protocol Parameter Service | ✅ Done | `services/protocol/quote.ts` — `normalizeProtocolQuote`, selecting one candidate parameter set per the documented fallback order and validating it against the Engine's own protocol-parameter invariant. |

**`ProtocolQuote` wraps the Engine's own `ProtocolParameters` type
directly** (`@/engine`, M2-002: `{maxLoanToValue, liquidationThreshold,
borrowApr, supplyApr}`) rather than `04_BUILD_GUIDE.md`'s more elaborate
illustrative "PROTOCOL PARAMETER MODEL" (`protocol`, `network`,
`liquidationBonus`, `collateralAsset`/`borrowAsset` as named fields on
the parameter object itself). Fields the Build Guide's illustrative
model names but that have no corresponding Engine formula or consumer
anywhere in this codebase (`liquidationBonus`, `protocol` name,
`network`) were not added — 06_TASKS.md's own "Include" list doesn't ask
for them either. This means a `ProtocolQuote`'s `parameters` field is
already exactly what `ApplicationPortfolio.protocol` needs with no
separate conversion step, the same design principle M3-007 already
established for `MarketQuote`.

**Fallback order** (`04_BUILD_GUIDE.md` "SERVICE FALLBACK ORDER",
protocol parameters): Live protocol source → Last verified configuration
→ Manual configuration. `ProtocolOrigin = 'live' | 'cache' | 'manual'`
and its priority order mirror this verbatim — verified by a test
asserting the live candidate is chosen even when it is the _oldest_ of
three candidates (proving no freshness-based override exists, only
origin-priority selection, consistent with the "no invented freshness
rule" finding above).

**Validation mirrors the Engine's own (unexported) `validateProtocolParameters`
invariant** — percentages in [0, 1] for `maxLoanToValue`/
`liquidationThreshold`, non-negative `borrowApr`/`supplyApr`, and
`maxLoanToValue` must not exceed `liquidationThreshold`. That helper
isn't part of the Engine's curated public API (M2-031 "hide internal
helpers"), so the same checks are re-implemented locally at the Service
boundary, where — like M3-004's persistence mapping and M3-007's raw
price candidates — incoming candidate data may legitimately be
malformed. This is replicating an already-established Engine-layer
rule, not inventing a new one.

**"No candidates" is a successful `available: false` result, not a
failure** — the same design M3-007 used for zero market-price
candidates: absence of data is a legitimate state the Service correctly
determined, not a computation that failed.

**Public API preserved**: no existing exported name, type shape, or
function signature from any prior batch was changed. `ServiceResult`/
`ServiceMetadata`/`MappingResult` (M3-002/M3-003/M3-007) are untouched;
`services/protocol/index.ts` moved from its M3-001 placeholder
(`export {};`) to real exports, the same transition every other Service
subdirectory has already gone through.

**Dependency-direction and architecture audit**: re-verified that
`services/` still imports no `react`, `next`, or `@/components` path.
`services/protocol/quote.ts` imports only `@/engine`'s published
`ProtocolParameters` type and `services/shared/{errors,mappingResult}`
— no `@/engine` function calls (this Service performs no calculation,
matching M3-007's own "no Engine dependency" pattern), and no dependency
on any other Service subdirectory. Grepped the new files for `fetch(`,
`axios`, `XMLHttpRequest`, `process.env`, and `infrastructure` as
directory references — none found outside doc comments explaining what
was deliberately not built. No `engine/` file was modified by this
batch.

**Traceability audit (pre-commit)**: `normalizeProtocolQuote` and every
exported type from `services/protocol/` are reachable through
`@/services` alone, verified by a new `describe` block in
`tests/unit/services/publicApiSurface.test.ts` (M3-008). This batch
introduces no Formula ID and makes no Engine calculation claim.

**Validation — Batch 8 (Milestone 3)**

| Command              | Result                                                                                                                                                            |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`     | ✅ Pass                                                                                                                                                           |
| `pnpm lint`          | ✅ Pass (after autofix of import ordering in the new test file)                                                                                                   |
| `pnpm format:check`  | ✅ Pass (after Prettier formatting of the new test file)                                                                                                          |
| `pnpm test`          | ✅ Pass, 699/699 (17 new)                                                                                                                                         |
| `pnpm test:coverage` | ✅ 95% statements / 90.18% branches / 100% functions / 98.92% lines — `services/protocol/` is fully, 100%-covered (it does not appear as a partial-coverage row). |
| `pnpm build`         | ✅ Pass                                                                                                                                                           |

No Milestone 2 code (`engine/`, its tests, or its fixtures) was modified
by this batch. **Milestone 3's ten Service-implementation tasks
(M3-001–M3-012, minus none) are now all complete** — M3-013 (Service
Dependency Injection) and M3-014 (Service Integration Tests) remain,
both cross-cutting tasks that operate on the now-complete Service set
rather than adding a new Service of their own.

### Batch 9 — Service Dependency Injection + Service Integration Tests (M3-013, M3-014) — FINAL MILESTONE 3 BATCH

**Pre-implementation documentation review, as instructed.** Re-read both
tasks' full text in `06_TASKS.md` before writing anything. M3-013's own
text is unusually sparse — four one-line Goals and a one-line DoD, no
interface shapes, no code examples — and its **Dependencies field lists
only M3-007 and M3-008**, not M3-005 or any other Service. Read as
scoping evidence: this task formalizes dependency injection specifically
for the two "provider-shaped" Services (Market Data, Protocol Parameter,
the ones that stand in for external data sources), not a sweeping DI
container across the whole Service layer.

**Finding: M3-013's Definition of Done ("Service tests can run using
in-memory dependencies") is already satisfied by the existing
architecture, verified rather than assumed.** Every Service built since
M3-004 has consistently followed one rule, reinforced explicitly in
every batch's own write-up: never fabricate what a Service doesn't own —
accept it as an explicit, typed function parameter instead
(`sourceStatus`, `RawPriceCandidate[]`, `RawProtocolCandidate[]`,
`RecommendationRuleConfig`, etc.). This **is** dependency injection in
its simplest form — the dependency is received, never fetched — and
every existing Service test already exercises it using plain in-memory
object literals, no mocking library anywhere in the codebase. No new
production code was needed to make this true; it was already true by
construction. What M3-013 needed was verification, not invention:

- **"Avoid hardcoded infrastructure"**: formalized the recurring manual
  grep audit every batch since M3-005 has performed by hand (checking
  `services/` for `fetch(`/`axios`/`XMLHttpRequest`/`process.env`/
  `infrastructure/` references) into a permanent, automated test in
  `tests/unit/services/serviceFoundation.test.ts` — mechanically proving
  the Goal on every future run instead of re-checking it by hand each
  batch.
- **"Improve testability" / DoD ("in-memory dependencies")**: a new
  `tests/unit/services/dependencyInjection.test.ts` exercises
  `normalizeMarketQuote` and `normalizeProtocolQuote` (M3-013's own
  listed Dependencies) using only plain in-memory object literals.
- **"Enable provider replacement"**: the same test file demonstrates
  this concretely — swapping which `origin` supplies the winning
  candidate changes each Service's output predictably, without either
  Service knowing or caring where the data actually came from.
- **"Support manual and cloud modes"**: "manual" mode is already a
  first-class, tested `origin` value on both Services (not a special
  code path); "cloud modes" (Supabase sync, etc.) genuinely has no
  implementation to inject yet — see the new conflict below.

**New finding, documented as conflict #21 rather than guessed at**:
M3-013's Description also says Services should receive "**persistence**
adapters" through typed dependencies — but no persistence Service or
task exists anywhere in Milestone 3 (`services/persistence/` is still
its M3-001 placeholder), and persistence/cloud sync is explicitly a
**Milestone 8** concern (`06_TASKS.md`'s own milestone overview:
"Milestone 8 — Persistence, Authentication, Cloud Synchronization &
Import/Export"). There is nothing to formally inject a persistence
adapter _into_ yet. Per instruction, this was documented rather than
guessed at — no speculative persistence-adapter interface was invented
to fill the gap.

**M3-014 (Service Integration Tests)** was directly, concretely
implementable with no specification conflicts. `06_TASKS.md`'s own
8-item "Cover" list maps one-to-one onto a new
`tests/integration/services/coreWorkflows.test.ts` (a new top-level test
category, alongside the existing `tests/unit/`, `tests/e2e/`, and
`tests/performance/` split) — one `describe` block per Cover item, each
chaining real Services together starting from raw `PersistencePortfolio`
data (M3-004 → M3-005/M3-007/M3-009/M3-010/M3-011/M3-012), the same
boundary-to-result path the application will actually exercise, rather
than re-testing each Service in isolation (already covered by every
prior batch's own unit tests).

| Task                                          | Status  | Notes                                                                                                                                                                        |
| --------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M3-013 Implement Service Dependency Injection | ✅ Done | DoD already satisfied by existing architecture; verified with two new tests rather than new production code. Conflict #21 (persistence adapters) documented, not guessed at. |
| M3-014 Create Service Integration Tests       | ✅ Done | `tests/integration/services/coreWorkflows.test.ts` — 9 tests across the 8 documented Cover items, chaining M3-004 mapping into each downstream Service.                      |

**DoD ("Core workflows pass without external network calls") is
satisfied structurally**, not by mocking or intercepting anything — no
file anywhere in `services/` or `engine/` performs network I/O (the same
fact `serviceFoundation.test.ts`'s new M3-013 check now proves
mechanically), so there is no network call for these tests to avoid
making.

**One correction found while writing the "Invalid portfolio" integration
test**: initially assumed `maxLoanToValue` was used somewhere in
`calculatePortfolioSummary`'s computation chain; re-reading `summary.ts`
showed it is not (only `liquidationThreshold` and `borrowApr` are
consumed from `protocol` by that function — `maxLoanToValue` has no
consumer anywhere in the Portfolio Summary Service). The test was
corrected to use an out-of-range `liquidationThreshold` instead, which
does genuinely propagate to a Health Factor failure.

**Dependency-direction and architecture audit**: this batch made **no
production code changes** to `services/` or `engine/` — confirmed by
`git status`, not assumed. All new/changed files are test-only
(`tests/unit/services/serviceFoundation.test.ts`,
`tests/unit/services/dependencyInjection.test.ts`,
`tests/integration/services/coreWorkflows.test.ts`). Re-verified no
`react`/`next`/`@/components` imports anywhere under `services/`.

**Traceability audit (pre-commit)**: `tests/integration/services/coreWorkflows.test.ts`'s
8 `describe` blocks are named and ordered to match `06_TASKS.md` M3-014's
own "Cover" list verbatim, making the mapping from documentation to test
mechanical to verify. Every Service and Formula ID exercised was already
implemented and traced in an earlier Milestone 3 batch — this batch
introduces no new Formula ID or Service.

**Validation — Batch 9 (Milestone 3) — FINAL MILESTONE 3 VALIDATION**

| Command              | Result                                                                                                                                                                                                                                        |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`     | ✅ Pass (after correcting two `MarketQuote` discriminated-union narrowing mistakes in the integration test — narrowed on `available`, which is `ProtocolQuote`'s field, not `MarketQuote`'s `freshness`)                                      |
| `pnpm lint`          | ✅ Pass                                                                                                                                                                                                                                       |
| `pnpm format:check`  | ✅ Pass (after Prettier formatting of `serviceFoundation.test.ts`)                                                                                                                                                                            |
| `pnpm test`          | ✅ Pass, 714/714 (26 new)                                                                                                                                                                                                                     |
| `pnpm test:coverage` | ✅ 95.08% statements / 90.34% branches / 100% functions / 98.92% lines — `services/portfolio/summary.ts`'s branch coverage improved slightly (65% → 70%) as a side effect of the integration test's out-of-range-`liquidationThreshold` case. |
| `pnpm build`         | ✅ Pass                                                                                                                                                                                                                                       |

No Milestone 2 code (`engine/`, its tests, or its fixtures) was modified
by this batch. **Milestone 3 — Core Services is now complete**: all 14
tasks (M3-001 through M3-014) addressed.

---

## Milestone 4 progress

### Batch 0 — Resolve Conflict #20 (standalone follow-up, not an M4 task)

Per approved Milestone 4 plan: Conflict A (single collateral/single debt
position, Version 0.1 locked scope — no multi-position support to be
invented), Conflict B (no interim persistence infrastructure before
Milestone 8 — the M4 store stays in-memory; any M4 task that depends on
persistence gets its limitation documented rather than an interim
solution), and Conflict C (resolve conflict #20 first, standalone,
before any M4 batch that depends on zero-debt portfolio support) were
all approved. This batch resolves Conflict C only — no M4 task
(M4-001 onward) is touched.

**Root cause, precisely located**: `calculatePortfolioSummary`
(`services/portfolio/summary.ts`, M3-005) composes
`calculateLiquidationPrice` (F-024) and `calculateLiquidationBuffer`
(F-025, which calls F-024 internally) — both explicitly, by design,
return a `NOT_APPLICABLE_NO_DEBT` failure for zero debt ("the price that
triggers liquidation" is undefined when there's no debt to liquidate).
`calculateLiquidationDistance` (F-023) does **not** share this problem —
it derives Distance from `calculateHealthFactor` (F-022) directly, which
already succeeds with `Infinity` for zero debt (a deliberate, documented
M2-009 design decision). So the summary's failure was narrower than it
first appeared: only the price/buffer pair is genuinely undefined for
zero debt, not the whole liquidation concept.

**Resolution — Service-layer adaptation, Engine untouched**: rather than
overriding F-024/F-025's own documented Engine-layer behavior (a
Milestone 2, already-shipped, already-audited formula contract, with a
larger blast radius — `engine/simulation/simulatePositionChange.ts` and
`simulatePriceScenario.ts` also call these functions directly),
`calculatePortfolioSummary` now checks `debtValue === 0` **before**
calling any of the three liquidation formulas and sets
`liquidation: null` directly, skipping all three calls rather than
calling-then-discarding a failure. `PortfolioSummary.liquidation`'s type
changed from `PortfolioLiquidationSummary` to
`PortfolioLiquidationSummary | null`. This mirrors
`calculateHealthFactor`'s own zero-debt-as-`Infinity` precedent one
layer up, applied at the Service boundary instead of the Engine. The
existing `NO_DEBT` warning the Health Factor step already produces
carries the explanation; no duplicate warning was invented.
`git diff --stat -- engine/` is empty — confirmed zero Engine files
touched.

**Consumers updated**:

- `services/simulation/scenario.ts` (M3-009) — `toScenarioSummary`
  read `portfolioSummary.liquidation.distance` directly; changed to
  `portfolioSummary.liquidation?.distance ?? Infinity`, consistent with
  what `calculateLiquidationDistance` would have produced directly for
  the same zero-debt input (the scenario/interest code paths in this
  same file already call it directly and already handle zero debt
  correctly — this fallback keeps the baseline path consistent with
  them, not a new invented convention).
- `services/portfolio/actionPreview.ts` (M3-006) and
  `services/exit/plan.ts` (M3-011) — **zero code changes**. Both consume
  `PortfolioSummary` opaquely (as `before`/`after` fields) without
  touching `.liquidation` directly, so a `repay`-to-zero action and a
  full exit (`targetDebt: 0`) now both succeed automatically.

**Test changes**:

- `tests/unit/services/portfolio/summary.test.ts` — the two tests that
  pinned the old failure (`'propagates a single Engine failure...'` and
  `'handles a zero-debt Health Factor as Infinity before failing...'`)
  now assert the fixed success behavior: `liquidation: null`,
  `healthFactor: Infinity`, `interestCost: 0`, and the `NO_DEBT` warning
  present.
- `tests/unit/services/exit/plan.test.ts` — the pinned "full exit and
  conflict #20 interaction" test flipped from asserting failure
  (`NOT_APPLICABLE_NO_DEBT`) to asserting success (`feasible: true`,
  `after.liquidation: null`, `after.healthFactor: Infinity`,
  `after.netEquity: 80000`). One unrelated line (`after?.liquidation.distance`,
  a non-zero-debt partial-exit case) needed a null-safety
  `?.` added for the new type, no behavior change.
- `tests/unit/services/portfolio/actionPreview.test.ts` — added one new
  test: `repay` for the full outstanding balance succeeds with
  `liquidation: null`.
- `tests/unit/services/simulation/scenario.test.ts` — added one new
  test: a zero-debt baseline portfolio reports
  `liquidationDistance: Infinity` rather than failing.

**Correction found while writing the exit-plan test**: first guessed the
post-full-exit `netEquity` would be `100000` (the full pre-exit
collateral value); actual computed value is `80000` (1.6 BTC retained
after selling 0.4 BTC to repay $20,000 debt, × $50,000 = $80,000).
Verified by running the test rather than asserting the guessed figure —
caught before commit.

**Scope discipline**: only `services/portfolio/summary.ts` and
`services/simulation/scenario.ts` (both already-shipped Milestone 3
Service files) were modified, plus their four test files. No M4 task
(M4-001 through M4-018) was started. `engine/` is untouched.

**Validation — Batch 0**

| Command              | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`     | ✅ Pass                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `pnpm lint`          | ✅ Pass                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `pnpm format:check`  | ✅ Pass                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `pnpm test`          | ✅ Pass, 716/716 (2 net new; 3 rewritten)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `pnpm test:coverage` | ✅ 94.91% statements / 90.08% branches / 100% functions / 98.92% lines. Slight dip from Batch 9's 95.08%/90.34% is the new `debtValue === 0` branch's pre-existing sibling branches (the individual `!xStep.ok` early-return failure arms for `netEquityStep`/`loanToValueStep`/`leverageStep`/the liquidation steps) remaining untested — a pre-existing gap (never covered before this batch either), not a regression this batch introduced. No coverage threshold is enforced in `vitest.config.ts` (informational only). |
| `pnpm build`         | ✅ Pass                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

**Architecture audit**: `git diff --stat -- engine/` empty (zero Engine
files touched, confirming the fix stayed at the Service boundary).
`services/portfolio/index.ts`, `services/exit/index.ts`,
`services/simulation/index.ts` all unchanged (no public API surface
change beyond `PortfolioSummary.liquidation`'s own type, which was
already exported). `serviceFoundation.test.ts`'s M3-013
hardcoded-infrastructure and React/Next import checks still pass
unmodified. Services → Engine one-way dependency preserved; no UI code
touched (Milestone 4 UI work has not started).

**Traceability**: this batch implements no `06_TASKS.md` task — it is
the dedicated Conflict #20 follow-up the Batch 7 approval and the
Milestone 4 plan approval both called for, positioned before Batch 4
(M4-007/M4-008), which is the first M4 batch whose own Requirement
("Support zero-debt portfolios") depends on it.

---

### Batch 1 — Portfolio Application Types + Validation Schemas + Portfolio Store (M4-001, M4-002, M4-003)

First Milestone 4 task batch — the first app-layer code in this
codebase (`types/`, `stores/`), built on top of the now-complete Service
layer. Applies Conflicts A and B (approved with the Milestone 4 plan)
from the start, per instruction.

**M4-001 — `types/portfolio.ts`**: `Portfolio` extends
`ApplicationPortfolio` (`services/portfolio/models.ts`, M3-004) rather
than duplicating `collateral`/`debt`/`market`/`protocol` — that file's
own header comment explicitly anticipated this extension.
`mapApplicationPortfolioToEngineInput` already reads only the four
Engine-relevant fields by name, so no Engine-boundary code needed to
change. Added: `id`, `name`, `description?`, `baseCurrency`, `settings`,
`archivedAt`, `createdAt`, `updatedAt`.

- **Conflict A applied**: `collateral`/`debt` stay the singular objects
  `ApplicationPortfolio` already defines. "Collateral positions"/"Debt
  positions" (plural) in M4-001's own "Include" list is read as
  lifecycle management of the one slot, not a multi-position collection.
- **New finding — "Settings" documentation gap (conflict #22)**:
  M4-001's "Include" list names "Settings" with no field definition
  anywhere. M4-005/M4-006 corroborate that it holds per-portfolio safety
  targets but define no concrete fields either. The only concrete field
  list anywhere resembling this is 03_UI.md's Settings page → "PORTFOLIO"
  section (Default Target Health Factor, Default Holding Period, Default
  BTC Target Price, Default Safety Buffer) — described there as
  _global_ defaults for new portfolios/simulations, not explicitly a
  per-portfolio override schema. Reused conservatively, scoped
  per-portfolio, as `PortfolioSafetyTargets` (all fields optional,
  matching M4-005's "Optional safety targets" wording). "Default display
  settings" (also named in M4-006) has no field list anywhere and is not
  modeled — `PortfolioSettings` currently contains only `safetyTargets`.
- **`archivedAt` added, not in M4-001's own list**: needed so M4-003's
  required "Archive" action has something to write to. Full archive UX
  is M4-012's job.
- **"Owner"/"Version" intentionally omitted**: named in 01_PRD.md's more
  general "PORTFOLIO MODEL" (REQ-003) but not in M4-001's own task text.
  No authentication system exists yet (Milestone 8's job) for "Owner" to
  reference honestly — left out rather than populated with an invented
  placeholder.

**M4-002 — `types/portfolio.schema.ts`**: Zod schemas mirroring
`engine/validation/validate.ts`'s own bounds field-for-field (not
inventing separate rules that could drift from what the Engine already
enforces) — see the file's own header comment for the full mapping.
"Supported assets" for debt reuses 01_PRD.md's "PRICING PROVIDER"
(REQ-010) asset list (USDC/USDT/DAI) — the only concrete asset list
anywhere in the documentation, written for a different (unbuilt)
infrastructure concern but the only textual evidence available.
"Duplicate positions" is structurally satisfied by Conflict A's
single-position model — no array-dedup logic exists to write.
`maxLoanToValue <= liquidationThreshold` is enforced via `.refine()`,
surfacing the same invariant `validateProtocolParameters` already
enforces, for earlier user feedback.

**M4-003 — `stores/portfolioStore.ts`**: Zustand store with `load`,
`create`, `update`, `select`, `duplicate`, `archive`, `delete` — this
task's own "Actions" list exactly.

- **Conflict B applied in full**: no `persist` middleware, no interim
  persistence mechanism. `loadStatus`/`saveStatus`/`lastSynchronizedAt`
  exist (the task's own "State" list requires them) but are honestly
  degenerate: `load()` transitions `'loading'` → `'idle'` synchronously
  with nothing to load; `saveStatus` never leaves `'idle'` (no external
  save target to report `'saved'` against — reporting `'saved'` for a
  purely in-memory write would misrepresent durability); `lastSynchronizedAt`
  stays `null` always. M4-010's "Retain selection after refresh" and
  M4-013's real auto-save states cannot be genuinely satisfied by this
  batch — documented rather than papered over with an interim solution,
  exactly as instructed.
- **`calculatePortfolioSummary` (M3-005) usage**: `create`/`update`/
  `duplicate` compute and cache each portfolio's
  `ServiceResult<PortfolioSummary>` alongside its raw record, anticipating
  M4-004's list page needing Net Equity/Health Factor/Debt for every
  portfolio — the concrete meaning of "delegate calculations... to
  Services" here, and the concrete reason this task depends on M3-005.
- **`sourceStatus` hardcoded to `'manual'`**: M4-014/M4-015 (Manual
  Price/Protocol Controls, later batches) don't exist yet, so every
  portfolio in this batch is necessarily manually entered — the honest
  current value, not a guess.
- **Validation**: `create`/`update` run input through M4-002's schemas
  before constructing/mutating a `Portfolio`, mapping Zod issues to
  `ApplicationError` (category `'validation'`, M3-003, reused rather
  than inventing a parallel error shape) — the concrete mechanism behind
  M4-002's own DoD. `update` re-validates the fully merged result (not
  just the changed fields) so a partial update cannot silently produce
  an overall-invalid portfolio. `MappingResult<Portfolio>` (M3-004/
  M3-007) is reused as `create`/`update`/`duplicate`'s return shape,
  since these operations can fail before any Engine calculation runs.
- **`duplicate`/`archive` implement a minimal, correct version of what
  M4-011/M4-012 will refine**: `duplicate` generates a new identity,
  copies positions/settings, and appends " (Copy)" to the name — matching
  M4-011's own later text ("Generate a new identity... Append a clear
  copy name") — because M4-003 already requires _some_ working
  `duplicate` action to exist, not because M4-011 is being started
  early. `archive` sets `archivedAt`; M4-012's confirmation/explanation
  UX is not built here.

**Coverage config extended**: `vitest.config.ts`'s `coverage.include`
only listed `engine/**`/`services/**`/`utils/**` — this is the first
batch producing code outside those directories. Added `types/**` and
`stores/**` so the new files are tracked, not silently invisible to
coverage going forward.

**Test files**: `tests/unit/types/portfolio.schema.test.ts` (24 tests —
every M4-002 "Validate" item, plus the protocol invariant and the
baseCurrency default) and `tests/unit/stores/portfolioStore.test.ts` (20
tests — every action, including a zero-debt `create` case that
exercises conflict #20's fix end-to-end through the Store, and explicit
tests pinning Conflict B's degenerate `saveStatus`/`lastSynchronizedAt`
behavior so a future batch can't accidentally regress the "no interim
solution" decision without a visible test failure).

**Correction found while writing store tests**: a Zustand
`setState(state, true)` (replace mode) in the test file's `beforeEach`
wiped out the store's action functions along with the state fields,
since actions live on the same state object — every action-calling test
failed with "is not a function". Fixed by dropping the `replace` flag
(merge mode), which resets only the listed state fields and leaves the
actions intact. Caught by running the tests, not asserted blindly.

**Scope discipline**: only M4-001/M4-002/M4-003 were implemented. No UI
page or component was touched (`git diff --stat -- app/ components/
features/ hooks/ providers/` empty) — `app/portfolio/page.tsx` remains
M1's placeholder. `engine/` and `services/` are completely untouched
(`git diff --stat -- engine/ services/` empty) — zero regression risk to
Milestones 2–3.

**Validation — Batch 1**

| Command              | Result                                                                                                                                                                                                                                                                                          |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`     | ✅ Pass                                                                                                                                                                                                                                                                                         |
| `pnpm lint`          | ✅ Pass (after `eslint --fix` for import ordering)                                                                                                                                                                                                                                              |
| `pnpm format:check`  | ✅ Pass (after Prettier formatting of the two new test files)                                                                                                                                                                                                                                   |
| `pnpm test`          | ✅ Pass, 760/760 (44 new)                                                                                                                                                                                                                                                                       |
| `pnpm test:coverage` | ✅ 94.68% statements / 89.73% branches / 100% functions / 98.35% lines (project-wide, now including `types/`/`stores/`). `stores/portfolioStore.ts`: 89.85%/84.21%/100%/89.06%. `types/portfolio.schema.ts`: fully exercised. `types/portfolio.ts`: no runtime code to cover (interfaces only). |
| `pnpm build`         | ✅ Pass — bundle sizes unchanged, since no page imports the new store/types yet                                                                                                                                                                                                                 |

**Architecture audit**: `git diff --stat -- engine/ services/` empty
(zero Engine/Service files touched). No Service file imports from
`@/types` or `@/stores` (UI → Services stays one-way). No React/Next
import in `services/`. `types/portfolio.ts` and `stores/portfolioStore.ts`
import from `@/services/portfolio` and `@/services` respectively (the
allowed UI → Services direction). No `fetch`/`axios`/`XMLHttpRequest`/
`process.env`/`infrastructure/` reference in the new files —
`crypto.randomUUID()` is the only platform-primitive call, appropriate
for the Store/UI layer (unlike Services, which must stay
platform-primitive-free per M3-013's own audit).

**Traceability**: M4-001's "Include" list, M4-002's "Validate" list, and
M4-003's "State"/"Actions" lists are each addressed field-for-field
above, with every deviation (Settings' minimal shape, `archivedAt`'s
addition, Owner/Version's omission, the degenerate persistence fields)
documented rather than silently decided.

---

### Batch 2 — Portfolio List Page + Active Portfolio Switching + Portfolio Empty States (M4-004, M4-010, M4-016)

First batch to render real UI — everything built here is a thin,
presentational layer over Batch 1's store/types; no new Service or
Engine logic.

**New finding — conflict #23: 03_UI.md's own page inventory has no
"Portfolio List" page.** 03_UI.md's "APPLICATION STRUCTURE" states
"ProfitPilot consists of six primary pages" (Dashboard, Portfolio,
Simulation, Loop Builder, Exit Planner, Settings) and "NAVIGATION
HIERARCHY" lists exactly those six, with no seventh page for browsing
multiple portfolios. The existing `/portfolio` route (singular, M1) is
already spoken for — 03_UI.md's own "PORTFOLIO PAGE" section describes
it as a single-portfolio detail view ("Display complete asset
information... Assets, Collateral, Debt, Exposure, Leverage, Interest...
answers 'What do I own?'"), not a list. This is a genuine gap between
03_UI.md's fixed single-portfolio-per-page mental model and Milestone
4's explicit multi-portfolio requirement ("Version 1 must support
multiple portfolios").

**Resolution applied**: `app/portfolios/page.tsx` (plural — distinct
from the existing singular `/portfolio`) hosts M4-004's List Page.
**Not** added to `constants/navigation.ts`/the sidebar, since that would
contradict 03_UI.md's explicit six-page/six-item structure. Instead
reached from the portfolio switcher in `AppHeader` (M4-010) — 03_UI.md's
own "TOP NAVIGATION" section names "Current Portfolio Name" as a Top Bar
display element, so the switcher (and a "Manage/View portfolios" link to
the List Page) lives exactly there, the one place 03_UI.md already
allocates space for portfolio-identity UI in the shell. Action needed: a
product/engineering decision on whether `/portfolios` should become an
eighth navigable location (contradicting the "six primary pages"
statement) or stay reachable only via the switcher, as built here.

**M4-004 — `app/portfolios/page.tsx`**: Display list exactly per this
task's own list (name, net equity, health factor, debt, last updated,
storage status). "Create action" links to a new minimal scaffold route,
`app/portfolios/new/page.tsx` — the same placeholder-route pattern
Milestone 1 already established for every not-yet-built page; the real
guided flow is M4-005's own, later, dedicated task, not started here.
"Select action" calls `select(id)` then navigates to the existing
`/portfolio` route (still M1's placeholder — filling in its real content
is a separate, unassigned task, out of this batch's scope). "Loading
state"/"Error state" are wired to the store's real `loadStatus`/`errors`
fields.

**M4-016 — empty states, folded into the same page** (M4-016 depends
only on M4-004, and its 5 states are naturally page-level/row-level
conditions on the same List Page, not a separate page):

- **"No portfolios"** — fully realized: message + Create action, this
  page's own real empty state.
- **"No collateral" / "No debt"** — genuinely reachable, valid states
  under Conflict A's single-position model (`quantity`/`balance` can be
  exactly zero — M4-008 explicitly requires supporting zero-debt
  portfolios). Shown as inline per-row badges.
- **"Missing prices" / "Missing protocol parameters" — not reachable,
  documented rather than built as dead UI.** `market`/`protocol` are
  required, Zod-validated fields (M4-002); no code path today produces a
  portfolio missing either. The one genuinely reachable per-row problem
  state — a cached summary calculation failure
  (`record.summary.ok === false`) — is shown generically instead of
  guessing which of the two specific fields an `ApplicationError` code
  might correspond to (no such mapping is defined anywhere).
- **"Storage status"** displays the store's one _global_ `saveStatus`
  (Batch 1) on every row — there is no per-portfolio persistence state
  to differentiate yet (Conflict B). Honestly labeled, not fabricated
  per-row.

**M4-010 — `components/layout/AppHeader.tsx`** (now a Client Component):
a native `<select>` bound to `activePortfolioId`, switching via the
store's own `select` action. Per-Requirement:

- **"Load calculated summary"** — already satisfied structurally:
  `PortfolioRecord.summary` is cached at create/update time (Batch 1),
  so switching never triggers a new calculation.
- **"Update page context"** — satisfied by Zustand's own reactivity;
  every component reading `usePortfolioStore` re-renders automatically,
  no additional wiring needed.
- **"Preserve unsaved changes safely" — N/A this batch, documented, not
  invented.** No editable/draft portfolio state exists anywhere yet
  (M4-006's form and M4-013's auto-save are later batches); there is
  nothing to preserve. Revisit once one exists.
- **"Retain selection after refresh" — not satisfiable this batch,
  Conflict B.** The store is in-memory only; a refresh always loses the
  selection along with every portfolio, exactly as already documented in
  Batch 1.

**Coverage config extended again**: added `app/portfolios/**` and
`components/layout/AppHeader.tsx` specifically — **not** `app/**`/
`components/**` wholesale, since those directories still contain
untouched Milestone 1 placeholder pages/components
(`AppShell.tsx`/`AppSidebar.tsx`/`PlaceholderPage.tsx`, every other
`app/*/page.tsx`) that are not part of this batch's scope; including
them would misrepresent pre-existing, intentionally-untested scaffolding
as a coverage shortfall. Revisit as a directory-level include once more
of `app/`/`components/` is actually built out.

**Browser verification** (per the standing "test UI changes in a
browser" instruction): started the dev server and drove it with
Playwright/Chromium. Confirmed: the empty `/portfolios` state renders
correctly (screenshot taken), the header shows "No portfolios yet —
create one," clicking "Create Portfolio" navigates to `/portfolios/new`
and shows the scaffold text, sidebar navigation still works, and there
are zero browser console/page errors. The populated-list, switcher, and
error-state paths were not driven through the real browser (no creation
UI exists yet to organically populate one — that's M4-005) but are
covered thoroughly by the Testing Library component tests, which
exercise the exact same render logic via direct store manipulation.

**Test files**: `tests/unit/app/portfolios/page.test.tsx` (10 tests —
every Display field, both reachable empty-state badges, the error and
loading branches, select→navigate, and sort order),
`tests/unit/app/portfolios/new/page.test.tsx` (1 smoke test for the
scaffold), `tests/unit/components/layout/AppHeader.test.tsx` (5 tests —
empty/populated switcher states, the actual switch interaction, and the
manage-portfolios link). `next/navigation`'s `useRouter` is mocked via
`vi.mock`; `next/link` needed no mocking.

**Scope discipline**: only M4-004, M4-010, and M4-016 were implemented.
No M4-005/M4-006/M4-011/M4-012 work was started — `/portfolios/new` is a
scaffold only, `/portfolio` remains M1's placeholder untouched.
`engine/`, `services/`, `types/`, `stores/` are completely untouched
(`git diff --stat -- engine/ services/ types/ stores/` empty) — zero
regression risk to any earlier milestone or batch.

**Validation — Batch 2**

| Command              | Result                                                                                                                                                                                        |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`     | ✅ Pass                                                                                                                                                                                       |
| `pnpm lint`          | ✅ Pass                                                                                                                                                                                       |
| `pnpm format:check`  | ✅ Pass (after Prettier formatting of one new test file)                                                                                                                                      |
| `pnpm test`          | ✅ Pass, 776/776 (16 new)                                                                                                                                                                     |
| `pnpm test:coverage` | ✅ 94.84% statements / 90% branches / 100% functions / 98.4% lines (project-wide). `app/portfolios/page.tsx`: 96.42%/94.11%/100%/100%. `components/layout/AppHeader.tsx`: 100%/90%/100%/100%. |
| `pnpm build`         | ✅ Pass — `/portfolios` and `/portfolios/new` both appear in the route manifest as static pages                                                                                               |

**Architecture audit**: `git diff --stat -- engine/ services/ types/
stores/` empty (zero files touched in any prior-milestone layer). No
Service file imports from `@/app` or `@/components` (UI → Services
stays one-way). No `fetch`/`axios`/`XMLHttpRequest`/`process.env`/
`infrastructure/` reference in any new file. `app/portfolios/page.tsx`
and `AppHeader.tsx` import only from `@/stores/portfolioStore` and
Next.js/React — the allowed UI → Store → Services direction.

**Traceability**: M4-004's "Display"/"Include" lists, M4-010's
"Requirements," and M4-016's 5 empty states are each addressed
individually above, with every unreachable/unsatisfiable item (2 of
M4-016's 5 states, 2 of M4-010's 4 Requirements) documented rather than
faked.

---

### Batch 3 — Portfolio Creation Flow + Portfolio Details Form (M4-005, M4-006)

**New dependency added**: `@hookform/resolvers` (`^5.2.2`). Not
previously installed — only `react-hook-form` and `zod` themselves were.
M4-006's own Requirements explicitly mandate "Use React Hook Form. Use
Zod validation." together; `@hookform/resolvers/zod`'s `zodResolver` is
the standard, expected glue between two already-approved libraries, not
new infrastructure or a new framework choice. `pnpm add` briefly broke
`eslint-plugin-react-hooks`'s resolution (a pnpm hoisting side effect of
re-resolving the dependency tree, unrelated to the package's own
content) — fixed with `pnpm install --force`; confirmed via `git diff
--stat pnpm-lock.yaml` that only the new package's own entries were
added.

**Version corrected after initial commit**: first installed at the
then-latest `5.5.7`, which failed the project's `minimumReleaseAge`
policy when the patch was applied outside this sandbox. Re-checked the
package's full release history (`npm view @hookform/resolvers time`):
`5.2.2` published 2025-09-14, then an 8-month gap with no `5.3.x` at
all, then `5.4.0` through `5.5.7` — 10 versions — all published within
roughly 34 hours ending just before this session's current date. That
gap-then-burst pattern, immediately adjacent to "now," is exactly the
kind of signal a `minimumReleaseAge` policy exists to guard against,
independent of the stated policy failure — so the fix here is not just
"pick an older version that satisfies a number," it's "avoid the whole
suspicious release cluster." Repinned to `^5.2.2` (a caret range,
matching this file's existing convention, not an exact pin — the
`minimumReleaseAge` policy itself is what protects future `pnpm
install`s from resolving into the cluster, not the range operator).
Verified `5.2.2` still exposes the `./zod` subpath export this batch
uses and satisfies the same `react-hook-form: ^7.55.0` peer requirement
as `5.5.7` — no behavior change. Full validation pipeline re-run clean;
`pnpm test`/`test:coverage`/`build` all identical to the original
Batch 3 results (no source code changed, only the dependency version).

**M4-005 — `app/portfolios/new/page.tsx`** (replaces Batch 2's
scaffold): collects exactly this task's own "Collect" list via one
organized form (React Hook Form + `zodResolver(portfolioInputSchema)`,
reusing M4-002's schema directly rather than a duplicate).

- **"Guided," scoped as one organized form, not a multi-step
  wizard**: the task text says "guided," not "multi-step"/"wizard," and
  no wireframe anywhere in 03_UI.md breaks this flow into discrete
  steps. Building step-state/progress-indicator machinery beyond what's
  asked would be inventing UI architecture the specification doesn't
  call for.
- **New finding — conflict #24: "Protocol parameters or preset" — no
  preset values exist anywhere in the documentation.** No numeric Aave
  V3 parameter values are stated anywhere — 04_BUILD_GUIDE.md's
  "PROTOCOL SERVICE" section names required _fields_, never values, and
  no `AaveV3Provider` has ever been built (the same unbuilt
  infrastructure-layer gap found repeatedly across Milestone 3). Only
  manual entry is offered; inventing a specific preset number would
  mean fabricating real-world financial data.
- **DoD "created, selected, calculated, and saved"**: `onSubmit` calls
  `store.create()` (validates + computes + caches the summary —
  "created" and "calculated"), then `store.select()` ("selected"), then
  navigates to `/portfolio` ("opened"). "Saved" continues Conflict B's
  established framing: committed to the in-memory Store, not disk/cloud
  persistence.

**M4-006 — `app/portfolio/page.tsx`** (replaces the Milestone 1
`PlaceholderPage` this route held): a Details Form for the _active_
portfolio's identity/settings fields.

- **Scope reconsideration from Batch 2**: Batch 2 treated `/portfolio`'s
  real content as entirely out of scope/unassigned. Re-reading M4-006
  corrected this — its own Dependencies chain (M4-005 → M4-003 → M3-005)
  names no other UI task that would build this route first, and
  03_UI.md's own "PORTFOLIO PAGE" section already names this exact route
  for this exact purpose. The _read-only calculated metrics_ that same
  03_UI.md section also describes (Position Metrics, Milestones,
  Interest, Performance) remain unbuilt — no task in this batch covers
  them.
- **"Default display settings" not rendered** — continues conflict #22:
  no field list for it exists anywhere; only "Safety target settings"
  (`settings.safetyTargets`) is editable.
- **"Support automatic saving"**: debounced (600ms) calls to
  `store.update()` on `watch()` changes — auto-save to the in-memory
  Store (Conflict B's established "saved" framing), not disk. No manual
  save button, matching 04_BUILD_GUIDE.md's own auto-save principle.
- **DoD "do not alter position balances unexpectedly" — enforced
  structurally**: added `portfolioDetailsSchema` to
  `types/portfolio.schema.ts` via `portfolioInputSchema.pick({name,
description, baseCurrency, settings})` — the form's update payload is
  _type-incapable_ of containing `collateral`/`debt`/`market`/
  `protocol`, not just disciplined to avoid them.
- **Remounted (`key={activePortfolioId}`) on portfolio switch**: forces
  React Hook Form's internal state to fully reset per portfolio — the
  concrete mechanism satisfying M4-010's own "never mixes state between
  portfolios" DoD as it applies to this form. Verified by a dedicated
  test (switch renders the new portfolio's own field values, not stale
  ones).

**Bug found and fixed while implementing**: both forms' optional numeric
fields (safety targets) used `register(path, { valueAsNumber: true })`.
For an untouched, empty number input, `valueAsNumber` coerces the empty
string to `NaN` (not `undefined`) — `NaN` fails Zod's `.finite()` check,
silently blocking the _entire_ form's submission with no rendered error
(no error UI exists for those specific fields), even though the field is
genuinely optional and correctly left blank. Caught by a failing test
(`expected [] to have a length of 1 but got +0` with no visible cause),
diagnosed by inspecting DOM values and adding temporary debug output,
traced to this root cause. Fixed by switching those four fields (in both
forms) to `setValueAs: (value) => (value === '' ? undefined :
Number(value))`, which correctly represents "left blank" as "field
absent" rather than "field present with an invalid value." Both forms'
required numeric fields correctly keep `valueAsNumber` — an empty
required field _should_ fail validation and render a real error, which
it does. Regression-tested explicitly in both test files.

**Test files**: `tests/unit/app/portfolios/new/page.test.tsx` (rewritten
from Batch 2's scaffold test — 6 tests: full "Collect" list rendered, no
preset offered, the full create/select/navigate DoD, empty-name
rejection, protocol-invariant rejection, and the Store-failure
defense-in-depth fallback), `tests/unit/app/portfolio/page.test.tsx`
(new — 9 tests: no-active-portfolio state, field list, prefilled values,
no "display settings" fields, auto-save commits after the debounce
window, the position-balance DoD check, an invalid-edit rejection, the
NaN-bug regression check, and the switch-remount isolation check),
`tests/unit/types/portfolio.schema.test.ts` (+3 tests for
`portfolioDetailsSchema`).

**Browser verification**: started the dev server and drove the full,
real end-to-end flow with Playwright/Chromium — filled and submitted
the Creation Flow form, confirmed navigation to `/portfolio`, confirmed
the Details Form was correctly prefilled, edited the name, waited past
the debounce window, and confirmed the change propagated reactively to
the `AppHeader` switcher (proving the Store update actually landed).
Zero console/page errors throughout. Screenshots taken at each step.

**Scope discipline**: only M4-005 and M4-006 were implemented. No
M4-007+ work was started. `engine/`, `services/`, `stores/` are
completely untouched (`git diff --stat -- engine/ services/ stores/`
empty). The only `app/`/`components/` files touched are the two this
batch owns (`git diff --stat -- app/ components/` confirms no other
route/component changed). `PlaceholderPage` remains in use by the 5
still-unbuilt routes, unchanged.

**Validation — Batch 3**

| Command              | Result                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`     | ✅ Pass (after fixing a `z.infer` vs `z.input` mismatch on `baseCurrency`'s `.default('USD')` — React Hook Form's pre-resolution field values follow the schema's _input_ type, not its _output_ type; fixed via `useForm<FormValues, unknown, OutputType>`'s third generic in both forms)                                                                                                         |
| `pnpm lint`          | ✅ Pass (after `pnpm install --force` repaired the `eslint-plugin-react-hooks` resolution broken by adding `@hookform/resolvers`)                                                                                                                                                                                                                                                                  |
| `pnpm format:check`  | ✅ Pass (after Prettier formatting of 3 files)                                                                                                                                                                                                                                                                                                                                                     |
| `pnpm test`          | ✅ Pass, 794/794 (18 net new)                                                                                                                                                                                                                                                                                                                                                                      |
| `pnpm test:coverage` | ✅ 95.03% statements / 89.01% branches / 100% functions / 98.45% lines (project-wide). `app/portfolio/page.tsx`: 100%/83.33%/100%/100%. `app/portfolios/new/page.tsx`: 100%/66.66%/100%/100% (remaining branch gaps are the repetitive per-field `setValueAs`/error-rendering branches for individual optional fields — consistent with this project's already-accepted coverage norms elsewhere). |
| `pnpm build`         | ✅ Pass — `/portfolio` (1.23 kB) and `/portfolios/new` (1.62 kB) both show real bundle sizes, confirming real content replaced the placeholders                                                                                                                                                                                                                                                    |

**Re-validated after the `@hookform/resolvers` version correction**
(`5.5.7` → `^5.2.2`, see above): `pnpm typecheck`/`lint`/`format:check`
all pass clean (no hoisting regression this time); `pnpm test` —
794/794, identical; `pnpm test:coverage` — 95.03%/89.01%/100%/98.45%,
identical; `pnpm build` — identical bundle sizes. No source file
changed, only `package.json`/`pnpm-lock.yaml`.

**Architecture audit**: `git diff --stat -- engine/ services/ stores/`
empty. No Service file imports from `@/app` or `@/components`. No
`fetch`/`axios`/`XMLHttpRequest`/`process.env`/`infrastructure/`
reference in any new/modified file. Both forms import only from
`@/stores/portfolioStore`, `@/types/portfolio(.schema)`, and
React/Next/React-Hook-Form/Zod — the allowed UI → Store → Services
direction.

**Traceability**: M4-005's "Collect" list and DoD, and M4-006's
"Fields"/"Requirements"/DoD, are each addressed field-for-field above,
with every deviation (no preset, "Default display settings" omitted,
auto-save-to-Store not auto-save-to-disk) documented rather than
silently decided.

---

### Batch 4 — Collateral Position Management + Debt Position Management (M4-007, M4-008)

Adds two new sections to `/portfolio` (M4-006's existing Details Form
page), alongside it — 03_UI.md's own "PORTFOLIO PAGE" section lists
"Collateral" and "Debt" as content areas of the same page, not separate
routes.

**Conflict A reaffirmed**: "add, edit, and remove positions" is the one
collateral slot's and one debt slot's lifecycle (set from zero, change,
clear back to zero), not an array. "Prevent duplicate invalid positions"
is structurally satisfied by the same single-slot model.

**Preview mechanism — deliberately not `previewPortfolioAction`
(M3-006)**: that Service's `PortfolioAction` union changes exactly one
field per call. These forms let a user edit a position field and its
related protocol field(s) together in one preview (e.g., quantity and
Liquidation threshold at once) — no single `PortfolioAction` variant
represents that combination. Rather than force an artificial
one-field-at-a-time flow the task text doesn't ask for, both forms
compose the same "snapshot, apply change, snapshot again" pattern
`previewPortfolioAction` itself uses, directly via
`calculatePortfolioSummary` (M3-005) — still Service-delegated
calculation, just without the single-action constraint.

**Preview is a hard gate, not just a display**: `watch()` clears any
existing preview the instant a field changes, and "Apply Changes" is
disabled whenever no preview exists — a stale preview can never be
applied silently. This is the concrete mechanism behind "Preview effects
before destructive changes" (M4-007) / "Preview Health Factor impact"
(M4-008): every change is previewed before it can be applied, not only
ones a later task might classify as risk-increasing. Classifying _which_
changes are "risk-increasing" specifically is M4-009's own task
(Portfolio Action Preview), not built here.

**New finding — conflict #25: M4-008 names "Price" and "Rate type" as
debt fields with no counterpart anywhere in the actual data model.**
`calculateDebtValue` (F-003)'s own equation is "Debt Value = Borrowed
Stablecoins" — a hard 1:1 USD peg with no price parameter accepted
anywhere in the Engine. "Rate type" (Fixed/Variable or any other domain)
has zero definition anywhere in the documentation, and the Engine work
that would naturally house a fixed-vs-variable distinction
(M2-013/M2-014, "Variable Rate Projection") was formally blocked and
never implemented (conflict #7) — there is nothing for a "Rate type"
control to affect even if built. Resolved conservatively: "Price" is
shown as read-only informational text stating the 1:1 peg assumption
(a real, textually-grounded fact, not a fabricated editable field);
"Rate type" is not rendered at all (no grounded value exists to display,
unlike "Price"). "Price source" (M4-007's analogous field) is
similarly read-only ("Manual") — no live price source has ever been
built (the same unbuilt `PriceProvider` infrastructure-layer gap found
repeatedly since Milestone 3).

**"Manual price" (M4-007) writes to `portfolio.market.btcPriceUsd`**,
the same field M4-005 calls "Manual BTC price" — a basic editable input
here; the fuller manual-price UX (timestamp, reset, stale-data warning)
is M4-014's own, later, dedicated task. **"Maximum LTV"/"Liquidation
threshold" (M4-007) and "Borrow rate" (M4-008) write to
`portfolio.protocol`** (portfolio-level, not per-position) — each form
edits only its own named field(s), carrying the other, untouched
protocol fields through via hidden inputs so a complete, valid
`ProtocolParameters` object is always submitted. The fuller "preset
selection"/"freshness status" UX is M4-015's own, later, dedicated task.

**Type correction**: `Portfolio.debt.asset` was inherited as the
Engine's generic `DebtPosition.asset: string` (via `ApplicationPortfolio`),
but every `debt.asset` a `Portfolio` in this Store can actually hold is
already narrowed to `'USDC' | 'USDT' | 'DAI'` by M4-002's own
`debtPositionSchema`. Narrowed `Portfolio.debt` directly in
`types/portfolio.ts` (exporting `SUPPORTED_DEBT_ASSETS`/
`SupportedDebtAsset` as the one source of truth; `portfolio.schema.ts`'s
`debtPositionSchema` now imports and reuses it rather than keeping its
own separate copy) instead of type-casting at each call site — a more
honest, structurally-enforced type, not a workaround.

**Real bug found and fixed while writing tests — inline field errors
inside a wrapping `<label>` pollute the computed accessible name.**
Every form built in M4-005/M4-006/M4-007/M4-008 rendered its
`{errors.field && <span>...}</span>` _inside_ the same `<label>` that
wrapped the field's own `<input>`. The instant an error renders, the
label's computed accessible name becomes the concatenation of every
text node inside it — "Debt amount" _and_ the error message together —
so `getByLabelText('Debt amount')` (and a real screen reader) can no
longer resolve the field by its intended name. Caught by a test
(`Unable to find a label with the text of: Debt amount`, immediately
after a transient invalid-input state), reproduced in isolation, and
traced to this exact cause rather than worked around. Fixed by moving
every inline field-error `<span>` to be a _sibling_ immediately after
its `<label>` closes, not a child of it — applied consistently across
all four forms in both `app/portfolio/page.tsx` and
`app/portfolios/new/page.tsx` (not just the two new sections this batch
added), since the same latent defect existed in M4-005/M4-006's
already-shipped markup too. A pre-existing test
(`does not auto-save an invalid edit...`) that checked
`label.querySelector('.text-destructive')` was updated to check
`label.nextElementSibling` instead, matching the corrected DOM shape.

**Test files**: `tests/unit/types/portfolio.schema.test.ts` (+15 tests
for `collateralManagementSchema`/`debtManagementSchema`),
`tests/unit/app/portfolio/page.test.tsx` (+11 tests: both forms' field
lists prefilled correctly, the "Rate type" omission, the preview/apply
hard-gate behavior for both forms, stale-preview invalidation, invalid
previews staying blocked, and a dedicated debt-to-zero test confirming
conflict #20 stays reachable through this real UI with a finite,
correctly-rendered summary).

**Browser verification**: started the dev server and drove the full
flow with Playwright/Chromium — created a portfolio, changed collateral
quantity from 2 to 3 BTC, previewed (Net Equity $130,000.00 →
$150,000.00), applied; then repaid debt to exactly zero on the same
portfolio, previewed (Health Factor "6 → ∞", Loan-to-Value "13.33% →
0%" — Conflict #20's fix rendering correctly end-to-end through real
UI), and applied. Zero console/page errors throughout. Screenshot taken
of the full assembled `/portfolio` page.

**Scope discipline**: only M4-007 and M4-008 were implemented (plus the
label-error fix, which touched already-shipped M4-005/M4-006 markup to
correct a genuine, newly-discovered defect — not scope creep into a
later task). No M4-009+ work was started. `engine/`, `services/`,
`stores/` are completely untouched (`git diff --stat -- engine/
services/ stores/` empty).

**Validation — Batch 4**

| Command              | Result                                                                                                                                                                                                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`     | ✅ Pass (after narrowing `Portfolio.debt`'s asset type, see above)                                                                                                                                                                                                              |
| `pnpm lint`          | ✅ Pass                                                                                                                                                                                                                                                                         |
| `pnpm format:check`  | ✅ Pass                                                                                                                                                                                                                                                                         |
| `pnpm test`          | ✅ Pass, 810/810 (16 net new)                                                                                                                                                                                                                                                   |
| `pnpm test:coverage` | ✅ 94.91% statements / 88.02% branches / 100% functions / 98.42% lines (project-wide). `app/portfolio/page.tsx`: 94.59%/71.42%/100%/98.33% — branch gaps are the same repetitive per-field hidden-input/error-rendering pattern already accepted in this project's other forms. |
| `pnpm build`         | ✅ Pass — `/portfolio`'s bundle grew from 1.24 kB to 2.6 kB, confirming real new content                                                                                                                                                                                        |

**Architecture audit**: `git diff --stat -- engine/ services/ stores/`
empty. No Service file imports from `@/app` or `@/components`. No
`fetch`/`axios`/`XMLHttpRequest`/`process.env`/`infrastructure/`
reference in any new/modified file. `app/portfolio/page.tsx` imports
`calculatePortfolioSummary`/`PortfolioSummary`/`ServiceResult` from
`@/services` directly (for the preview mechanism) and
`usePortfolioStore` from `@/stores/portfolioStore` — the allowed UI →
Store/Services direction, nothing reversed.

**Traceability**: M4-007's "Fields"/"Requirements"/DoD and M4-008's
"Fields"/"Requirements"/DoD are each addressed field-for-field above,
with every deviation ("Price"/"Price source" read-only, "Rate type"
omitted, protocol fields' shared-object handling) documented rather than
silently decided.

---

### Batch 5 — Portfolio Action Preview (M4-009)

Extends `PreviewDiff` (built in Batch 4 for M4-007/M4-008) rather than
adding a new component — M4-009's own Dependencies (M4-007, M4-008) and
"Display" list are a direct refinement of what that component already
showed, not a separate feature.

**Pre-implementation verification (per instruction)**: re-read M4-009's
exact task text directly from `06_TASKS.md` (not from memory/earlier
summary) before writing any code. Confirmed the metrics summary's only
data source is `calculatePortfolioSummary` (M3-005) — `before` comes
from the Store's own cached `record.summary` (Batch 1), `after` from
this file's own preview mechanism (Batch 4); `PreviewDiff` performs no
calculation of its own, only formatting and diffing fields already
present on that Service's output. Grepped `01_PRD.md`/`02_Formulas.md`/
`04_BUILD_GUIDE.md`/`06_TASKS.md` for "risk-increasing" before writing
any classification logic — see below.

**"Display" list — 2 of 3 already shown (Batch 4), 2 added this
batch**: "Net equity change," "LTV change," "Health Factor change" were
already in `PreviewDiff`. Added "Liquidation price change" (handling
`null` on either side for a zero-debt portfolio — conflict #20 — as
"N/A (no debt)," not a fabricated number) and "Warnings" (reads
`after.warnings` directly, `ServiceResult`'s own field from M3-002 — the
real `NO_DEBT`/`NEGATIVE_EQUITY`/etc. warnings the Engine already
produces, not new UI-authored text).

**New finding — no "risk-increasing" definition exists anywhere.**
Grepped the full documentation set; the term appears only in M4-009's
own DoD and Milestone 4's acceptance criteria, with no threshold, band,
or scoring rule anywhere. Per explicit instruction, no risk band, label,
or threshold was invented. Resolved with the most conservative possible
reading: a change is "risk-increasing" exactly when it strictly lowers
Health Factor (`isRiskIncreasing` — `after.healthFactor <
before.healthFactor`) — a directional comparison of two numbers
`calculatePortfolioSummary` already produces, not a new formula, scoring
system, or numeric boundary. If "before" is itself unreadable (should
not occur — the Store only ever holds already-valid portfolios), the
change is conservatively treated as risk-increasing rather than
silently skipping confirmation.

**DoD ("Risk-increasing changes require explicit confirmation after
preview") — a real, additional gate, not just the existing preview hard
gate.** Batch 4 already required preview-before-apply for every change.
This batch adds: when `isRiskIncreasing` is true, `PreviewDiff` renders
a checkbox with an explicit acknowledgment label, and "Apply Changes"
stays disabled until it is checked (`canApply`, shared by both forms) —
on top of the existing preview-exists gate. Non-risk-increasing changes
are completely unaffected — no checkbox renders, "Apply Changes" enables
immediately after preview, exactly as Batch 4 already behaved.
Unchecking/re-editing any field after checking the box clears both the
preview and the acknowledgment together (same `watch()` subscription
Batch 4 already used to invalidate stale previews).

**M3-006 (`previewPortfolioAction`) reconsidered, decision reaffirmed
unchanged from Batch 4.** M4-009 explicitly names M3-006 as a
Dependency, which reopened the question of whether this batch should
switch the preview mechanism to use that Service literally.
Re-examined: `PortfolioAction`'s six variants each change exactly one
field; these forms let a user edit a position field and a protocol
field together in one preview, which no single variant represents.
`previewPortfolioAction`'s own return shape
(`{before: PortfolioSummary, after: PortfolioSummary}`) is structurally
identical to what `PreviewDiff` already consumes, so the M3-006
dependency is satisfied at the architectural level — this feature _is_
"Portfolio Action Preview," built on the same M3-005 Service
`previewPortfolioAction` itself wraps — without calling a Service whose
action union can't represent these forms' combined edits. Kept the
Batch 4 decision rather than reversing it.

**Scope**: only applies to the Collateral/Debt Position Management
forms (M4-007/M4-008's own Dependencies) — not the Creation Flow
(M4-005), which has no "before" portfolio to compare against (there is
no existing portfolio yet when creating one), so risk-increasing
detection has nothing to apply to there.

**Test files**: `tests/unit/app/portfolio/page.test.tsx` (+6 tests:
Liquidation Price change display, the `null`-on-either-side case,
real Warnings surfaced from the Service, the full risk-increasing
confirm-then-apply flow, confirming no checkbox appears for a
non-risk-increasing change, and confirming re-editing after
acknowledging resets both the preview and the acknowledgment). One
pre-existing test's loose `getByText(/Health Factor/)` match became
ambiguous once the new Warnings list could also contain that phrase
(the real `NO_DEBT` warning text) — narrowed to `{ selector: 'dt' }` to
target the metric label specifically, not a text change.

**Browser verification**: started the dev server and drove the
risk-increasing flow with Playwright/Chromium — created a portfolio,
withdrew collateral from 2 to 1 BTC (Health Factor 4 → 2), previewed,
confirmed "Apply Changes" was disabled before checking the
acknowledgment box and enabled immediately after, then applied
successfully. Screenshot confirms the full preview panel (Net Equity
$80,000.00 → $30,000.00, Health Factor 4 → 2, Loan-to-Value 20% → 40%,
Liquidation Price $12,500.00 → $25,000.00, and the checkbox with its
warning label) rendering correctly. Zero console/page errors.

**Scope discipline**: only M4-009 was implemented. No M4-010/M4-011+
work was started (M4-010 was already completed in Batch 2). `engine/`,
`services/`, `stores/`, `types/` are completely untouched (`git diff
--stat -- engine/ services/ stores/ types/` empty) — the only file
touched is `app/portfolio/page.tsx`, plus its test file.

**Validation — Batch 5**

| Command              | Result                                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm typecheck`     | ✅ Pass                                                                                                                                    |
| `pnpm lint`          | ✅ Pass                                                                                                                                    |
| `pnpm format:check`  | ✅ Pass                                                                                                                                    |
| `pnpm test`          | ✅ Pass, 816/816 (6 net new)                                                                                                               |
| `pnpm test:coverage` | ✅ 94.84% statements / 87.88% branches / 100% functions / 98.44% lines (project-wide). `app/portfolio/page.tsx`: 93.47%/73.61%/100%/98.7%. |
| `pnpm build`         | ✅ Pass — `/portfolio`'s bundle grew from 2.6 kB to 2.95 kB, confirming real new content                                                   |

**Architecture audit**: `git diff --stat -- engine/ services/ stores/
types/` empty. No Service file imports from `@/app`. No `fetch`/
`axios`/`XMLHttpRequest`/`process.env`/`infrastructure/` reference in
the modified file. `app/portfolio/page.tsx` imports only
`calculatePortfolioSummary`/`PortfolioSummary`/`ServiceResult` from
`@/services` and `usePortfolioStore` from `@/stores/portfolioStore` —
unchanged from Batch 4, the allowed UI → Store/Services direction.

**Traceability**: M4-009's "Display" list (5 items — 3 pre-existing, 2
added) and its DoD (explicit confirmation for risk-increasing changes)
are each addressed directly above, with the one genuine specification
gap ("risk-increasing" undefined) resolved via the most conservative
possible directional comparison and documented rather than guessed at
with an invented threshold.

---

### Batch 6 — Portfolio Duplication + Portfolio Archive and Delete (M4-011, M4-012)

**Pre-implementation verification (per instruction)**: re-fetched
`origin/main`, confirmed `git diff origin/main..HEAD --stat` was empty
(Batch 5's commit had already landed there under a different local hash
from the manual synchronization), then realigned the local branch onto
`origin/main` before starting. Re-read M4-011/M4-012's exact text
directly from `06_TASKS.md`, plus 03_UI.md's Portfolio Page section —
which documents no Duplicate/Archive/Delete UI details at all, confirming
these two tasks are governed entirely by `06_TASKS.md`'s own text with no
separate UI specification to reconcile.

**Both tasks' core mechanism already existed (Batch 1).** M4-003 itself
required _some_ working `duplicate`/`archive` Store actions (see
`stores/portfolioStore.ts`'s own header comment), so this batch is
primarily UI wiring on `/portfolios` plus the specific Store additions
M4-012's own DoD requires — not new position-editing logic.

**M4-011 (Portfolio Duplication)**: added a "Duplicate" action to every
row on the Portfolio List Page, calling the Store's pre-existing
`duplicate(id)`. No confirmation shown — duplication is non-destructive
and immediately reversible via Delete, matching 03_UI.md's "Every action
is reversible whenever possible" principle. All four Requirements were
already satisfied by the Batch 1 Store implementation (new identity,
copied positions/settings, no synchronization metadata to copy since
`Portfolio` has no such field, appended " (Copy)" name); this batch only
needed to expose the action and verify the DoD ("can be edited
independently") end-to-end through the real UI, which the browser
verification below confirms.

**M4-012 (Portfolio Archive and Delete) — two Store additions plus the
UI**:

- **`archive` now also clears `activePortfolioId`** when the archived
  record was the active one (`stores/portfolioStore.ts`), mirroring
  `delete`'s existing identical fallback. Necessary because M4-012's own
  text requires archiving to "Hide from active lists" — if the archived
  record stayed selected, `/portfolio` would keep showing a hidden
  portfolio as the primary active view, which is a direct contradiction.
- **New `unarchive` Store action** (`stores/portfolioStore.ts`), the
  direct symmetric inverse of `archive`. Justification: M4-012
  distinguishes Archive ("Hide from active lists **while retaining
  data**") from Delete (no such retention language), and its own DoD
  requires archive/delete actions to be "recoverable **where
  documented**." Read literally, this means Archive's documented data
  retention must be reachable by the user, not merely true internally to
  the Store — `unarchive` is that reachability, not a new business rule.
- **Portfolio List Page**: the main list now shows only non-archived
  portfolios; a "Show archived (N)" disclosure (collapsed by default)
  reveals archived rows with "Unarchive" in place of "Archive." Archived
  rows render their name/summary as plain text, not a clickable "select"
  control — selecting (making active) an archived portfolio would itself
  contradict "hide from active lists," so it must be unarchived first.
  This is a genuine specification gap, not obvious from the task text —
  documented as **conflict #27** below.
- **`AppHeader`'s active-portfolio switcher** (M4-010, Batch 2) also now
  excludes archived portfolios — the same "active list" the task's own
  words describe, extended consistently rather than left as a second,
  contradictory active-portfolio surface.
- **Delete**: clicking "Delete" opens an inline, per-row confirmation
  panel — no new global Dialog/Modal component was introduced. None is
  defined anywhere in 03_UI.md's design system, and the only "no modal"
  rule in 03_UI.md ("No modal dialogs on page load") is explicitly scoped
  to the Dashboard's page-load behavior, not a blanket ban on
  user-initiated confirmations elsewhere — an inline expand-to-confirm
  panel satisfies "Require confirmation. Explain consequences." without
  inventing a component this codebase has no other use for yet. The panel
  states plainly that deletion is permanent. If the portfolio being
  deleted is the active one, the panel additionally requires selecting a
  replacement from the other _active_ (non-archived) portfolios before
  "Confirm Delete" enables — the literal text of "Prevent accidental
  deletion of the active portfolio without selecting a replacement." When
  no other active portfolio exists, no replacement can be offered; the
  panel says so and allows the delete to proceed directly (the Store's
  `delete` already nulls `activePortfolioId` in that case, and
  `app/portfolio/page.tsx` already renders a graceful "No portfolio is
  currently selected" state for it, unchanged from earlier batches).

**Test files**:

- `tests/unit/stores/portfolioStore.test.ts` (+8 tests): `archive`
  clearing/not-clearing `activePortfolioId`, `archive`'s not-found error,
  and the full `unarchive` suite (clears `archivedAt`, does not
  independently restore `activePortfolioId`, not-found error).
- `tests/unit/components/layout/AppHeader.test.tsx` (+1 test, 1 renamed):
  confirms archived portfolios are excluded from the switcher.
- `tests/unit/app/portfolios/page.test.tsx` (+11 tests): Duplicate
  creates an independent, appended-name copy; Archive moves a row out of
  the main list into "Show archived"; the archived section renders a
  non-selectable row with "Unarchive"; Unarchive restores it; an
  "all portfolios are archived" message replaces the main list when
  appropriate; Delete's confirmation text and cancel path; deleting a
  non-active portfolio directly (no replacement selector shown); deleting
  the active portfolio requires a replacement selection before "Confirm
  Delete" enables, and applies it; deleting the active portfolio when no
  replacement exists proceeds directly and leaves `activePortfolioId`
  null. One pre-existing test (`lists more recently updated portfolios
first`) was fixed: `getAllByRole('button')` now also matches the new
  Duplicate/Archive/Delete buttons on every row, so the assertion was
  narrowed to `{ name: /^(First|Second)/ }` to target the two select-row
  buttons specifically — a real, necessary update caused by legitimate
  new UI, not a workaround.

**Browser verification**: started the dev server and drove the full
flow with Playwright/Chromium — created two portfolios (using in-app
link navigation rather than `page.goto` for the second, since a real
top-level navigation reloads the document and would wipe the in-memory
Zustand store per Conflict B); duplicated one, archived the copy,
confirmed it left the main list and appeared under "Show archived (1)"
with a non-clickable name area, unarchived it back; selected a portfolio
as active via the switcher, opened its Delete confirmation, confirmed
"Confirm Delete" was disabled until a replacement was chosen from the
offered list (excluding itself, including only active portfolios),
enabled once selected, and completed the deletion, leaving the
replacement as the new active portfolio. Screenshots confirm correct
rendering at every step. Zero console/page errors throughout.

**Scope discipline**: only M4-011 and M4-012 were implemented. `engine/`,
`services/` are completely untouched (`git diff --stat -- engine/
services/` empty); `types/` is untouched (`Portfolio.archivedAt` already
existed from Batch 1). The only non-test files touched are
`stores/portfolioStore.ts`, `app/portfolios/page.tsx`, and
`components/layout/AppHeader.tsx` — the last only for the minimal
archived-filter consistency fix M4-012's own text requires.

**Validation — Batch 6**

| Command              | Result                                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm typecheck`     | ✅ Pass                                                                                                                                    |
| `pnpm lint`          | ✅ Pass                                                                                                                                    |
| `pnpm format:check`  | ✅ Pass                                                                                                                                    |
| `pnpm test`          | ✅ Pass, 833/833 (17 net new)                                                                                                              |
| `pnpm test:coverage` | ✅ 95.16% statements / 88.49% branches / 100% functions / 98.65% lines (project-wide). `app/portfolios/page.tsx`: 98.63%/97.77%/100%/100%. |
| `pnpm build`         | ✅ Pass — `/portfolios`'s bundle grew from 1.38 kB to 2.42 kB, confirming real new content                                                 |

**Architecture audit**: `git diff --stat -- engine/ services/` empty.
`app/portfolios/page.tsx` imports only `usePortfolioStore`/
`PortfolioRecord` from `@/stores/portfolioStore` and `Portfolio` (type
only) from `@/types/portfolio` — no direct Service or Engine import.
`stores/portfolioStore.ts`'s new `unarchive` action reuses the same
`buildSummary`/`notFoundError` helpers `archive` already used — no new
Service call shape introduced. UI → Store → Services → Engine direction
preserved throughout.

**Traceability**: M4-011's four Requirements and its DoD are each
satisfied by the pre-existing Batch 1 Store logic, now reachable through
the UI and verified end-to-end in the browser. M4-012's Archive
(hide-while-retaining), Delete (confirm + explain consequences +
prevent-accidental-active-deletion), and DoD
(predictable-and-recoverable-where-documented) are each addressed
directly above, with the one genuine specification gap (whether an
archived portfolio remains independently selectable) resolved
conservatively and documented as conflict #27 rather than guessed at.

---

### Batch 7 — Manual Price Controls + Protocol Configuration Controls (M4-014, M4-015)

**Batch selection reasoning (this batch's own kickoff had no
user-specified task list, unlike Batches 1–6)**: re-read all remaining
M4 tasks (M4-013 through M4-018) directly from `06_TASKS.md` before
choosing scope. M4-013 (Auto-Save) has a real, deep collision with
Conflict B (no persistence infrastructure before Milestone 8) — its own
DoD asks for "saved/saving/offline/failed" states with nothing durable
to report on, deserving its own isolated batch with a dedicated
conflict writeup, the same treatment Batch 0 gave Conflict #20.
M4-017 (Error Recovery) is broad and independent. M4-018 (Workflow
Tests) explicitly depends on "M4-005 through M4-017" and must come
last. M4-014 and M4-015 were chosen as the next batch because they are
structurally parallel — both are direct, small extensions of the
already-built Collateral/Debt Position Management forms (M4-007/M4-008,
Batch 4), both have every Dependency already satisfied (M3-007, M3-008,
M4-007 — all built in Milestone 3 / Batch 4), and neither collides with
Conflict B, mirroring the precedent of pairing M4-007+M4-008 in Batch 4
itself.

**Pre-implementation verification**: re-fetched `origin/main`, confirmed
`git diff origin/main..HEAD --stat` was empty, realigned the local
branch. Re-read M4-014/M4-015's exact text from `06_TASKS.md`. Grepped
03_UI.md for "manual price"/"protocol configuration"/"freshness"/"stale"
— found nothing beyond the Settings page's _global_ Data Sources section
(Price Provider, Protocol Data, Connection Status, "Display a warning if
data becomes stale") — confirmed these two tasks are governed entirely
by `06_TASKS.md`'s own text, no separate per-portfolio UI spec exists.
Read `services/market/quote.ts` (M3-007) and `services/protocol/quote.ts`
(M3-008) in full: both `normalizeMarketQuote`/`normalizeProtocolQuote`
were fully implemented in Milestone 3 but **never once called from any
UI or Store code** before this batch — confirmed via
`grep -rn "normalizeMarketQuote\|normalizeProtocolQuote" app/ stores/
services/`. Wiring them in is the concrete substance of both tasks.

**Real specification gap found before writing code — neither Engine type
carries a timestamp.** `MarketPrices` (`engine/shared/types.ts`) is
`{ btcPriceUsd: number }`; `ProtocolParameters` has no timestamp field
either. M4-014 names "Timestamp" and M4-015 names "Freshness status" as
required display items with nowhere to read one from. Resolved the same
way `archivedAt` was added in Batch 1: two new Store-managed bookkeeping
fields on `Portfolio` (not the Engine types, which stay exactly as
`02_Formulas.md`/`04_BUILD_GUIDE.md` document them) —
`marketUpdatedAt`/`protocolUpdatedAt` (`types/portfolio.ts`), ISO 8601,
scoped per-field so editing the price doesn't misrepresent the protocol
parameters as freshly changed and vice versa. Never part of
`portfolioInputSchema` — set only by the Store, the same pattern already
used for `id`/`createdAt`/`updatedAt`/`archivedAt`.

**Store changes** (`stores/portfolioStore.ts`): `create` sets both
timestamps to the creation instant. `update` now compares the merged,
revalidated `market`/`protocol` against the existing record
field-by-field (new `marketPricesEqual`/`protocolParametersEqual`
helpers) and only bumps the corresponding timestamp when the value
actually changed — editing the portfolio name must not make the price
look freshly re-entered, and submitting the _same_ price back (e.g. an
unrelated field edit that still round-trips the whole form) correctly
does not bump it either. `duplicate`/`archive`/`unarchive` all pass both
timestamps through unchanged via `...existing.portfolio`, since none of
those operations changes the underlying price/protocol values.

**M4-014 (Manual Price Controls)** — Include: "Price input, Timestamp,
Manual-data indicator, Reset action, Stale-data warning." "Price input"
already existed (Batch 4). Added to `CollateralPositionForm`:

- **Manual-data indicator / Timestamp**: a "Manual" badge plus "Last
  updated: <formatted `marketUpdatedAt`>" — always "Manual" because no
  live price provider exists anywhere in this codebase (M3-007's own
  header comment), not a guess.
- **Stale-data warning**: reuses `normalizeMarketQuote` (`getMarketQuote`
  helper) rather than re-implementing its already-documented, non-invented
  5-minute Fresh/Stale rule (`04_BUILD_GUIDE.md` "PRICE FRESHNESS") —
  the concrete reason M4-014 names M3-007 as a Dependency. Shown only
  when `freshness === 'stale'`.
- **Reset action**: `resetField('market.btcPriceUsd')` reverts an
  _unsaved_ edit back to the currently-applied price — the only coherent
  meaning of "reset" here, since there is no live/cached price to reset
  _to_ (no provider or cache candidate is ever producible in this app).
  Clears any open preview automatically, via the same `watch()`
  subscription Batch 4 already used.

**M4-015 (Protocol Configuration Controls)** — Include: "Maximum LTV,
Liquidation threshold, Borrow rate, Parameter source, Freshness status."
The three parameter fields already existed (Batch 4). Added "Parameter
source: Manual" badge and "Last updated" to **both**
`CollateralPositionForm` (edits Maximum LTV/Liquidation threshold) and
`DebtPositionForm` (edits Borrow rate) — both operate on the same shared
`portfolio.protocol` object, and M4-015's own Dependencies list only
M4-007 despite naming "Borrow rate," a field that actually lives in
M4-008's form — a minor pre-existing inconsistency in the task's own
Dependencies, not a new conflict. "Freshness status" reuses
`normalizeProtocolQuote` (`getProtocolQuote` helper) — deliberately
_not_ a fresh/stale classification: M3-008's own header comment already
explains why no such threshold was invented for protocol data (no
documented rule exists, unlike prices), so this batch reused that
existing decision rather than contradicting it with a UI-invented one.
Displayed as a plain "Last updated" timestamp with no stale/fresh
language.

**"Preset selection" still not offered — same root cause as conflict
#24 (Batch 3), not a new conflict.** M4-015's Description repeats
"select a supported protocol preset or enter parameters manually," but
(as already established in Batch 3) no concrete Aave V3 preset values
exist anywhere in the documentation. Resolved identically: manual entry
only.

**DoD ("Changes trigger recalculation and clearly identify manual
assumptions")**: satisfied entirely by mechanisms that predate this
batch — the preview hard gate (Batch 4) covers "trigger recalculation";
the "Manual"/"Parameter source: Manual" badges cover "identify manual
assumptions." No new logic was needed for the DoD itself.

**Test files**:

- `tests/unit/stores/portfolioStore.test.ts` (+7 tests): `create` sets
  both timestamps to the creation time; `update` bumps `marketUpdatedAt`
  on an actual price change while leaving `protocolUpdatedAt` alone (and
  the symmetric case for a protocol change); both stay unchanged when
  neither `market` nor `protocol` is part of the update; `marketUpdatedAt`
  stays unchanged when the submitted price equals the current price (not
  just "market wasn't in the payload," but "market was resubmitted
  unchanged"); `duplicate` carries both timestamps over unchanged. Used
  `vi.useFakeTimers()`/`vi.setSystemTime()` for deterministic,
  collision-free before/after timestamps rather than relying on real
  elapsed wall-clock time between two fast calls.
- `tests/unit/app/portfolio/page.test.tsx` (+8 tests): Manual badge and
  timestamp render for the price; no stale warning on a freshly created
  portfolio; stale warning appears once `marketUpdatedAt` is set more
  than 5 minutes in the past (via direct Store manipulation, mirroring
  the fake-timers precision concern above); Reset reverts an unsaved
  price edit and clears any open preview; Parameter source/timestamp
  render on both the Collateral and Debt forms; no preset selector is
  offered. One pre-existing test (`renders exactly this task's own
"Fields" list, prefilled`, M4-007) updated: the old plain-text "Price
  source: Manual" assertion no longer matches the new badge markup,
  replaced with `getByText('Manual', { selector: 'span' })` — a real,
  necessary update caused by legitimate new UI, not a workaround.

**Browser verification**: started the dev server and drove the full
flow with Playwright/Chromium — created a portfolio, confirmed the
"Manual" badge and "Parameter source: Manual" badges (with their
timestamps) render on both forms, edited the price field, previewed the
change, clicked "Reset price," and confirmed both the field reverted to
the applied value and the open preview cleared. Screenshot confirms
correct rendering of every new element. Zero console/page errors.

**Scope discipline**: only M4-014 and M4-015 were implemented. `engine/`
is completely untouched (`git diff --stat -- engine/` empty) — both
Engine types (`MarketPrices`/`ProtocolParameters`) are exactly as
`02_Formulas.md`/`04_BUILD_GUIDE.md` document them, with the new
timestamps living one layer up on `Portfolio` instead. The only
non-test files touched are `types/portfolio.ts`,
`stores/portfolioStore.ts`, and `app/portfolio/page.tsx`.

**Validation — Batch 7**

| Command              | Result                                                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`     | ✅ Pass                                                                                                                                     |
| `pnpm lint`          | ✅ Pass                                                                                                                                     |
| `pnpm format:check`  | ✅ Pass                                                                                                                                     |
| `pnpm test`          | ✅ Pass, 847/847 (14 net new)                                                                                                               |
| `pnpm test:coverage` | ✅ 95.20% statements / 88.61% branches / 100% functions / 98.67% lines (project-wide). `app/portfolio/page.tsx`: 94.05%/75.60%/100%/98.83%. |
| `pnpm build`         | ✅ Pass — `/portfolio`'s bundle grew from 2.95 kB to 3.44 kB, confirming real new content                                                   |

**Architecture audit**: `git diff --stat -- engine/` empty.
`app/portfolio/page.tsx` imports `normalizeMarketQuote`/
`normalizeProtocolQuote`/`calculatePortfolioSummary` from `@/services`
(the Service layer's own public entry point) and `usePortfolioStore`
from `@/stores/portfolioStore` — no direct Engine import anywhere.
`stores/portfolioStore.ts` still imports only from `@/services` and
`@/types/portfolio`, unchanged. UI → Store/Services → Engine direction
preserved throughout; two already-built, previously-unused Services
(M3-007, M3-008) are now actually wired to a UI for the first time,
which is the whole substance of this batch.

**Traceability**: M4-014's five Include items (1 pre-existing, 4 added)
and its DoD ("ProfitPilot remains fully functional without external
price providers" — already true, since "Manual" was always the only
reachable value) are addressed directly above. M4-015's five Include
items (3 pre-existing, 2 added) and its DoD are addressed directly
above, with the one root cause it shares with conflict #24 (no preset
values exist) resolved identically rather than treated as new.

---

### Batch 8 — Portfolio Auto-Save (M4-013)

**Pre-implementation verification**: re-fetched `origin/main`, confirmed
`git diff origin/main..HEAD --stat` was empty, realigned the local
branch. Re-read M4-013's exact text from `06_TASKS.md`, plus
`04_BUILD_GUIDE.md`'s "AUTO SAVE" section (the only other place auto-save
is discussed at all: "ProfitPilot automatically saves Portfolio
changes... Auto-save should occur after meaningful changes. No manual
save button is required"). Cross-referenced every M4-013 Requirement
against what Batches 1–7 already built, since M4-013's own Dependencies
(M4-003, M4-006, M4-007, M4-008) are all already-implemented — this
batch's real content is auditing and closing gaps in existing code, not
building new forms.

**Conflict #28 (new) — M4-013's DoD requires "auto-save," but Batches
4–5 already require the exact opposite for the Collateral/Debt Position
Management forms.** `04_BUILD_GUIDE.md`'s auto-save principle is stated
with no field-level carve-out, and M4-013 names M4-007/M4-008 as
Dependencies — a literal reading suggests extending debounced auto-save
to position/protocol/price edits too. But M4-009's own DoD
("Risk-increasing changes require explicit confirmation after preview")
was implemented, approved, and tested across two batches specifically
for those same fields, via an explicit Preview → Apply → (conditional)
risk-acknowledgment gate. Auto-saving those fields would silently apply
changes — including risk-increasing ones — the instant a keystroke
lands, deleting the confirmation mechanism M4-009 required. **Resolved
in favor of the more specific, later-established, already-implemented
rule**: auto-save (debounce) continues to apply only to
`PortfolioDetailsForm` (M4-006, unchanged since Batch 3, whose fields —
name/description/currency/safety targets — carry no risk-increasing
meaning). This is a genuine tension between two documented principles,
not an invented rule, and resolving it by keeping the more specific,
already-approved behavior (rather than regressing M4-009 to satisfy a
looser general statement) matches how every other conflict in this
project has been resolved.

**"Display save state"**: `stores/portfolioStore.ts`'s `saveStatus`
field (Batch 1) previously never left `'idle'` — a deliberate,
documented Conflict B stub with nothing real to report on. This batch
makes it real: every mutating action (`create`/`update`/`duplicate`/
`archive`/`unarchive`/`delete`) now transitions `'saving'` → `'saved'`
on success or `'error'` on a validation/not-found failure.
`select`/`load` are left untouched — neither persists anything.
`app/portfolio/page.tsx` now renders this one global value once, at the
top of the page (`formatSaveStatus`), the same "one global field, shown
plainly" pattern the Portfolio List Page (Batch 2) already used for this
exact field — that page's own existing `Storage: {saveStatus}` text now
correctly shows "saved"/"error" instead of a permanent "idle", with no
code change needed there.

**Two of the DoD's four named states are real; the other two are
deliberately not built, for reasons beyond "not yet done":**

- **`'saving'` is implemented as a real, distinct state-machine
  transition** (verifiable via `usePortfolioStore.subscribe`, not just
  `getState()` after the fact) but is **not user-observable** in
  practice: every mutation here is a synchronous in-memory write with no
  I/O to await, so `'saving'` is set and overwritten by `'saved'`/
  `'error'` within the same synchronous call, before React ever renders
  it. No `setTimeout`/artificial delay was added to fake a visible
  "Saving…" moment — doing so would misrepresent this Store's actual
  (instantaneous) behavior, the same honesty principle Batch 1 already
  applied to `loadStatus`.
- **`'offline'` is permanently unreachable, and deliberately not wired to
  `navigator.onLine`.** This Store makes zero network requests, so
  nothing about its behavior depends on connectivity. Adding an
  online/offline listener would be real, working code with a false
  meaning — implying "your changes aren't saved because you're offline,"
  which is untrue in this architecture (saves succeed identically either
  way, since "save" means "commit to memory," not "reach a server").
- **No "Retry transient failures" mechanism was built.** The only failure
  mode this Store has is Zod validation, which is deterministic —
  resubmitting the same invalid input fails identically every time,
  making "retry" meaningless. The existing inline field-level errors
  (M4-002/M4-006/M4-007/M4-008) already give the correct response:
  let the user fix their input.

**"Avoid saving invalid drafts"**: already true everywhere on this page
before this batch (every form's data passes its own Zod schema before
`store.update()` is ever called, and the Store re-validates again
independently) — confirmed, no new code needed.

**"Prevent stale updates from overwriting newer state" — verified at the
Store layer, and one genuinely reachable gap found and fixed at the UI
layer.** The Store itself already guarantees this structurally: every
action reads `get().portfolios[id]` fresh at call time, and JavaScript's
single-threaded execution means no two `set()`/`get()` calls can
interleave — added a direct test proving two synchronous back-to-back
`update()` calls always leave the later one in effect. Auditing the same
Requirement across the three forms on this page surfaced a real,
previously-unaddressed gap: `CollateralPositionForm`/`DebtPositionForm`
only cleared an open preview when _their own_ fields changed (`watch()`,
Batch 4) — not when a _sibling_ form applied a change to the same
portfolio. A user could preview a Collateral edit, then apply a Debt
edit in the other form, and the Collateral form's now-stale preview
would still show "Apply Changes" enabled. Both forms now also clear
their preview/risk-acknowledgment whenever `portfolio.updatedAt` changes
for any reason (`useEffect(() => {...}, [portfolio.updatedAt])`),
closing this gap. This is a stale _preview_ (component-local UI state),
not a stale _Store write_ — the Store was never actually at risk.

**Test files**:

- `tests/unit/stores/portfolioStore.test.ts` (+11 tests): `saveStatus`
  reaches `'saved'`/`'error'` for every mutating action's success/failure
  path (including the not-found path for `update`/`archive`/`unarchive`/
  `delete`/`duplicate`); the `'saving'` transition is observable via
  direct `subscribe`, not just the final `getState()`; `'offline'` is
  never reached; `select`/`load` leave `saveStatus` untouched; two
  back-to-back synchronous updates always leave the later one in effect.
  One pre-existing test (`saveStatus stays idle after a successful
create`) removed — its own premise (Batch 1's documented stub) is
  exactly what this batch replaces with real behavior; replaced with a
  dedicated `saveStatus transitions (M4-013)` describe block.
- `tests/unit/app/portfolio/page.test.tsx` (+4 tests): the save-state
  line displays "Saved" once a portfolio exists; it reactively updates
  to an error message when the Store reports one (triggered directly via
  the Store, since RHF's own Zod resolver already blocks every UI path
  that would submit a Store-invalid combination — confirmed while writing
  this test, not assumed); the cross-form stale-preview fix (Collateral
  preview clears when Debt applies a change, and vice versa is
  structurally identical); and a negative-space test confirming an
  update to an _unrelated_ portfolio does not clear a preview open on the
  currently-rendered one (each form only reacts to its own `portfolio`
  prop, not global Store churn).
- `tests/unit/app/portfolios/page.test.tsx` (1 test updated): the
  existing `Storage: idle` assertion updated to `Storage: saved`, since
  `saveStatus` legitimately no longer stays permanently `'idle'` once any
  portfolio has been created.

**Browser verification**: started the dev server and drove the flow with
Playwright/Chromium — created a portfolio, confirmed the page displays
"Saved"; opened a preview on the Collateral form, then applied a change
via the Debt form, and confirmed the Collateral form's "Apply Changes"
button became disabled again (the stale-preview fix) with the save
status still correctly reading "Saved" after the Debt form's own Apply.
Screenshot confirms correct rendering. Zero console/page errors.

**Scope discipline**: only M4-013 was implemented. `engine/` and
`services/` are completely untouched (`git diff --stat -- engine/
services/` empty) — this batch is entirely Store state-machine wiring
and two small, targeted UI fixes. `types/portfolio.ts` was not touched
(no new fields were needed for this task). The only non-test files
touched are `stores/portfolioStore.ts` and `app/portfolio/page.tsx`.

**Validation — Batch 8**

| Command              | Result                                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm typecheck`     | ✅ Pass                                                                                                                                    |
| `pnpm lint`          | ✅ Pass                                                                                                                                    |
| `pnpm format:check`  | ✅ Pass                                                                                                                                    |
| `pnpm test`          | ✅ Pass, 859/859 (16 net new; 1 removed and replaced)                                                                                      |
| `pnpm test:coverage` | ✅ 95.20% statements / 88.44% branches / 100% functions / 98.61% lines (project-wide). `stores/portfolioStore.ts`: 96.55%/94%/100%/96.29%. |
| `pnpm build`         | ✅ Pass — `/portfolio`'s bundle grew from 3.44 kB to 3.57 kB, confirming real new content                                                  |

**Architecture audit**: `git diff --stat -- engine/ services/` empty.
`app/portfolio/page.tsx` imports only `PortfolioSaveStatus`/
`usePortfolioStore` (type + hook) from `@/stores/portfolioStore`, plus
the same `@/services` imports as before — no new Service or Engine
import. `stores/portfolioStore.ts`'s new `set({ saveStatus: ... })`
calls are pure Zustand state transitions, no new Service call shape. UI
→ Store/Services → Engine direction preserved throughout.

**Traceability**: M4-013's five Requirements and its four-state DoD are
each addressed directly above — three Requirements fully satisfied
("Debounce rapid edits" pre-existing, "Avoid saving invalid drafts"
confirmed pre-existing, "Prevent stale updates" verified plus one real
gap fixed), one Requirement ("Retry transient failures") correctly
not-applicable given no transient failure mode exists, and the DoD's
four named states resolved as two real + two deliberately, honestly
unreachable (documented as conflict #28) rather than faked.

---

### Batch 9 — Portfolio Error Recovery (M4-017)

**Pre-implementation verification**: re-fetched `origin/main`, confirmed
`git diff origin/main..HEAD --stat` was empty, realigned the local
branch. Re-read M4-017's exact text from `06_TASKS.md`, plus every
"ERROR RECOVERY"/"ERROR HANDLING"/"DATA RECOVERY"/"BACKUP & RECOVERY"
section across `01_PRD.md`, `03_UI.md`, and `04_BUILD_GUIDE.md` — six
sections total, each covering a different layer (state-machine-level,
calculation-level, storage-corruption-level, and export-format-level).
Cross-referencing all of them, rather than only `06_TASKS.md`'s own
short "Include" list, is what surfaced the concrete, correct scope for
each of M4-017's four Include items below.

**"Loading failures" — not reachable, same treatment as M4-013's
`'offline'`.** `load()` (Batch 1) has no persistence layer to fail
against under Conflict B; nothing exists yet to recover from.

**"Validation/saving failures — restore last valid state" — already
structurally guaranteed, confirmed rather than assumed.**
`store.update()`/`store.create()` only ever call their mutating `set()`
_after_ Zod validation succeeds — a rejected update never touches the
existing, still-valid record. This is exactly 01_PRD.md's own generic
state-machine "ERROR RECOVERY" pattern ("If a state update fails →
Rollback → Restore Previous State → Display Error → Continue Running"),
already satisfied by the existing validate-before-mutate design. No new
code was needed for this half of the DoD.

**"Calculation failures" — genuinely reachable via real, Zod-valid
input, confirmed by reading the Engine functions
`calculatePortfolioSummary` composes (not assumed) — the real substance
of this batch.** Three real divide-by-zero cases exist for otherwise
Zod-valid portfolios: zero collateral with nonzero debt
(`calculateLoanToValue`), collateral value exactly equal to debt value
(`calculateEffectiveLeverage`), and a zero Liquidation threshold with
nonzero debt (`calculateLiquidationPrice`) — all three verified via new
Store-level tests, not just reasoned about. The Portfolio Creation Flow
(M4-005) and Position Management forms (M4-007/M4-008) can all produce
these, and `store.create()`'s own redirect to `/portfolio` happens
regardless of whether the resulting summary calculated successfully —
so a real user can reach a portfolio whose Detail page previously showed
no explicit error at all (only scattered "—" fallbacks in sub-components).
Closed with:

- **`store.recomputeSummary`** (new Store action,
  `stores/portfolioStore.ts`) — the "Retry" mechanism. Re-runs
  `buildSummary` against the already-stored, unchanged `portfolio` and
  re-caches the result.
- **`CalculationErrorBanner`** (new component, `app/portfolio/page.tsx`)
  — shown when the active portfolio's cached summary has `ok: false`:
  the real error message (`summary.errors[0].message`), "Retry",
  "Return to portfolio list", and "Download recovery copy." Additive per
  03_UI.md's own "Other application sections should remain functional
  whenever possible" — the Details/Collateral/Debt forms keep rendering
  underneath it.
- **Portfolio List Page** (`app/portfolios/page.tsx`) extended with the
  identical pattern per-row, for any portfolio whose cached summary
  failed — consistent with 03_UI.md's ERROR RECOVERY section being a
  general, app-wide pattern, not scoped to one page.

**Real, tested finding — "Retry" cannot fix anything by itself, and this
was discovered by writing a test, not assumed in advance.** An earlier
draft test tried to prove "Retry recovers once the data is fixed
elsewhere," and failed — because every _other_ mutating Store action
already recomputes and re-caches the summary on every commit (Batch 1),
so a cached summary is _never_ stale relative to the currently-stored
portfolio. Fixing the position through the Collateral/Debt forms (which
call `store.update()`) already clears the error automatically, with no
Retry click ever needed — the error only persists while the underlying
data is still genuinely invalid-in-this-specific-sense, in which case
re-running the same deterministic calculation against the same data
reproduces the identical failure every time. "Retry" is still built,
because 03_UI.md explicitly and concretely names a "Retry Button" as
part of its ERROR RECOVERY display — but its honest value is matching
that documented pattern and giving the user a visible re-attempt action,
not a claim that clicking it resolves the error on its own. Both the
Store's own header comment and `app/portfolio/page.tsx`'s M4-017 note
were revised mid-implementation to state this honestly once the test
proved it, rather than leaving the earlier "legitimate retry" framing
uncorrected.

**"Diagnostic Information (Developer Mode)" — not built.** 03_UI.md
names this as part of the same ERROR RECOVERY display, but "Developer
Mode" itself does not exist anywhere in this codebase yet — no task
reached so far builds it. Left undone pending that mode's own task,
rather than inventing an ungated "always show diagnostics" panel.

**"Export recovery copy where possible"** — new
`utils/portfolioRecoveryExport.ts`: `downloadPortfolioRecoveryCopy`
triggers a standard Blob + temporary-anchor JSON download of the
portfolio's own raw data. Deliberately scoped narrower than
`04_BUILD_GUIDE.md`'s illustrative "every export includes: Application
Version, Engine Version, Formula Version, Export Timestamp" shape:
"Engine Version"/"Formula Version" describe a _successful_ calculation's
own metadata (`ServiceMetadata`), which by definition doesn't exist for
an export that exists specifically because the calculation _failed_ —
fabricating one would misrepresent what happened. Only `exportedAt` and
`schemaVersion` (`'0.1.0'`, matching this application's own Version 0.1
framing) are included alongside the portfolio itself — exactly what
01_PRD.md's own "BACKUP & RECOVERY" section names for Version 0.1:
"Local export only... Every export should include schema versioning."
This is also **not** the fuller "Export Portfolio" feature 03_UI.md's
Dashboard "PAGE ACTIONS"/"EXPORT OPTIONS" sections describe (CSV/PDF
formats, calculated summary fields) — that is a separate, unassigned
task; building it here would be scope creep beyond what M4-017's own
text asks for.

**Test files**:

- `tests/unit/stores/portfolioStore.test.ts` (+8 tests): each of the
  three real divide-by-zero scenarios is confirmed to actually produce a
  failed, cached summary from real `create()` calls (not fabricated
  Store state); `recomputeSummary` re-derives without changing data,
  recovers once the data is genuinely fixed by a real `update()`, reports
  not-found for an unknown id, and does not touch `saveStatus`. `validInput`
  extended to accept overrides (matching the pattern already used in
  other test files) so these scenarios could be constructed directly.
- `tests/unit/portfolioRecoveryExport.test.ts` (new, 3 tests): the
  recovery copy includes the schema version/timestamp/portfolio;
  the download triggers a Blob + anchor click and revokes the URL; the
  filename is derived from the portfolio id.
- `tests/unit/app/portfolio/page.test.tsx` (+6 tests): the error banner
  shows the real message, Retry, Return-to-list link, and Download
  button; it does not appear for a healthy portfolio; the other forms
  keep rendering alongside it; Retry recomputes without crashing and
  reproduces the same failure; a fix applied through the Store already
  clears the banner before Retry is ever needed; Download triggers a
  real download (mocked Blob/anchor APIs, matching the utility's own
  test pattern). `createAndSelect` extended to accept overrides.
- `tests/unit/app/portfolios/page.test.tsx` (+5 tests): the identical
  set of behaviors verified per-row on the List Page.

**Browser verification**: started the dev server and drove the full flow
with Playwright/Chromium — created a portfolio with zero collateral and
nonzero debt through the real Creation Flow, confirmed the error banner
rendered with the exact Engine error message and all three actions,
confirmed the Details/Collateral/Debt forms remained usable underneath
it, triggered and confirmed a real file download, clicked Retry and
confirmed the same failure persisted (proving it recomputed rather than
silently no-op'd), then fixed the position through the real Collateral
form (including checking the risk-acknowledgment checkbox, since a
failed `beforeSummary` is conservatively always risk-increasing per
M4-009's own `isRiskIncreasing` logic) and confirmed the banner cleared
automatically. Screenshots confirm correct rendering at every step. Zero
console/page errors.

**Scope discipline**: only M4-017 was implemented. `engine/` and
`services/` are completely untouched (`git diff --stat -- engine/
services/` empty) — this batch adds one new Store action (a pure
re-derivation, no new Service call shape), one new small utility module,
and UI wiring on the two existing pages that already display portfolio
summaries. `types/portfolio.ts` was not touched.

**Validation — Batch 9**

| Command              | Result                                                                                                                                                                                                                                                               |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`     | ✅ Pass                                                                                                                                                                                                                                                              |
| `pnpm lint`          | ✅ Pass                                                                                                                                                                                                                                                              |
| `pnpm format:check`  | ✅ Pass                                                                                                                                                                                                                                                              |
| `pnpm test`          | ✅ Pass, 880/880 (22 net new)                                                                                                                                                                                                                                        |
| `pnpm test:coverage` | ✅ 95.42% statements / 88.58% branches / 100% functions / 98.64% lines (project-wide) — `services/portfolio/summary.ts` improved from 90.62% to 93.75% statements, since the new divide-by-zero tests exercise real failure branches that were previously uncovered. |
| `pnpm build`         | ✅ Pass — `/portfolio`'s bundle grew from 3.57 kB to 4.03 kB, `/portfolios`'s from 2.42 kB to 2.75 kB, confirming real new content                                                                                                                                   |

**Architecture audit**: `git diff --stat -- engine/ services/` empty.
`app/portfolio/page.tsx` and `app/portfolios/page.tsx` both import
`downloadPortfolioRecoveryCopy` from `@/utils/portfolioRecoveryExport`
(a new, small, dependency-free utility) alongside their existing
`@/stores/portfolioStore` imports — no new Service or Engine import
anywhere. `stores/portfolioStore.ts`'s new `recomputeSummary` reuses the
existing `buildSummary`/`notFoundError` helpers, no new Service call
shape. UI → Store/Utils → Services → Engine direction preserved
throughout.

**Traceability**: M4-017's Description (loading/calculation/validation/
saving failures) and all four Include items (Retry, Return to portfolio
list, Restore last valid state, Export recovery copy) are addressed
directly above, with the DoD ("A failed operation does not silently
destroy or replace valid portfolio data") confirmed already true by
construction and reinforced with a new direct test. No new
specification conflict was raised — every ambiguity resolved by reading
the fuller cross-document ERROR RECOVERY context rather than
`06_TASKS.md`'s short Include list in isolation.

---

### Batch 10 — Portfolio Workflow Tests (M4-018) — FINAL MILESTONE 4 BATCH

**Pre-implementation verification**: re-fetched `origin/main`, confirmed
`git diff origin/main..HEAD --stat` was empty, realigned the local
branch. Re-read M4-018's exact text from `06_TASKS.md`. Dependencies
list "M4-005 through M4-017" — every other Milestone 4 UI/Store task —
confirming this is the final M4 batch by construction, not by
assumption. DoD: "Critical portfolio workflows pass in integration and
Playwright tests" — two named test layers, taken literally as two
distinct test suites, not one.

**No new application code — this batch is entirely test infrastructure,
confirmed by `git diff --stat -- ':!tests/**' ':!*.test.ts'
':!*.spec.ts'` being empty.** M4-018's own Description ("Test complete
portfolio-management workflows") and DoD name only tests; every feature
its "Cover" list exercises (create, switch, edit, duplicate, archive,
delete, recover) was already built in Batches 1–9.

**Two files, one per DoD-named layer**:

- `tests/integration/portfolio/portfolioWorkflows.test.ts` (new,
  Vitest, 12 tests) — follows the exact precedent
  `tests/integration/services/coreWorkflows.test.ts` (M3-014) already
  established: chain real, non-mocked `usePortfolioStore` actions
  across multiple steps in one continuous test, one `describe` per
  "Cover" item, in order. Deliberately does **not** render React
  components — the ~180 tests already spread across the five per-page
  unit test files (Batches 1–9) exhaustively cover individual field
  validation, error rendering, and single-action behavior in isolation;
  re-rendering pages here would test nothing new. What this file adds
  that nothing else does: multi-step sequences spanning several Store
  actions in one test (create → edit → duplicate → archive → delete,
  asserting state at each step), proving the _workflow_ holds, not just
  each action individually.
- `tests/e2e/portfolioWorkflows.spec.ts` (new, Playwright, 10 tests) —
  drives the actual compiled app in Chromium: real navigation, real
  clicks, the full stack (Next.js routing, React Hook Form, Zustand,
  Services, Engine) working together, the one layer no other Milestone 4
  test exercises (every prior batch's "browser verification" was an
  ad-hoc scratchpad script, run once and discarded — this is the first
  time equivalent coverage is committed as a permanent, re-runnable
  spec). One `test()` per "Cover" item; "Recover from invalid input" is
  covered twice (a plain Zod validation error, and M4-017's calculation-
  failure banner), since both are real, distinct "invalid input"
  scenarios in this codebase.

**In-app link navigation, not `page.goto()`, for every multi-portfolio
Playwright scenario** — the exact fix Batch 6's manual browser
verification already found and applied (a real top-level navigation
reloads the document and wipes the in-memory Zustand store, Conflict B),
now encoded permanently in a `createPortfolio` test helper instead of
re-discovered informally each time.

**Real regression found and fixed — `tests/e2e/navigation.spec.ts`
(Milestone 1) had never actually been run until this batch executed the
full Playwright suite for the first time.** `getByRole('link', { name:
'Portfolio' })` became ambiguous once `AppHeader`'s portfolio switcher
(M4-010, Batch 2) added its own "View portfolios"/"No portfolios yet —
create one" links, both of which also match "Portfolio" as a
case-insensitive substring — Playwright's default (non-exact) role-name
matching. This had been silently broken since Batch 2 with nothing to
catch it, since `pnpm test:e2e` was never part of any prior batch's
validation pipeline (only `pnpm test`, the Vitest unit/integration
suite, was). Fixed by scoping the locator to the sidebar's own already-
existing `<nav aria-label="Primary">` landmark
(`components/layout/AppSidebar.tsx`) — a one-line locator fix, not an
application change; the sidebar's "Portfolio" link was never actually
ambiguous to a real user, only to Playwright's unscoped role-name
matching once more same-named links existed on the page.

**Locator-precision bugs found and fixed while writing the Playwright
spec — all test-script issues, not application bugs**, the same
recurring class of mistake already documented across this project's own
ad-hoc browser-verification scripts in prior batches: unscoped
`getByRole`/`getByText` matching more elements than intended once a
page has several similarly-worded controls (e.g. a row's own
accessible name containing "Updated Jul 26..." also matching a plain
`{ name: 'Archive' }` substring search intended for the row's dedicated
"Archive" button; an archived row's name span also containing the
"Archived" badge text, breaking an exact-text match). Resolved with
`exact: true` where appropriate and a shared `rowByExactName` helper
mirroring the identical fix already applied in
`app/portfolios/page.tsx`'s own test file during Batch 6.

**Browser verification**: this batch's own Playwright suite _is_ the
browser verification — no separate ad-hoc script was needed, since the
committed spec now exercises every workflow directly. All 12 Playwright
tests (10 new + 2 pre-existing, including the fixed regression) pass
against a real production build (`pnpm build` + `pnpm start`, the
project's existing `playwright.config.ts`), not the dev server.

**Scope discipline**: only M4-018 was implemented — three test files
touched/added, zero application source files. `git diff --stat --
':!tests/**' ':!*.test.ts' ':!*.spec.ts'` confirms this precisely.

**Validation — Batch 10**

| Command                      | Result                                                                                                                                                                                             |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`             | ✅ Pass                                                                                                                                                                                            |
| `pnpm lint`                  | ✅ Pass                                                                                                                                                                                            |
| `pnpm format:check`          | ✅ Pass                                                                                                                                                                                            |
| `pnpm test` (Vitest)         | ✅ Pass, 892/892 (12 net new)                                                                                                                                                                      |
| `pnpm test:coverage`         | ✅ 95.42% statements / 88.58% branches / 100% functions / 98.64% lines (project-wide) — unchanged from Batch 9, since the new integration tests exercise already-covered Store/Service code paths. |
| `pnpm test:e2e` (Playwright) | ✅ Pass, 12/12 (10 new + 2 pre-existing, one of which was a real regression fixed this batch)                                                                                                      |
| `pnpm build`                 | ✅ Pass — bundle sizes unchanged from Batch 9 (no application code touched)                                                                                                                        |

**Architecture audit**: `git diff --stat -- ':!tests/**' ':!*.test.ts'
':!*.spec.ts'` empty — zero non-test files changed except the one-line
locator fix in `tests/e2e/navigation.spec.ts` itself (a test file). No
new Service, Engine, or Store code; the integration tests call only the
already-public `usePortfolioStore` API, the same one every other
Milestone 4 test file already uses.

**Traceability**: M4-018's Description and all ten "Cover" items are
each addressed by name across the two new test files (one `describe`/
`test` block per item, matching the task's own list order), and the DoD
("Critical portfolio workflows pass in integration and Playwright
tests") is satisfied literally — both named layers exist, are committed,
and pass. **This is the final Milestone 4 task** (Dependencies:
"M4-005 through M4-017," all now complete) — Milestone 4 — Portfolio
Management is complete pending this batch's approval.

---

## Milestone 5 progress

Milestone 4 was confirmed synchronized to GitHub, and a permanent
`MILESTONE_4_COMPLETION.md` snapshot was committed before this milestone
began — the same Batch-0-style documentation review used at the start of
Milestone 4 (re-reading `06_TASKS.md`'s own Milestone 5 section fresh,
not assuming continuity from Milestone 4's numbering) preceded any code
in this section.

### Batch 1 — Dashboard Foundation (M5-001, M5-002, M5-003)

First Milestone 5 task batch, following 06_TASKS.md's own
"IMPLEMENTATION ORDER" ("Dashboard Foundation → Summary Header → KPI
Metrics → Risk Sections → Portfolio Composition → Recommendations →
Responsive and Accessible States → Testing") literally — this batch is
exactly that first named step. Mirrors Milestone 4 Batch 1's own
precedent (types/schema/store before any page content) one layer up:
route + feature structure + view model before any Summary Header/KPI
Grid UI.

**M5-002 — `features/dashboard/`**: created the full suggested directory
skeleton (`components/`, `hooks/`, `services/`, `types/`, `utils/`) plus
`index.ts`, mirroring M1-003's own precedent of pre-creating the full
top-level layout with `.gitkeep` placeholders before every subdirectory
has content. `components/`, `hooks/`, `services/` remain empty
placeholders — no task in this batch needs them yet (M5-004 onward for
components; M5-018 Refresh Workflow for a hook/service).

- **`features/dashboard/tests/` deliberately not created** — a minor,
  mechanical deviation from M5-002's own "Suggested structure" (which
  lists a local `tests/` folder): this project's actually-enforced
  convention, used by every test in this codebase so far, is a top-level
  `tests/unit/<mirror-of-source-path>/` tree (`vitest.config.ts`'s own
  `include` pattern), not co-located per-feature test folders. Following
  the milestone doc's generic suggestion here would fragment coverage
  reporting and break the one-test-tree pattern every other batch has
  used. Tests for this batch live at `tests/unit/features/dashboard/` and
  `tests/unit/app/page.test.tsx` instead.

**M5-003 — `features/dashboard/types/viewModel.ts` +
`utils/buildDashboardViewModel.ts` + `utils/format.ts`**:
`buildDashboardViewModel(portfolio, summaryResult)` converts an
already-computed `ServiceResult<PortfolioSummary>` (M3-005) into a
`DashboardViewModel` — every "Include" item addressed:

- **Raw values / Formatted values / Labels**: `DashboardMetric` bundles
  all three per field (`netPortfolioValue`, `totalCollateral`,
  `totalDebt`, `healthFactor`, `loanToValue`, `leverage`,
  `annualInterestCost`, `liquidationPrice`, `liquidationDistance`,
  `liquidationBuffer`) — directly matching M5-006's later "Cards" list,
  giving that task a ready-made data source without pre-building its UI.
  Units were read directly from `docs/02_Formulas.md`, not assumed: F-023
  Distance to Liquidation is a raw `healthFactor − 1.0` ratio, not a
  percentage; F-025 Liquidation Buffer's own equation already multiplies
  by 100 before the Engine returns it, so displaying it needed a distinct
  `formatPercentagePoints` helper (divide by 100 once, not twice) rather
  than reusing the 0–1-fraction `formatPercent` used for F-020 LTV.
- **Status classifications — deliberately scoped narrower than 03_UI.md's
  own mockups, to avoid Conflict #1**: 03_UI.md's Dashboard "Market
  Snapshot"/"Health & Risk" sections show a `Portfolio Status`/`Risk
Category` field (example values "Healthy"/"Low") — exactly the Health
  Factor risk-band classification Conflict #1 blocks (thresholds disagree
  across four documents). `DashboardMetric.status` is `'ok' | 'unavailable'`
  only, derived structurally (unavailable only when `rawValue` is `null`
  — currently just the liquidation trio on a zero-debt portfolio, per
  Conflict #20), never from an invented risk-band rule. The full Health
  Factor risk classification remains M5-007's own, later, still-blocked
  task.
- **Warnings**: `ServiceResult.warnings` (M3-002) passed through
  unchanged as a flat top-level list — not attributed to individual
  metrics. M5-003's own "Include" list names "Status classifications" and
  "Warnings" as two separate items; no documented rule anywhere maps a
  given warning code to a specific metric, so inventing an attribution
  heuristic was avoided rather than guessed at.
- **Data freshness**: reuses `normalizeMarketQuote` (M3-007) /
  `normalizeProtocolQuote` (M3-008) exactly as `app/portfolio/page.tsx`'s
  own `getMarketQuote`/`getProtocolQuote` already do (M4-014/M4-015) —
  same single-manual-candidate shape, same Service-owned staleness
  threshold, duplicated locally rather than extracted to a shared helper
  (matching this codebase's established per-page/per-feature composition
  convention, not a premature shared abstraction).
- **Formula references**: `formulaId` on each `DashboardMetric` is not
  invented — it is the exact Formula ID `services/portfolio/summary.ts`'s
  own header comment already documents for that field (F-002, F-003,
  F-004, F-011, F-020, F-022, F-023, F-024, F-025, F-032).
  `PortfolioSummary` itself carries no per-field Formula ID (only a
  singular `ServiceMetadata.formulaVersion`, Conflict #19), so this is a
  static mapping copied from already-existing documentation, not new
  Service-layer plumbing.
- **"Do not calculate financial metrics. Do not mutate Service
  results."**: verified, not just intended — a dedicated test
  (`buildDashboardViewModel.test.ts`) deep-clones a `ServiceResult`
  before calling the builder and asserts it is unchanged afterward.

**M5-001 — `app/page.tsx`**: replaces the Milestone 1 `PlaceholderPage`
at `/`. Renders every documented portfolio state for real: loading
(`load()` on mount, mirroring `app/portfolios/page.tsx`'s own M4-004
pattern), no-active-portfolio (guides via a link, matching
`app/portfolio/page.tsx`'s own established choice over a hard redirect),
calculation failure (`viewModel.ok === false` — a minimal, honest message
and a link back to `/portfolio` to fix the data, **not** the full "Retry
calculation / Retry refresh / Use last valid data / Export recovery
copy" flow M5-021, a separate later task, is responsible for), and
success (portfolio name, calculation timestamp, and a plain metrics list
proving the Store → Service → View Model → render pipeline end-to-end).
The eventual Summary Header (M5-004), Shared KPI Card component (M5-005)
and Core KPI Grid (M5-006), and every risk/composition/recommendation
section (M5-007–M5-015) are explicitly not built in this batch — each is
its own later, dependency-gated task.

**Coverage config extended**: `vitest.config.ts`'s `coverage.include`
gained `'app/page.tsx'` (previously absent — the placeholder had no logic
worth covering) and `'features/dashboard/**'`.

**Manual browser verification**: built a portfolio via `/portfolios/new`,
navigated to `/` via the sidebar's in-app `<Link>` (not `page.goto()`,
per the established Conflict-B-safe navigation pattern), and confirmed
every metric renders with the correct, real calculated value against a
production build (`pnpm start`) — Net Portfolio Value $80,000.00, Total
Collateral $100,000.00, Total Debt $20,000.00, Health Factor 4,
Loan-to-Value 20%, Effective Leverage 1.25x, Annual Interest Cost
$1,000.00, Liquidation Price $12,500.00, Distance to Liquidation 3,
Liquidation Buffer 75%.

**Scope discipline**: `git diff --stat -- engine/ services/ stores/
types/` empty — zero Engine/Service/Store/type files touched. Only
`app/page.tsx` (route), `vitest.config.ts` (coverage scope), and the new
`features/dashboard/` module were added/changed.

**Validation — Batch 1**

| Command                      | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`             | ✅ Pass                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `pnpm lint`                  | ✅ Pass (after `eslint --fix` for import ordering)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `pnpm format:check`          | ✅ Pass (after Prettier formatting of the new files)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `pnpm test` (Vitest)         | ✅ Pass, 901/901 (9 net new)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `pnpm test:coverage`         | ✅ 95.12% statements / 88.20% branches / 100% functions / 98.68% lines (project-wide). New `app/page.tsx`: 100%/93.33%. New `features/dashboard/utils/`: 79.41%/73.07% — the uncovered branches are the same class of structurally-necessary-but-practically-unreachable defensive code already accepted elsewhere (e.g. `app/portfolio/page.tsx`'s own `getMarketQuote` `MappingFailure` branch): the `Infinity`/`NaN` guards in `format.ts` and the `normalizeMarketQuote`/`normalizeProtocolQuote` failure branches in `buildDashboardViewModel.ts`. |
| `pnpm test:e2e` (Playwright) | ✅ Pass, 12/12 (unchanged — `navigation.spec.ts`'s "dashboard is the default landing page" test already covered the route at the heading level; no new Playwright spec added this batch)                                                                                                                                                                                                                                                                                                                                                                |
| `pnpm build`                 | ✅ Pass — `/` grew from a 0 B placeholder to 1.97 kB (208 kB First Load JS)                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

**Architecture audit**: `git diff --stat -- engine/ services/ stores/
types/` empty. No new file imports `fetch`/`axios`/`XMLHttpRequest`/
`process.env`/`infrastructure/`. `features/dashboard/` imports only from
`@/services` and `@/types/portfolio` (the allowed UI-layer → Services
direction); nothing in `@/services` or `@/engine` imports from
`@/features`. `app/page.tsx` imports only from `@/features/dashboard`
(the module's own `index.ts` barrel) and `@/stores/portfolioStore`, never
reaching into a `features/dashboard/*` subpath directly — the concrete
mechanism behind M5-002's own DoD ("Dashboard-specific implementation
remains isolated from generic shared components").

**Traceability**: M5-001's Requirements/DoD, M5-002's DoD, and M5-003's
Include list/Requirements/DoD are each addressed by name above, with
every scoping decision (Conflict #1 avoidance, warning-attribution
avoidance, formula ID sourcing, the `tests/` folder deviation) documented
rather than silently decided.

---

### Batch 2 — Dashboard Summary Header (M5-004)

Second Milestone 5 batch, the next named step in 06_TASKS.md's own
"IMPLEMENTATION ORDER" ("Dashboard Foundation → **Summary Header** → KPI
Metrics → ..."). `features/dashboard/components/` gained its first real
file this batch.

**`DashboardViewModel` restructured (extends Batch 1's M5-003 output,
not a new task)**: while implementing M5-004's Display list, found that
"Current BTC price"/"Last updated time"/"Manual or provider data source"
are derived from `Portfolio` alone (`normalizeMarketQuote`/
`normalizeProtocolQuote`) and never depend on
`calculatePortfolioSummary` succeeding — but Batch 1's `DashboardViewModel`
only exposed `freshness` inside the `ok: true` branch, meaning a
calculation failure would have hidden it. Since M5-004's own DoD is "The
user can identify which portfolio and data source are currently active"
— with no exception carved out for a failed calculation — introduced
`DashboardViewModelBase` (`portfolioId`, `portfolioName`,
`portfolioDescription`, `freshness`) that both the `ok: true` and
`ok: false` branches now extend. `DashboardMetrics`/`warnings`/
`calculationTimestamp` remain `ok`-only, since those genuinely do not
exist without a successful calculation. All of Batch 1's own tests
(freshness/warnings/errors assertions) still pass unchanged — this is an
additive restructuring, not a behavior change to anything Batch 1 shipped.

**M5-004 — `features/dashboard/components/DashboardSummaryHeader.tsx`**:
covers the task's Display list (Active portfolio name, Description,
Current BTC price, Last updated time, Storage status, Manual/provider
data source) and Include list (Portfolio switcher, Refresh action, Edit
portfolio action) field-for-field:

- **"Portfolio switcher" — not rebuilt**: `AppHeader` (M4-010) already
  renders a portfolio switcher (`aria-label="Active portfolio"`) globally
  on every page, including the Dashboard. A second, duplicate switcher
  embedded in this section would control the identical state through a
  different control for no benefit — satisfied by the one that already
  exists, not a new component.
- **"Refresh action" — re-derives from currently-entered data, not a
  live market fetch**: `01_PRD.md` REQ-010 states "Version 0.1 uses
  Manual Mode," and no price-provider integration exists anywhere in this
  codebase (`services/market/quote.ts`'s own header comment describes a
  `PriceProvider`/CoinGecko adapter as future infrastructure, never
  built — confirmed by grepping for any `fetch`/provider call in
  `services/`/`utils/`, finding none). The only honest behavior
  "Refresh" can have in Manual Mode is re-running the calculation against
  the portfolio's current values, so the button calls `recomputeSummary`
  (M4-017's own, already real, already-shipped mechanism — the same one
  that task's own Retry button uses) rather than fabricating a live-data
  refresh this application does not have.
- **"Storage status"**: reuses the exact wording
  `app/portfolio/page.tsx`'s own `formatSaveStatus` uses (M4-013,
  Conflict B — an in-memory Store, not a durable save), duplicated
  locally in `features/dashboard/utils/format.ts` per this codebase's
  established per-page/per-feature formatting convention (not exported
  from the Portfolio page, which doesn't expose it either).
- **"Description or strategy label"**: `Portfolio.description` is
  optional — rendered only when set (`portfolioDescription !== null`),
  never a fabricated "No description" placeholder.

**Scope discipline**: `git diff --stat -- engine/ services/ stores/
types/` empty — zero Engine/Service/Store/type files touched. Only
`features/dashboard/` (component, restructured view model, extended
format helpers) and `app/page.tsx` (wiring `DashboardSummaryHeader` in)
changed.

**Validation — Batch 2**

| Command                      | Result                                                                                                                                                                                                                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`             | ✅ Pass                                                                                                                                                                                                                                                                         |
| `pnpm lint`                  | ✅ Pass                                                                                                                                                                                                                                                                         |
| `pnpm format:check`          | ✅ Pass (after Prettier formatting of the changed files)                                                                                                                                                                                                                        |
| `pnpm test` (Vitest)         | ✅ Pass, 926/926 (25 net new)                                                                                                                                                                                                                                                   |
| `pnpm test:coverage`         | ✅ 95.47% statements / 88.71% branches / 100% functions / 98.69% lines (project-wide) — improved over Batch 1's 95.12%/88.20%/100%/98.68%, since this batch also added direct unit tests for every `formatSaveStatus` case and every formatter's `Infinity`/`NaN` guard branch. |
| `pnpm test:e2e` (Playwright) | ✅ Pass, 12/12 (unchanged)                                                                                                                                                                                                                                                      |
| `pnpm build`                 | ✅ Pass — `/` grew from 1.97 kB to 2.39 kB (208 kB First Load JS, unchanged)                                                                                                                                                                                                    |

**Manual browser verification**: built a portfolio, navigated to `/` via
the sidebar's in-app `<Link>` (Conflict-B-safe navigation), confirmed the
Summary Header renders name/Refresh/Edit Portfolio/Storage: Saved/BTC
price+origin+updated-time against a production build, clicked Refresh
with no error, and confirmed the Edit Portfolio link's `href="/portfolio"`.

**Architecture audit**: `git diff --stat -- engine/ services/ stores/
types/` empty. `DashboardSummaryHeader` imports only from
`@/stores/portfolioStore` (for `saveStatus`/`recomputeSummary`, the same
Store every other page already reads) and this module's own
`../types/viewModel`/`../utils/format` — no new dependency direction.

**Traceability**: M5-004's Display list, Include list, and DoD are each
addressed by name above.

---

### Batch 3 — KPI Metrics (M5-005, M5-006)

Third Milestone 5 batch, the next named step in 06_TASKS.md's own
"IMPLEMENTATION ORDER" ("... → Summary Header → **KPI Metrics** → Risk
Sections → ..."). M5-006 depends directly on M5-005, so both shipped
together as one batch rather than split — the grid cannot exist without
the card it's built from.

**M5-005 — `features/dashboard/components/KpiCard.tsx`**: a purely
presentational, reusable card. Covers every "Support" item literally:

- **Title / Primary value**: plain string props, rendered as-is.
- **Secondary value**: optional string prop; renders only when supplied.
- **Status**: three-value (`'ok' | 'warning' | 'unavailable'`) — wider
  than `DashboardMetric.status` (M5-003, `'ok' | 'unavailable'` only,
  Conflict #1 avoidance). This is a deliberate, honest choice: the card
  itself is generic infrastructure this task asks to support all three
  states; the one caller that exists today (`DashboardKpiGrid`) simply
  never passes `'warning'`, since no Health-Factor-derived warning rule
  can be built without inventing risk-band thresholds. Rendered as a
  visible text label ("Warning"/"Unavailable"), not color alone.
- **Tooltip**: the native `title` attribute — a minimal, always-
  accessible baseline; M5-024 ("Complete Dashboard Accessibility Pass")
  is this project's own dedicated task for a fuller treatment, not
  assumed here.
- **Trend or comparison text**: optional string prop. No historical/
  baseline data source exists anywhere in this application (Conflict B —
  no persistence, no time-series storage before Milestone 8), so no
  caller can honestly populate this yet; the prop exists because this
  task's own list names it as something the card must support, not
  because anything drives it today.
- **Loading state**: real boolean prop — replaces the primary value with
  a skeleton placeholder and sets `aria-busy`.
- **Warning state**: the same `status="warning"` value above.
- **Developer Mode details**: optional `ReactNode` slot, rendered only if
  a caller supplies content. "Developer Mode" itself has no toggle or
  infrastructure anywhere in this codebase yet — M5-022 ("Implement
  Dashboard Developer Mode") is the dedicated, later, still-unbuilt task
  for that (matching the identical, already-documented gap noted in
  `app/portfolio/page.tsx`'s own "Diagnostic Information (Developer
  Mode)" comment from Milestone 4). Gating on an "is Developer Mode
  enabled" flag is left to that future caller — there is no flag to
  check yet.

**M5-006 — `features/dashboard/components/DashboardKpiGrid.tsx`**:
renders exactly this task's own 8-item "Cards" list (Net portfolio
value, Total collateral, Total debt, Current Health Factor, Current LTV,
Effective leverage, Annual interest cost, Liquidation price), in that
order, one `KpiCard` each — **not** the 10 metrics `DashboardMetrics`
(M5-003) carries. `liquidationDistance`/`liquidationBuffer` remain in the
view model (not deleted) but are left out of this grid, since M5-009
("Implement Liquidation Risk Panel") explicitly names "Distance to
Liquidation"/"Buffer" as that later, separate, still-unbuilt section's
own content — rendering them here too would duplicate a task this
codebase hasn't reached yet, not satisfy M5-006's own literal list.

- **"Use Service outputs only"**: every `primaryValue` is a
  `DashboardMetric.formattedValue`, itself only ever derived from
  `PortfolioSummary` — nothing computed in this file.
- **"Use consistent formatting"**: reuses the exact same
  `formattedValue` strings the Summary Header and every other Dashboard
  surface already read from the same view model.
- **"Display unavailable values clearly"**: `DashboardMetric.status`
  maps directly to `KpiCard`'s own `status` prop, producing a visible
  "Unavailable" label plus the metric's own `formattedValue` (e.g. "N/A
  (no debt)") — not a blank or silently-dashed value.
- **Tooltip content**: each card's own already-documented Formula ID
  (`"F-022 — see docs/02_Formulas.md"`, etc.) — not invented, the same
  static mapping `DashboardMetric.formulaId` (M5-003) already carries.

Replaces Batch 1's plain `<dl>` metrics list in `app/page.tsx` — that
list's own doc comment always described it as "not a preview of the
eventual KPI grid's visual design," so this batch supersedes it rather
than running both in parallel.

**Test fix required by this batch's own change**: Batch 1/2's zero-debt
Dashboard test asserted three `"N/A (no debt)"` occurrences (liquidation
price/distance/buffer all rendered in the old plain list). Since this
grid renders only Liquidation Price, updated the assertion to expect
exactly one occurrence, plus a visible "Unavailable" label — a test
correction required by this batch's own documented scope change, not a
regression.

**Scope discipline**: `git diff --stat -- engine/ services/ stores/
types/` empty — zero Engine/Service/Store/type files touched. Only
`features/dashboard/` (two new components) and `app/page.tsx` (wiring
`DashboardKpiGrid` in, replacing the old list) changed.

**Validation — Batch 3**

| Command                      | Result                                                                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm typecheck`             | ✅ Pass                                                                                                                                    |
| `pnpm lint`                  | ✅ Pass                                                                                                                                    |
| `pnpm format:check`          | ✅ Pass (after Prettier formatting)                                                                                                        |
| `pnpm test` (Vitest)         | ✅ Pass, 942/942 (16 net new)                                                                                                              |
| `pnpm test:coverage`         | ✅ 95.50% statements / 88.97% branches / 100% functions / 98.70% lines (project-wide) — improved over Batch 2's 95.47%/88.71%/100%/98.69%. |
| `pnpm test:e2e` (Playwright) | ✅ Pass, 12/12 (unchanged)                                                                                                                 |
| `pnpm build`                 | ✅ Pass — `/` grew from 2.39 kB to 2.74 kB (208 kB First Load JS, unchanged)                                                               |

**Manual browser verification**: built a portfolio, navigated to `/` via
the sidebar's in-app `<Link>`, confirmed all 8 KPI cards render with
correct values and labels against a production build, and confirmed the
Health Factor card's tooltip reads `"F-022 — see docs/02_Formulas.md"`.

**Architecture audit**: `git diff --stat -- engine/ services/ stores/
types/` empty. `KpiCard` has zero data-source imports (props only,
matching Requirements: "No financial calculations"). `DashboardKpiGrid`
imports only from `../types/viewModel` and `./KpiCard` — no new
dependency direction.

**Traceability**: M5-005's Support list, Requirements, and DoD, and
M5-006's Cards list, Requirements, and DoD are each addressed by name
above.

---

### Batch 4 — Risk Sections, part 1 (M5-007, M5-009)

Fourth Milestone 5 batch, the "Risk Sections" step in 06_TASKS.md's own
"IMPLEMENTATION ORDER." Scoped to **two of the four** Risk Sections
tasks: M5-007 (Health Factor Status Component) and M5-009 (Liquidation
Risk Panel). M5-008 (Health Factor Range Visualization) and M5-010 (Risk
Warning Banner) — the remaining two — are deliberately deferred, not
attempted partially:

- **M5-008** is wholly about rendering Critical/Caution/Target zone
  boundaries — exactly Conflict #1's own blocked content, with no
  buildable subset the way M5-007 had (Current HF/target/distance were
  real; only "Risk classification" was blocked there).
- **M5-010**'s "Warning cases" list mixes genuinely buildable items
  (missing/stale price data, calculation warnings — both already real
  view-model fields) with items needing their own new threshold research
  ("Health Factor near liquidation" — is `LIQUIDATION_PROXIMITY`, the
  existing Loop Strategy Safety check, reusable here, or is it scoped
  specifically to loop strategies? "High interest burden" — no
  acceptable-cost threshold exists anywhere on `Portfolio`). Given this
  batch already required real, unplanned research to resolve M5-007/
  M5-009 honestly (see conflict #29), M5-010 was left for its own,
  focused, later batch rather than rushed alongside two already-large
  tasks.

**New Service — `services/recommendation/targetHealthFactorActions.ts`
(`calculateTargetHealthFactorActions`)**: both M5-007's "Required action
to restore target" and M5-009's "Debt repayment required"/"Collateral
addition required for target safety" turned out to need a real
recommendation-style calculation, not just a reshaped existing metric.
`generateRecommendationSet` (M3-012) — the obvious existing Service —
needs a full `RecommendationRuleConfig` with 5 fields no `Portfolio`
field carries and no specification page defaults (conflict #29, newly
raised this batch). Rather than invent those five values, this new
Service composes only the two already-public Engine functions that need
solely `{ portfolio, targetHealthFactor }` —
`calculateRepaymentRecommendation` (F-062) and
`calculateAdditionalCollateralRecommendation` (F-063) — using the
portfolio's own real `settings.safetyTargets.targetHealthFactor`
(M4-001). **This is the first Milestone 5 batch to touch `services/`** —
every prior Dashboard batch was UI/feature-layer only; this one adds a
genuinely new Service capability because the UI layer legitimately needed
one that didn't exist, not because a UI batch overstepped into Service
work casually. See conflict #29's own full write-up for the reasoning.

**M5-007 — `features/dashboard/components/HealthFactorStatusSection.tsx`**
(+ `types/healthFactorStatus.ts`, `utils/buildHealthFactorStatus.ts`):

- Current Health Factor, Configured target
  (`Portfolio.settings.safetyTargets.targetHealthFactor`, shown only
  when set), and Distance from target (`current − target`, a plain
  subtraction directly analogous to F-023's own already-approved
  `healthFactor − 1.0` pattern, not itself a numbered Formula ID) — all
  real, all built.
- Plain-language explanation: directional only ("above"/"at"/"below your
  configured target"), matching M4-009's own already-approved
  directional-only precedent — never a risk-band label.
- Required action to restore target: both `calculateTargetHealthFactorActions`
  results' verbatim `suggestedAction` text (repayment and additional
  collateral, as two alternative paths back to target), rendered only
  when a target is configured.
- **Risk classification — not built.** Conflict #1 (unchanged, reinforced
  here, not re-litigated).
- Formula reference in Developer Mode: a `title` tooltip
  (`"F-022 — see docs/02_Formulas.md"`) on the Current Health Factor
  value — the same minimal baseline `DashboardKpiGrid` (M5-006) already
  established; no Developer Mode toggle exists anywhere in this codebase
  yet (M5-022's own, later, still-unbuilt task).

**M5-009 — `features/dashboard/components/LiquidationRiskPanel.tsx`**
(+ `types/liquidationRiskPanel.ts`, `utils/buildLiquidationRiskPanel.ts`):

- Estimated liquidation price, Liquidation distance, Percentage decline
  to liquidation: reused directly from `DashboardMetrics`
  (`liquidationPrice`/`liquidationDistance`/`liquidationBuffer`, M5-003)
  — the exact fields `DashboardKpiGrid`'s own Batch 3 comment already
  named as belonging to "M5-009's own, later, dedicated panel" rather
  than the 8-card grid. Not recomputed a second time.
- Current market price: reused from `DashboardFreshness.market`
  (M5-003/M5-004).
- Debt repayment required / Collateral addition required for target
  safety: the same `calculateTargetHealthFactorActions` results
  `HealthFactorStatusSection` uses, formatted as currency — `null` under
  the identical condition (no configured target).
- Assumptions: a static, honest disclosure describing this app's real
  behavior ("estimates recalculate automatically whenever the underlying
  portfolio data changes" — true per M4-013's own auto-recompute
  guarantee), not a computed value.
- **DoD ("clearly distinguishes current values from calculated
  estimates") satisfied structurally**: the component renders two
  visually and semantically separate groups — "Current" (market price
  alone) and "Calculated Estimates" (everything derived) — not just
  wording that claims the distinction.

**Test fix required by this batch's own change**: the zero-debt Dashboard
route test's `"N/A (no debt)"` count went from 1 (Batch 3, KPI grid only)
to 4 (1 from the grid's own Liquidation Price card + 3 from this batch's
new panel's price/distance/decline cards) — updated with a comment
explaining why, not silently changed.

**Scope discipline**: `git diff --stat -- engine/ stores/ types/` empty —
zero Engine/Store/type files touched. `services/` changed only by the one
new file plus its barrel export (`services/recommendation/index.ts`) —
`services/portfolio/`, `services/market/`, `services/protocol/`, and
every other existing Service file are untouched.

**Validation — Batch 4**

| Command                      | Result                                                                                                                                       |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`             | ✅ Pass                                                                                                                                      |
| `pnpm lint`                  | ✅ Pass (after `eslint --fix` for import ordering)                                                                                           |
| `pnpm format:check`          | ✅ Pass (after Prettier formatting)                                                                                                          |
| `pnpm test` (Vitest)         | ✅ Pass, 964/964 (22 net new)                                                                                                                |
| `pnpm test:coverage`         | ✅ 95.50% statements / 88.98% branches / 100% functions / 98.73% lines (project-wide) — consistent with Batch 3's 95.50%/88.97%/100%/98.70%. |
| `pnpm test:e2e` (Playwright) | ✅ Pass, 12/12 (unchanged)                                                                                                                   |
| `pnpm build`                 | ✅ Pass — `/` grew from 2.74 kB to 3.83 kB (212 kB First Load JS)                                                                            |

**Manual browser verification**: built a portfolio, set Target Health
Factor to 5 via the existing Portfolio Details form (M4-006), navigated
to `/` via the sidebar's in-app `<Link>`, and confirmed against a
production build that both new sections render consistent, correct
numbers — Health Factor Status showed "Repay 4000... / Add 25000 in
collateral...", and Liquidation Risk Panel independently showed "Debt
repayment required for target safety: $4,000.00" / "Collateral addition
required for target safety: $25,000.00" — the same two underlying
`calculateTargetHealthFactorActions` values, rendered consistently in
both places.

**Architecture audit**: `git diff --stat -- engine/ stores/ types/`
empty. The new Service (`services/recommendation/targetHealthFactorActions.ts`)
imports only from `@/engine` and this Service layer's own shared
modules — no React/Next import, no `fetch`/`process.env`, matching every
other Service file's own audited constraint. `features/dashboard/utils/
buildHealthFactorStatus.ts`/`buildLiquidationRiskPanel.ts` import only
from `@/services` and `@/types/portfolio` — the same allowed UI → Services
direction every other Dashboard builder already uses.

**Traceability**: M5-007's Display list, Include list, and DoD, and
M5-009's Display list, Requirements, and DoD are each addressed by name
above, with the two deliberately-deferred items (Risk classification,
M5-008, M5-010) and the one new conflict (#29) documented rather than
silently skipped.

---

### Batch 5 — Risk Sections, part 2 + Portfolio Composition (M5-010, M5-011, M5-012)

Fifth Milestone 5 batch. Per instruction, began by re-reading M5-008 and
M5-010 fresh and re-verifying whether Conflict #1 (or anything else)
still blocks them, rather than assuming Batch 4's conclusion still held:

- **M5-008 (Health Factor Range Visualization) — confirmed still wholly
  blocked, not attempted.** Every one of its "Show" items (Critical
  zone, Caution zone, Target zone, "Current position" plotted against
  them) requires the same zone boundaries Conflict #1's own four
  disagreeing sources never converge on. Unlike M5-007/M5-010, there is
  no partial subset — the entire task is the blocked content itself.
  Still not built.
- **M5-010 (Risk Warning Banner) — re-investigated each of the 6
  "Warning cases" individually, not assumed from Batch 4's summary**:
  - **"Health Factor near liquidation" — confirmed still blocked**, and
    for a more specific reason than Conflict #1 alone: searched for any
    documented "near liquidation" proximity threshold distinct from the
    risk-band boundaries Conflict #1 already catalogs (checked
    `01_PRD.md`'s "Near Liquidation" reference — a named test-dataset
    category with no numeric definition; `03_UI.md`'s C-008 "Health
    Factor Gauge" — names a "Warning Zone" with no numbers). The only
    codebase usage of proximity-to-liquidation logic,
    `LIQUIDATION_PROXIMITY` (`engine/loop/validateLoopStrategySafety.ts`),
    turned out to check `healthFactor <= 1.0` — the liquidation boundary
    itself, not a "near it" buffer — and is scoped to Loop Strategy
    inputs, not reusable generically. No threshold invented.
  - **"Invalid protocol parameters" — confirmed structurally
    unreachable**, not blocked: `types/portfolio.schema.ts`'s
    `.refine()` cross-field check runs on every `create` and `update`
    (`stores/portfolioStore.ts` re-validates the fully merged portfolio
    on every mutation), so a stored `Portfolio` can never carry invalid
    protocol parameters. Nothing to warn about, ever — not built.
  - **"High interest burden" — confirmed still blocked**, the same class
    of gap as conflict #29: no "acceptable" interest-cost threshold
    exists on `Portfolio`/`PortfolioSettings`, and the only place this
    concept is documented (`RecommendationRuleConfig.loop.
maxAcceptableAnnualInterestCost`) has no default value anywhere.
  - **The other 3 — "Health Factor below configured target," "Missing or
    stale price data," "Calculation warnings" — confirmed buildable**,
    each from already-real fields (`HealthFactorStatus.distanceFromTarget`,
    `DashboardFreshness.market.freshness`, `DashboardViewModelOk.warnings`).
    Built this batch.

Having confirmed M5-008 has no buildable subset and M5-010 only a
partial one, selected the **next largest cohesive, unblocked batch**:
M5-010 (the 3-item subset) plus the entire next Implementation Order
step, "Portfolio Composition" (M5-011, M5-012) — both cleanly buildable
with no new blockers found during review.

**M5-010 — `features/dashboard/components/RiskWarningBanner.tsx`**
(+ `types/riskWarnings.ts`, `utils/buildRiskWarnings.ts`): renders 0..N
active warnings, each with a `reason` and `recommendedAction` (M5-010's
own DoD, literally). Renders nothing when no warning is active — an
empty banner would itself violate "must not block valid analysis
unnecessarily" by occupying space with no information. **Replaces the
old raw `viewModel.warnings` list** previously rendered inline in
`app/page.tsx` — `buildRiskWarnings`'s "Calculation warnings" case
already folds those same `ServiceWarning`s in, so keeping both would
duplicate them.

**M5-011 — `features/dashboard/components/PortfolioCompositionSection.tsx`**
(+ `types/portfolioComposition.ts`, `utils/buildPortfolioComposition.ts`):
covers the Include list field-for-field (Collateral/Debt positions,
Asset quantity, Current price, Position value, Portfolio percentage,
Protocol parameters) and the "Use" list (a `<table>` for `sm:` and up, a
stacked compact-card list below `sm:`, both rendering the identical two
rows via Tailwind's `hidden`/`sm:hidden` utilities, not two separate
formatting paths).

- **"Portfolio percentage" is always 100% for each row** — not computed,
  a structural consequence of Conflict A (single collateral position +
  single debt position): with exactly one asset per side, each
  necessarily makes up 100% of its own side. Documented as such, not
  presented as a real statistic that happens to always equal 100%.
- **Debt row's "Current price"**: `"N/A (stablecoin, 1:1 — F-003)"` —
  `calculateDebtValue`'s own equation (F-003: "Debt Value = Borrowed
  Stablecoins") has no price-lookup step at all; stating a fabricated
  "$1.00 (assumed)" would invent a computation the Engine itself never
  performs.

**M5-012 — no new component; satisfied by documented reasoning.** That
task's own Requirement — "Hide the chart when it provides no additional
value" — is unconditionally true under Conflict A: a chart visualizing
"100% BTC" / "100% USDC" allocation adds nothing beyond the table M5-011
already renders. `PortfolioComposition.showAllocationChart` is `false`
(not a computed condition — there is no multi-asset data in this data
model to check a count against). Building a chart component whose own
documented rule means it can never render anything in Version 0.1 would
be dead code with no way to exercise it meaningfully; none was written.
If Conflict A is ever revisited for multi-asset support, this field is
the concrete place a real condition and real per-asset percentages would
go.

**Scope discipline**: `git diff --stat -- engine/ services/ stores/
types/` empty — zero Engine/Service/Store/type files touched, unlike
Batch 4. This batch reuses Batch 4's `calculateTargetHealthFactorActions`
indirectly (via `HealthFactorStatus`, already computed) and needed no new
Service capability of its own.

**Test fix required by the Risk Warning Banner's own addition**: the
below-target-warning route test initially matched two elements
(`RiskWarningBanner`'s reason text and `HealthFactorStatusSection`'s own,
separately-worded explanation both contain "is below your configured
target") — scoped the assertion to `within(screen.getByRole('alert'))`
rather than loosening the match, since both texts are intentionally
similar but serve different sections.

**Validation — Batch 5**

| Command                      | Result                                                                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm typecheck`             | ✅ Pass                                                                                                                                    |
| `pnpm lint`                  | ✅ Pass (after `eslint --fix` for import ordering)                                                                                         |
| `pnpm format:check`          | ✅ Pass (after Prettier formatting)                                                                                                        |
| `pnpm test` (Vitest)         | ✅ Pass, 985/985 (21 net new)                                                                                                              |
| `pnpm test:coverage`         | ✅ 95.51% statements / 89.14% branches / 100% functions / 98.76% lines (project-wide) — improved over Batch 4's 95.50%/88.98%/100%/98.73%. |
| `pnpm test:e2e` (Playwright) | ✅ Pass, 12/12 (unchanged)                                                                                                                 |
| `pnpm build`                 | ✅ Pass — `/` grew from 3.83 kB to 4.89 kB (214 kB First Load JS)                                                                          |

**Manual browser verification**: built a portfolio, set Target Health
Factor to 5 (above the portfolio's actual Health Factor of 4), navigated
to `/` via the sidebar's in-app `<Link>`, and confirmed against a
production build that the Risk Warning Banner shows "Health Factor (4)
is below your configured target (5)." with its recommended action, and
that Portfolio Composition renders both positions (BTC/USDC, correct
quantities, values, 100% each) plus all four protocol parameters —
consistent with the same numbers already shown in Batches 3–4's
sections.

**Architecture audit**: `git diff --stat -- engine/ services/ stores/
types/` empty. `buildRiskWarnings`/`buildPortfolioComposition` import
only from `@/services`/`@/types/portfolio` and this feature module's own
types — the same allowed UI → Services direction every other Dashboard
builder already uses. No new dependency direction introduced.

**Traceability**: M5-010's Warning cases, Requirements, and DoD (3 of 6
cases built, 3 documented as blocked/unreachable), M5-011's Include
list, Use list, and DoD, and M5-012's Requirements and DoD are each
addressed by name above.

---

### Batch 6 — Recommendations, part 1 (M5-013, M5-014)

Sixth Milestone 5 batch, the "Recommendations" step in 06_TASKS.md's own
"IMPLEMENTATION ORDER." Selected M5-013 (Debt and Interest Panel) and
M5-014 (Leverage Summary Section) — both depend only on M5-003, both
cleanly buildable with one already-known blocked sub-item each, unlike
M5-015 (Recommendation Summary), which depends on M3-012
(`generateRecommendationSet`) — the same Service conflict #29 (Batch 4)
already found needs 5 undocumented threshold fields. Left for its own,
separately-scoped batch rather than bundled in.

**New Service — `services/portfolio/interestBreakdown.ts`
(`calculateDebtInterestBreakdown`)**: M5-013 needs Monthly and Daily
interest cost, not just the Annual figure `calculatePortfolioSummary`
already provides. Discovered while implementing that these are **not**
simple divisions of the annual amount — `02_Formulas.md`'s own equations
are `Daily = Debt × APR / 365` and `Monthly = Daily × 30`, which do not
equal `Annual / 365` / `Annual / 12` (30/365 ≈ 0.0822, not 1/12 ≈
0.0833; confirmed numerically in this batch's own tests). Rather than
approximate, added a new Service composing the real, already-public
Engine functions `calculateDailyInterest` (F-030) and
`calculateMonthlyInterest` (F-031) — both exported from `@/engine`'s
M2-031 curated barrel since Milestone 2, never previously called by any
Service. The second batch (after Batch 4) to add new `services/` code
rather than stay UI-layer-only, for the same reason: the UI genuinely
needed a capability that didn't exist yet.

**M5-013 — `features/dashboard/components/DebtAndInterestPanel.tsx`**
(+ `types/debtAndInterestPanel.ts`, `utils/buildDebtAndInterestPanel.ts`):
covers Total debt, Current borrow rate, Annual/Monthly/Daily interest
cost, and Rate source. **"Projected debt where available" — not built**,
not a new conflict: Conflict #7 (compound interest, M2-013/M2-014 have
no documented formula) already blocks any real debt projection over
time. The Requirement ("clearly distinguish current rate from projected
assumptions") is satisfied structurally — with no projected figure
anywhere in this component, there is nothing to conflate the current
rate with.

**M5-014 — `features/dashboard/components/LeverageSummarySection.tsx`**
(+ `types/leverageSummary.ts`, `utils/buildLeverageSummary.ts`): covers
Gross exposure, Net equity, Leverage ratio, Effective BTC exposure, and
a plain-language explanation.

- **"Debt-to-equity ratio" — not built, and not a new gap.** M2-008
  ("Implement Leverage Calculations"), the Engine-layer task this
  section's own Include list mirrors almost exactly, already skipped
  this exact sub-item in Milestone 2 for the documented reason "no
  Formula ID in `02_Formulas.md`, would mean inventing a formula." That
  already-approved decision is carried forward unchanged, not
  re-litigated at the Dashboard layer.
- **"Gross exposure" and "Effective BTC exposure" render the identical
  value** (`PortfolioSummary.collateralValue`) — not a display bug.
  `engine/portfolio/calculateExposure.ts` (F-010) documents itself as
  numerically identical to Collateral Value (F-002) under Version 1's
  single-collateral-asset scope, and its own comment states it "also
  serves 06_TASKS.md M2-008's 'Effective BTC exposure' ... no separate
  calculation exists for it" — reusing that already-approved Milestone 2
  interpretation, not reinterpreting the term now.
- **Leverage is always finite at this point** — `calculatePortfolioSummary`
  itself fails (`DIVISION_BY_ZERO`) if net worth is zero, the only way
  leverage could be non-finite, so a `PortfolioSummary` this builder
  receives always carries a real value; at zero debt, leverage is
  exactly `1`, not `Infinity` (net worth equals exposure). Verified, not
  assumed — a dead "not finite" branch was written first, then removed
  once this was confirmed, rather than left in as unreachable
  defense-in-depth for a case that provably cannot occur.

**Scope discipline**: `git diff --stat -- engine/ stores/ types/` empty
— zero Engine/Store/type files touched. `services/` changed only by the
one new file plus its barrel export (`services/portfolio/index.ts`) —
every other existing Service file is untouched.

**Validation — Batch 6**

| Command                      | Result                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`             | ✅ Pass (after renaming the `types/debtAndInterestPanel.ts` interface to `DebtAndInterestPanelData`, resolving a name collision with the same-named component)                                                                                                                                                                                                                |
| `pnpm lint`                  | ✅ Pass (after `eslint --fix` for import/export ordering)                                                                                                                                                                                                                                                                                                                     |
| `pnpm format:check`          | ✅ Pass (after Prettier formatting)                                                                                                                                                                                                                                                                                                                                           |
| `pnpm test` (Vitest)         | ✅ Pass, 1003/1003 (18 net new)                                                                                                                                                                                                                                                                                                                                               |
| `pnpm test:coverage`         | ✅ 95.42% statements / 88.84% branches / 100% functions / 98.78% lines (project-wide) — branch coverage dipped slightly from Batch 5's 89.14%, entirely from the new Service's own failure-path branches (practically unreachable given an already-successful summary), the same class of gap already accepted elsewhere (e.g. `services/shared/formulaStep.ts`'s own 87.5%). |
| `pnpm test:e2e` (Playwright) | ✅ Pass, 12/12 (unchanged)                                                                                                                                                                                                                                                                                                                                                    |
| `pnpm build`                 | ✅ Pass — `/` grew from 4.89 kB to 5.35 kB (215 kB First Load JS)                                                                                                                                                                                                                                                                                                             |

**Manual browser verification**: built a portfolio, navigated to `/` via
the sidebar's in-app `<Link>`, and confirmed against a production build
that Debt and Interest Panel shows Monthly $82.19 / Daily $2.74 (not the
naive Annual/12 = $83.33 approximation), Rate source "manual", and
Leverage Summary shows Gross Exposure and Effective BTC Exposure both as
$100,000.00 with a 1.25x leverage ratio and matching plain-language
explanation.

**Architecture audit**: `git diff --stat -- engine/ stores/ types/`
empty. The new Service (`services/portfolio/interestBreakdown.ts`)
imports only from `@/engine` and this Service layer's own shared
modules — no React/Next import, no `fetch`/`process.env`, matching every
other Service file's own audited constraint.
`buildDebtAndInterestPanel.ts`/`buildLeverageSummary.ts` import only
from `@/services` and `@/types/portfolio` — the same allowed UI →
Services direction every other Dashboard builder already uses.

**Traceability**: M5-013's Display list, Requirements, and DoD, and
M5-014's Include list and DoD are each addressed by name above, with
both deliberately-unbuilt items ("Projected debt," "Debt-to-equity
ratio") documented as carrying forward already-established decisions,
not new gaps.

---

### Batch 7 — Recommendations, part 2 (M5-015)

Seventh Milestone 5 batch, completing the "Recommendations"
Implementation Order step Batch 6 began. Scoped to M5-015 alone — its
own scoping review (flagged as overdue in Batch 6's "Next task" note)
turned out to require enough genuine investigation (a Service-reuse
decision, a documented doc-terminology mismatch, a filtering rule for
non-actionable recommendations) to fill one focused batch on its own,
rather than being bundled with an unrelated task.

**Resolved the M5-015/conflict #29 scoping question**: `generateRecommendationSet`
(M3-012) needs a complete `RecommendationRuleConfig` (7 fields across
`borrow`/`repayment`/`additionalCollateral`/`loop`), 5 of which have no
source on `Portfolio` and no documented default (conflict #29, Batch 4).
Considered the three options conflict #29's own "Action needed" note
named: (a) scope to only repayment/additionalCollateral, reusing Batch
4's `calculateTargetHealthFactorActions`; (b) collect the missing fields
as new portfolio settings; (c) define documented defaults. **(c)** was
rejected outright (would mean inventing thresholds). **(b)** was
rejected as disproportionate for this task — it would mean reopening and
extending Milestone 4's already-shipped, already-approved
`PortfolioSettings`/`portfolioInputSchema`/`PortfolioDetailsForm` to add
4 new user-facing fields, a materially larger, more invasive change than
a Dashboard summary section warrants on its own, and a product-level
decision this batch does not have standing to make unilaterally. **(a)**
was chosen — the same scoping decision `HealthFactorStatusSection`
(M5-007) and `LiquidationRiskPanel` (M5-009) already made for this exact
gap, applied consistently here rather than re-decided from scratch.

**M5-015 — `features/dashboard/components/RecommendationSummarySection.tsx`**
(+ `types/recommendationSummary.ts`, `utils/buildRecommendationSummary.ts`):
reuses `calculateTargetHealthFactorActions`'s two `Recommendation`
objects (repayment, additional collateral) — already carrying every
field M5-015's own Display list names (category, decisionPriority
("Risk level"), triggeringCondition ("Explanation"), suggestedAction,
expectedEffect, per M2-026's own six-field contract) — and adds only a
1-based `priority` rank, reusing the same `DECISION_PRIORITY_ORDER` tier
list `generateRecommendationSet` (M3-012) already defines from
`02_Formulas.md`'s own "DECISION PRIORITY" chapter.

- **Non-actionable recommendations are filtered out**, not padded into
  the list: when a configured target is already met, both underlying
  Engine calls report "No repayment needed." / "No additional collateral
  needed." (`relevantValues.requiredRepayment === 0` /
  `requiredUsd === 0`, the Engine's own already-existing conditions, not
  a new threshold) — excluded rather than shown as inert entries.
  `items` is legitimately empty both when no target is configured and
  when the target is already met.
- **"View all action" — not built.** At most 2 recommendations exist,
  ever, in this scoped-down universe, and both are always shown — there
  is no larger set for a "view all" control to reveal. The same
  "don't build a dead affordance" reasoning M5-012's chart already used.
- **"Dismiss or acknowledge behavior only if documented" — not built.**
  Neither term appears anywhere in `01_PRD.md`, `03_UI.md`, or
  `04_BUILD_GUIDE.md` — read literally as "not documented, don't build."
- **Documented, not resolved: 03_UI.md's own "PRIMARY RECOMMENDATION"
  mockup (Section 5) states "Only one recommendation is displayed,"**
  while M5-015's own Display list names "Top recommendations" (plural)
  with a "Priority" ranking field — a genuine terminology mismatch
  between the two documents. Per this engagement's established practice
  (06_TASKS.md is the authoritative task backlog), M5-015's own plural
  framing was followed; the practical difference is softened by this
  section's own recommendation universe being capped at 2 items anyway.

**`Recommendation` type re-exported from `services/recommendation/index.ts`**
(already public from `@/engine` since M2-031) so this batch's builder
never needs to import `@/engine` directly — keeping the UI layer inside
its documented "UI → Services" boundary, the same reason every other
Service re-exports the Engine types its own return values carry.

**Scope discipline**: `git diff --stat -- engine/ stores/ types/` empty
— zero Engine/Store/type files touched. `services/` changed only by one
barrel-export line (`services/recommendation/index.ts`) — no new Service
logic was needed, since Batch 4's `calculateTargetHealthFactorActions`
already provided everything this batch required.

**Validation — Batch 7**

| Command                      | Result                                                                                                                                       |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`             | ✅ Pass                                                                                                                                      |
| `pnpm lint`                  | ✅ Pass                                                                                                                                      |
| `pnpm format:check`          | ✅ Pass                                                                                                                                      |
| `pnpm test` (Vitest)         | ✅ Pass, 1010/1010 (7 net new)                                                                                                               |
| `pnpm test:coverage`         | ✅ 95.41% statements / 88.87% branches / 100% functions / 98.79% lines (project-wide) — consistent with Batch 6's 95.42%/88.84%/100%/98.78%. |
| `pnpm test:e2e` (Playwright) | ✅ Pass, 12/12 (unchanged)                                                                                                                   |
| `pnpm build`                 | ✅ Pass — `/` grew from 5.35 kB to 5.66 kB (215 kB First Load JS)                                                                            |

**Manual browser verification**: built a portfolio with no target
configured — confirmed no "Recommendations" heading renders on a
production build. Set Target Health Factor to 5 via the Portfolio
Details form, confirmed both recommendations render with matching
figures already shown elsewhere ("Repay 4000...", "Add 25000 in
collateral...", identical to Batch 5/6's own verified numbers for the
same scenario).

**Architecture audit**: `git diff --stat -- engine/ stores/ types/`
empty. `buildRecommendationSummary.ts` imports only from `@/services`
and `@/types/portfolio` — the same allowed UI → Services direction every
other Dashboard builder already uses; no direct `@/engine` import
anywhere in `features/dashboard/`.

**Traceability**: M5-015's Display list, Include list, and DoD are each
addressed by name above, with every deliberately-unbuilt item
("View all," dismiss/acknowledge, the borrow/loop categories) and the
one documented terminology mismatch (03_UI.md vs. 06_TASKS.md) explained
rather than silently dropped.

---

### Batch 8 — Data Freshness (M5-017, resolving M5-018)

Eighth Milestone 5 batch. `06_TASKS.md`'s coarse "IMPLEMENTATION ORDER"
bucket list (Dashboard Foundation → Summary Header → KPI Metrics → Risk
Sections → Portfolio Composition → Recommendations → Responsive and
Accessible States → Testing) does not name M5-016 through M5-022
individually, but the task-level dependency graph places them here:
M5-023 (Responsive Layout) depends on "M5-006 through M5-021," so all of
M5-016–M5-021 must complete first. Of that group, M5-017 (Data Freshness
Indicators, P0, deps M3-007/M3-008/M5-004 — all already shipped) and its
dependent M5-018 (Refresh Workflow, deps M5-017) form the only pair
linked by a real production dependency rather than mere topical
adjacency — the same "dependency, not just adjacency" standard Batch
6 applied to M5-013/M5-014. M5-016 (Quick Actions) is independent and
left for a later batch rather than bundled in for size alone.

**M5-017 — `features/dashboard/components/DataFreshnessSection.tsx`**
(+ `types/dataFreshnessIndicators.ts`, `utils/buildDataFreshnessIndicators.ts`):
a new, dedicated freshness section rendered above the ok/error branch in
`app/page.tsx` (alongside `DashboardSummaryHeader`), since freshness data
is derived from `Portfolio` alone and stays available even when
`calculatePortfolioSummary` fails — arguably most useful exactly then.
Every field is read directly off `DashboardFreshness` (M5-003/M5-004,
itself `normalizeMarketQuote`/`normalizeProtocolQuote`-derived, M3-007/M3-008)
— no new Engine or Service call was needed, and none was added.

- **"Source" / "Last updated time"**: `origin` and `formattedUpdatedAt`,
  already present on `DashboardMarketFreshness`/`DashboardProtocolFreshness`
  since Batch 2 — reshaped for display, not recomputed.
- **"Fresh or stale classification" is market-only, by design.**
  `services/protocol/quote.ts`'s own header comment (M3-008) already
  establishes why: `04_BUILD_GUIDE.md` defines a concrete 5-minute
  Fresh/Stale/Unavailable rule for prices specifically, with no
  equivalent "PROTOCOL FRESHNESS" rule anywhere in the documentation.
  Carrying that already-established finding forward here, not
  re-litigating it as a new conflict — the protocol row renders no
  freshness badge, and the component/type files say why.
- **"Manual-data status"** — `isManual: boolean`, rendered as its own
  "(manual entry)" callout distinct from the "source" label, since
  M5-017's own Show list names it as a separate item.
- **"Refresh status"** resolves to a fixed explanatory string
  (`refreshNote`), not a transient loading state. `01_PRD.md` REQ-010
  ("Version 0.1 uses Manual Mode") and `services/market/quote.ts`'s own
  header comment (no `PriceProvider` adapter exists anywhere in this
  codebase) already establish there is no live request/response cycle to
  report a status for; `recomputeSummary` (the mechanism behind the
  existing "Refresh" button, M4-017/M5-004) is a synchronous, in-memory
  recalculation with no observable transient state — the same
  "instant transition, not fabricated latency" reasoning `app/page.tsx`'s
  own `loadStatus` comment already applies to `'loading'`.

**Resolves M5-018 (Refresh Workflow) with no new code.** M5-018's own
Workflow list splits cleanly: "Request new market data" / "Request
updated protocol parameters" / "Validate responses" all require a live
data provider, which does not exist in this Manual-Mode version — the
same structural gap `refreshNote` above documents, not a new numbered
conflict (it is the identical REQ-010/`PriceProvider` gap M5-004's own
Batch 2 write-up already resolved for the "Refresh action" Include item).
"Recalculate portfolio summary" and "Retain previous valid values if
refresh fails" are already true today, for free: `recomputeSummary` only
re-derives from the portfolio's already-validated, already-stored
fields — it never fetches, so there is nothing external to fail and
nothing valid to lose. M5-018's own DoD ("Refresh failures do not erase
valid existing data") is satisfied structurally, not by new workflow
code. `features/dashboard/index.ts`'s own header comment — which
previously expected M5-018 to be the task that finally populated the
empty `hooks/`/`services/` subdirectories — is updated to record this
finding; those subdirectories remain empty.

**Scope discipline**: `git diff --stat -- engine/ stores/ types/` empty
— zero Engine/Store/type files touched. `git diff --stat -- services/`
also empty — unlike every prior batch since Batch 4, this one needed no
new Service and no barrel-export addition either, since
`normalizeMarketQuote`/`normalizeProtocolQuote`'s output was already
fully threaded through to `DashboardFreshness` by Batch 2.

**Validation — Batch 8**

| Command                      | Result                                                                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm typecheck`             | ✅ Pass                                                                                                                                    |
| `pnpm lint`                  | ✅ Pass                                                                                                                                    |
| `pnpm format:check`          | ✅ Pass                                                                                                                                    |
| `pnpm test` (Vitest)         | ✅ Pass, 1017/1017 (7 net new)                                                                                                             |
| `pnpm test:coverage`         | ✅ 95.44% statements / 89.1% branches / 100% functions / 98.8% lines (project-wide) — consistent with Batch 7's 95.41%/88.87%/100%/98.79%. |
| `pnpm test:e2e` (Playwright) | ✅ Pass, 12/12 (unchanged)                                                                                                                 |
| `pnpm build`                 | ✅ Pass — `/` grew from 5.66 kB to 6.1 kB (215 kB First Load JS)                                                                           |

**Manual browser verification**: created a portfolio with manually-entered
market/protocol data — confirmed the Data Freshness section renders both
rows ("BTC Price:", "Protocol Parameters:"), the "Fresh" classification,
the "(manual entry)" callout, and the Manual Mode refresh note on a
production build. Created a second portfolio with zero collateral and
nonzero debt (the same known Zod-valid-but-calculation-failing case
M4-017 established) — confirmed the Dashboard's error branch still shows
the Data Freshness section above the error message, per the DoD.

**Architecture audit**: `git diff --stat -- engine/ stores/ types/`
empty; `git diff --stat -- services/` empty. `buildDataFreshnessIndicators.ts`
imports only from `../types/*` (Dashboard-local types) — no `@/services`
or `@/engine` import at all, since every value it needs was already
threaded through `DashboardFreshness` by Batch 2's own `buildDashboardViewModel`.

**Traceability**: M5-017's Show list (Source, Last updated time,
Fresh/stale classification, Manual-data status, Refresh status) is
addressed field-by-field above, with the one documented, carried-forward
scoping note (protocol freshness classification not invented) explained
rather than silently dropped. M5-018's Workflow list and DoD are
addressed by the "Resolves M5-018" paragraph above, with the two
structurally-blocked steps and the two already-satisfied steps each
named individually.

---

### Batch 9 — Dashboard States (M5-019, M5-020)

Ninth Milestone 5 batch. `06_TASKS.md`'s task-level dependency graph
places M5-016 and M5-019 through M5-022 between "Recommendations" and
"Responsive and Accessible States" (M5-023 depends on "M5-006 through
M5-021"). Scoped to M5-019 (Loading States) + M5-020 (Empty States) —
the same "loading/empty" UI-states pairing Milestone 4 kept distinct
from its own Error Recovery task (M4-016 "Portfolio Empty States" was
bundled into Batch 2 alongside unrelated work; M4-017 "Portfolio Error
Recovery" got its own dedicated batch). M5-021 (Dashboard Error
Recovery) is reserved for its own future batch on the same precedent —
it is P0/Effort M, materially larger than either task here, and (per
the investigation below) needs to draw on M4-017's own "Restore last
valid state" finding rather than being a quick addition to this one.
M5-016 (Quick Actions) is unrelated to either "state" task and left for
a later batch, the same reasoning Batch 8 already used to leave it out.

**M5-019 — `features/dashboard/components/DashboardSkeleton.tsx`**:
a single composite skeleton (Summary/KPI/Table/Recommendation blocks,
matching this task's own Include list literally) rendered in place of
the entire page body while `loadStatus === 'loading'`
(`stores/portfolioStore.ts`'s own `load()`, real but synchronous under
Conflict B — no persistence layer exists yet to actually await). The KPI
skeleton row reuses `KpiCard`'s own `loading` prop, added back in M5-005
(Batch 3) and unused until now — it already established the exact
`bg-accent/40` shimmer treatment this batch's other three blocks now
match for visual consistency, rather than inventing a second style.

- **Found and fixed a real, pre-existing "layout shift" bug while
  investigating this task**: before this batch, `app/page.tsx` rendered
  a bare "Loading…" paragraph _and_ the no-portfolio/portfolio branch
  below it simultaneously whenever `loadStatus === 'loading'` — exactly
  the kind of simultaneous, contradictory content this task's own "Avoid
  layout shifts" Requirement warns against. Restructured into one
  mutually-exclusive three-way branch (loading → no-portfolio → portfolio)
  so only one state is ever visible.
- **"Do not display misleading placeholder values"**: every skeleton
  block is an unlabeled, valueless `animate-pulse` bar (or an unlabeled
  `KpiCard` with `loading`) — no fabricated numbers, currency symbols, or
  portfolio name anywhere in the skeleton.
- **Reachability, tested honestly**: `loadStatus === 'loading'` is not
  observable through a normal `render()` in this synchronous
  architecture (both `set()` calls in `load()` happen before any
  assertion can run) — the same characteristic already documented for
  `saveStatus`'s own `'saving'` transition. The new route-level test sets
  `loadStatus: 'loading'` directly via `usePortfolioStore.setState`
  after the initial render (wrapped in `act()`) to exercise the real
  branch, rather than fabricating an artificial delay that does not
  exist in this codebase.

**M5-020 — investigated each of the 6 documented Include items
individually** (the same per-case discipline Batch 5 used for M5-010's
6 Warning cases), rather than assuming which were buildable:

- **"No portfolio"** — already fully satisfied by Batch 1's existing
  "No portfolio is currently selected." message + link. No change.
- **"Portfolio without collateral" — not a distinguishable empty state,
  confirmed by reading the Engine, not assumed.** Zero collateral with
  nonzero debt already fails at `calculateLoanToValue` (`DIVISION_BY_ZERO`
  — M4-017's own finding). Zero collateral _and_ zero debt succeeds at
  `calculateLoanToValue` (`LTV = 0`, a documented `ZERO_COLLATERAL_ZERO_DEBT`
  warning) but then fails at `calculateEffectiveLeverage` — `netWorth`
  is also zero in that case, and `engine/portfolio/calculateEffectiveLeverage.ts`
  explicitly returns `DIVISION_BY_ZERO` for zero net worth. Every
  zero-collateral scenario therefore always collapses into the existing
  calculation-failure error branch (Batch 1, refined since) — there is
  no reachable state where collateral is missing but the Dashboard still
  renders normally. Nothing new was built for this item; nothing new
  could honestly be built for it.
- **"Portfolio without debt" — the one genuinely reachable, buildable
  case.** Nonzero collateral with zero debt succeeds (Conflict #20,
  resolved in Milestone 4) — `PortfolioSummary.liquidation` is `null` by
  design, and every affected card already shows "N/A (no debt)"/
  "Unavailable" (Batches 1, 4). What was missing was one overarching
  explanation, not per-card labels — closed with a new
  `features/dashboard/components/NoDebtNotice.tsx`, gated on the exact
  same `summary.liquidation === null` signal every other zero-debt-aware
  Dashboard builder already uses, additive alongside the existing labels
  rather than replacing them.
- **"Missing prices" / "Missing protocol parameters" — structurally
  unreachable, confirmed via the Zod schema, not assumed.**
  `types/portfolio.schema.ts`'s `portfolioInputSchema` requires `market`
  (`btcPriceUsd: z.number().finite().positive()`) and `protocol`
  (`protocolParametersSchema`, itself all-required fields) unconditionally
  on every portfolio — `store.create()`/`store.update()` reject anything
  that omits them before a record ever exists. A Portfolio without a
  price or protocol parameters cannot exist in this Store. Nothing was
  built for either item; nothing could be.
- **"No recommendations" — buildable, and revisits Batch 7's own
  decision.** Batch 7 originally rendered nothing when `items` was
  empty, reasoning "neither [case] warrants... a misleading message" —
  a decision not to fabricate an explanation without a concrete task
  asking for one. M5-020 now asks for exactly that. Extended
  `RecommendationSummary` with a new `emptyReason: 'no_target' |
'target_met' | 'unavailable'` field (see
  `features/dashboard/types/recommendationSummary.ts`'s own updated
  header comment) so `RecommendationSummarySection` can render an
  honest, case-specific explanation: `'no_target'` gets an action link
  to `/portfolio`; `'target_met'` is deliberately left without one, since
  nothing is missing in that case and forcing a call-to-action would
  misrepresent a satisfied state as a problem.

**Scope discipline**: `git diff --stat -- engine/ stores/ types/` empty
— zero Engine/Store/type files touched. `git diff --stat -- services/`
also empty, matching Batch 8 — no new Service call was needed for
either task; both reuse `PortfolioSummary.liquidation` and
`RecommendationSummary`, values already fully computed by earlier
batches.

**Validation — Batch 9**

| Command                      | Result                                                                                                                                    |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`             | ✅ Pass                                                                                                                                   |
| `pnpm lint`                  | ✅ Pass                                                                                                                                   |
| `pnpm format:check`          | ✅ Pass                                                                                                                                   |
| `pnpm test` (Vitest)         | ✅ Pass, 1023/1023 (13 net new)                                                                                                           |
| `pnpm test:coverage`         | ✅ 95.46% statements / 89.2% branches / 100% functions / 98.81% lines (project-wide) — consistent with Batch 8's 95.44%/89.1%/100%/98.8%. |
| `pnpm test:e2e` (Playwright) | ✅ Pass, 12/12 (unchanged)                                                                                                                |
| `pnpm build`                 | ✅ Pass — `/` grew from 6.1 kB to 6.54 kB (215 kB First Load JS)                                                                          |

**Manual browser verification**: created a zero-debt portfolio through
the real Creation Flow — confirmed the No-Debt Notice renders with its
explanatory text and "Add a debt position" link, positioned above the
KPI grid, and that the Recommendations section's new empty-state message
renders beneath it (screenshot captured, no console errors). The loading
skeleton's real-browser imperceptibility was confirmed rather than
worked around — matching `loadStatus`'s own documented synchronous
transition, the same characteristic already established for
`saveStatus`'s `'saving'` state.

**Architecture audit**: `git diff --stat -- engine/ stores/ types/
services/` empty. `DashboardSkeleton.tsx` and `NoDebtNotice.tsx` both
import only from within `features/dashboard/` (or `next/link`) — no
`@/services` or `@/engine` import in either.

**Traceability**: M5-019's Include list (four named skeletons) and both
Requirements (avoid layout shifts, no misleading placeholders) are
addressed by name above, with the pre-existing layout-shift bug this
investigation found and fixed called out explicitly. M5-020's 6 Include
items are each addressed individually — 2 already satisfied
pre-existing, 1 newly built, 2 confirmed structurally unreachable, 1
newly built by extending an existing section — none silently dropped.

---

### Batch 10 — Dashboard Error Recovery (M5-021)

Tenth Milestone 5 batch. Scoped to M5-021 alone, on the precedent Batch
9's own write-up set: Milestone 4 gave its own Error Recovery task
(M4-017) a dedicated batch rather than bundling it with adjacent work,
and M5-021 (P0, Effort M) is materially larger than M5-019/M5-020 were.

**Pre-implementation investigation**: cross-referenced every ERROR
RECOVERY/ERROR HANDLING/BACKUP & RECOVERY/DATA RECOVERY section across
`01_PRD.md` (4 sections), `03_UI.md` (2 sections), and
`04_BUILD_GUIDE.md` (2 sections) — mirroring M4-017's own investigation
method exactly, rather than only reading `06_TASKS.md`'s short Include
list. This surfaced two things beyond what a literal reading of M5-021
alone would have found:

- **03_UI.md has a Dashboard-specific "ERROR HANDLING" section** (distinct
  from its generic "ERROR RECOVERY" section, which is the same one
  M4-017 already used for the Portfolio page): "If portfolio data cannot
  be calculated: Display Affected Section, Reason, Retry Button. Other
  dashboard sections remain functional whenever possible." The previous
  error branch (a single generic message box) technically satisfied
  "Reason" but had no "Retry Button" — a genuine, real gap this batch
  closes.
- **`01_PRD.md`'s generic error-display guideline** ("Every error shown
  to the user should include... Error Identifier") is not fully met by
  the Portfolio page's own `CalculationErrorBanner` (M4-017) either —
  neither page previously showed an error's `code`, only its `message`.
  This batch adds it to the Dashboard's own banner; retrofitting the
  Portfolio page is out of this task's scope and not attempted.

**M5-021 — `features/dashboard/components/DashboardErrorBanner.tsx`**,
replacing the previous inline error `<div>` in `app/page.tsx`:

- **"Retry calculation" and "Retry refresh" — the same one button**,
  calling `recomputeSummary`. Per Batch 8's own M5-018 finding, there is
  no live data source to separately "refresh" from in this Manual-Mode
  version, so both Include items collapse into one action — the same
  reasoning, not re-derived. This is a deliberate, intentional duplicate
  of `DashboardSummaryHeader`'s own "Refresh" button (which also stays
  visible during a calculation failure): 03_UI.md's own "ERROR RECOVERY"
  section names a "Retry Button" as part of the error display itself, so
  it is placed proximate to the error rather than relying on the user to
  notice a separate header control.
- **"Use last valid data" — already structurally guaranteed, the
  identical finding M4-017 already made for the Portfolio page, applied
  here rather than re-derived.** `stores/portfolioStore.ts`'s
  `update()`/`create()` only mutate _after_ Zod validation succeeds — a
  rejected update never touches the existing, still-valid `Portfolio`
  record. No cache of a prior successful `PortfolioSummary` exists (none
  ever did — every mutation re-derives and re-caches unconditionally),
  but the underlying portfolio data itself can never be destroyed by a
  calculation failure, satisfying this task's own DoD.
- **"Return to portfolio management"** — the existing `/portfolio` link,
  unchanged since Batch 1.
- **"Export recovery copy where applicable"** — reuses M4-017's own
  `downloadPortfolioRecoveryCopy` directly (`utils/portfolioRecoveryExport.ts`);
  no new export utility.
- **"Diagnostic Information (Developer Mode)" — not built.** "Developer
  Mode" does not exist anywhere in this codebase yet (M5-022, a separate,
  later, still-unbuilt task) — the same gap M4-017 already found and left
  undone for the Portfolio page, for the identical reason.
- **"Other dashboard sections remain functional whenever possible" —
  already true, not newly built.** `DashboardSummaryHeader` and
  `DataFreshnessSection` (Batches 2 and 8) render above this banner and
  do not depend on `calculatePortfolioSummary` succeeding. Every other
  Dashboard section genuinely cannot render a partial result —
  `calculatePortfolioSummary` is one atomic calculation with no
  per-metric partial-success model in the Service/Engine layer — so
  "whenever possible" is honestly "the sections that do not depend on
  this one calculation," not an invented partial-rendering capability.
- **"Error Identifier"** — each error's own `code` is now shown beneath
  its message, not only used as a React list key.
- **"Loading failures" / "provider" errors / "persistence" errors — not
  reachable**, for the same reasons M4-017 already established (no
  persistence layer under Conflict B; no live price/protocol provider
  anywhere in this codebase).

**Scope discipline**: `git diff --stat -- engine/ stores/ types/
services/` empty — zero Engine/Store/type/Service files touched. This
batch reuses `recomputeSummary` (M4-017), `downloadPortfolioRecoveryCopy`
(M4-017), and `DashboardViewModelError` (M5-003/M5-004) exactly as they
already exist; no new Store action or Service call was needed.

**Validation — Batch 10**

| Command                      | Result                                                                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm typecheck`             | ✅ Pass                                                                                                                                    |
| `pnpm lint`                  | ✅ Pass                                                                                                                                    |
| `pnpm format:check`          | ✅ Pass                                                                                                                                    |
| `pnpm test` (Vitest)         | ✅ Pass, 1027/1027 (4 net new)                                                                                                             |
| `pnpm test:coverage`         | ✅ 95.48% statements / 89.2% branches / 100% functions / 98.81% lines (project-wide) — consistent with Batch 9's 95.46%/89.2%/100%/98.81%. |
| `pnpm test:e2e` (Playwright) | ✅ Pass, 12/12 (unchanged)                                                                                                                 |
| `pnpm build`                 | ✅ Pass — `/` grew from 6.54 kB to 6.89 kB (216 kB First Load JS)                                                                          |

**Manual browser verification**: created a calculation-failing portfolio
(zero collateral, nonzero debt — the same M4-017 fixture) through the
real Creation Flow. Confirmed the error message, error code
(`DIVISION_BY_ZERO`), all three action buttons, and the "sections above
remain usable" note render; confirmed the Summary Header and Data
Freshness section remain visible above the banner; clicked Retry and
confirmed it reproduces the same failure without crashing (matching
M4-017's own already-established finding, not a new claim); screenshot
captured, no console errors.

**Architecture audit**: `git diff --stat -- engine/ stores/ types/
services/` empty. `DashboardErrorBanner.tsx` imports `usePortfolioStore`
directly (the same pattern `DashboardSummaryHeader` already established
in Batch 2) and `downloadPortfolioRecoveryCopy` from `@/utils` — no
`@/services` or `@/engine` import.

**Traceability**: M5-021's Description ("calculation, provider, and
persistence errors") and all five Include items are addressed
individually above, alongside two additional findings from the
cross-document investigation (the Dashboard-specific "Retry Button" gap,
the "Error Identifier" gap) that a literal reading of `06_TASKS.md`
alone would have missed — mirroring M4-017's own investigation depth.

---

### Batch 11 — Dashboard Quick Actions (M5-016)

Eleventh Milestone 5 batch. Scoped to M5-016 alone, deferring M5-022
(Developer Mode) to its own future batch: M5-022 is a materially larger,
cross-cutting task (wiring diagnostic details into most existing
Dashboard sections, plus a Developer Mode toggle that does not exist
anywhere in this codebase yet), and M5-016 itself grew into a
substantial batch on its own once its "Export portfolio" Action item
was cross-referenced against 03_UI.md's fuller "EXPORT OPTIONS" section
(see below) — the same "don't bundle two tasks that each need real
investigation" reasoning Batch 9/10 already used to keep M5-021 separate.

**Cross-referenced 03_UI.md's own Dashboard "PAGE ACTIONS" and "EXPORT
OPTIONS" sections**, not just `06_TASKS.md`'s short Action list:
"PAGE ACTIONS" confirms M5-016's own 6-item list is the authoritative,
more-granular version of 03_UI.md's 5-item one (splitting "Refresh
Portfolio" into "Edit portfolio" + "Update prices," both real
destinations on the same `/portfolio` page). "EXPORT OPTIONS" is the
real find: "Users may export Portfolio Summary as CSV, JSON [PDF is an
explicit Future Version item]. Exports include calculation timestamps."
This is concrete, documented, buildable scope for "Export portfolio,"
not an invitation to reuse M4-017's narrower recovery-copy export.

**M5-016 — `features/dashboard/components/QuickActionsSection.tsx`**
(+ `types/quickActions.ts`, `utils/buildQuickActions.ts`), rendered in
the shared base section of `app/page.tsx` (alongside
`DashboardSummaryHeader`/`DataFreshnessSection`), so "Edit
portfolio"/"Update prices" stay reachable during a calculation failure —
arguably most useful exactly then, the same reasoning already applied to
the two sections above it:

- **"Edit portfolio" / "Update prices"** — both real, always-available
  links to `/portfolio`, regardless of calculation success.
- **"Run simulation" / "Build loop strategy" / "Create exit plan" —
  marked unavailable, not linked through as if functional.**
  `/simulation`, `/loop-builder`, `/exit-planner` are still Milestone 1
  `PlaceholderPage` scaffolds, whose own text already states
  "Functionality is implemented in a later milestone" — Milestones 6/7
  have not been reached. This task's own Requirement ("Unavailable
  actions should explain why") gives an explicit basis for this, more
  cautious than the sidebar's own pre-existing (M1-scaffold, pre-dating
  this Requirement) unconditional links to the same routes. Disabled
  buttons carry the reason as both visible text and a `title` tooltip.
- **"Export portfolio" is the one action whose availability genuinely
  reflects current portfolio state** (this task's own Requirement),
  gated on `viewModel.ok` rather than feature existence — it exports the
  _calculated_ `DashboardMetrics`, which only exist after a successful
  calculation. When calculation has failed, this action is disabled with
  a reason pointing to `DashboardErrorBanner`'s own "Download recovery
  copy" (the equivalent raw-data-only case), rather than duplicating it
  with a smaller payload.

**Portfolio Summary export — `features/dashboard/utils/exportPortfolioSummary.ts`**
(new): JSON and CSV downloads of the already-calculated `DashboardMetrics`
(the same 10 values already shown in `DashboardKpiGrid`/`LiquidationRiskPanel`),
plus portfolio name and calculation timestamp ("Exports include
calculation timestamps," 03_UI.md). Deliberately **not** a duplicate of
M4-017's `downloadPortfolioRecoveryCopy`: that export is raw _entered_
data for the failure case; this one is calculated _output_ data for the
success case — reusing its shape here would either fabricate calculated
fields that do not exist, or silently drop the timestamp requirement.
`schemaVersion` reuses `PORTFOLIO_RECOVERY_SCHEMA_VERSION` (the same
app-wide Version 0.1 tag `01_PRD.md`'s "BACKUP & RECOVERY" section
requires on every export). PDF is **not built** — 03_UI.md itself lists
it under "Future Version," not Version 0.1. Raw (unformatted) numeric
export is **not built** either: `04_BUILD_GUIDE.md`'s own "IMPORT /
EXPORT DIRECTORY" describes a separate, unassigned `services/export/`
Service (a machine-reimportable schema) that no task assigns building —
this stays a human-readable snapshot of already-formatted display
values, the same "view layer, not a calculator" boundary every other
Dashboard export/format module in this codebase observes.

**Scope discipline**: `git diff --stat -- engine/ stores/ types/
services/` empty — zero Engine/Store/type/Service files touched. Every
exported value is already-formatted `DashboardMetric.formattedValue`
output from `buildDashboardViewModel` (M5-003); no new calculation.

**Validation — Batch 11**

| Command                      | Result                                                                                                                                       |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`             | ✅ Pass                                                                                                                                      |
| `pnpm lint`                  | ✅ Pass                                                                                                                                      |
| `pnpm format:check`          | ✅ Pass                                                                                                                                      |
| `pnpm test` (Vitest)         | ✅ Pass, 1038/1038 (11 net new)                                                                                                              |
| `pnpm test:coverage`         | ✅ 95.55% statements / 89.22% branches / 100% functions / 98.83% lines (project-wide) — consistent with Batch 10's 95.48%/89.2%/100%/98.81%. |
| `pnpm test:e2e` (Playwright) | ✅ Pass, 12/12 (unchanged)                                                                                                                   |
| `pnpm build`                 | ✅ Pass — `/` grew from 6.89 kB to 8.04 kB (217 kB First Load JS)                                                                            |

**Manual browser verification**: created a normal portfolio with
protocol parameters filled in through the real Creation Flow — confirmed
Quick Actions renders all 6 actions (3 real links, 3 disabled with a
"not yet available" tooltip), and that both "Export portfolio (JSON)"
and "Export portfolio (CSV)" buttons click without any console or page
error. Separately (via the same session's earlier calculation-failure
fixture from Batch 10's own re-verification) confirmed the single,
disabled "Export portfolio" button renders correctly when
`viewModel.ok` is `false`, with its own distinct reason tooltip.
Screenshot captured for the success case.

**Architecture audit**: `git diff --stat -- engine/ stores/ types/
services/` empty. `QuickActionsSection.tsx` and
`exportPortfolioSummary.ts` both import only from within
`features/dashboard/` (or `next/link`, or `@/utils/portfolioRecoveryExport`
for the shared schema-version constant) — no `@/services` or `@/engine`
import in either.

**Traceability**: M5-016's Description, all 6 Action items, both
Requirements, and its DoD are addressed individually above. 03_UI.md's
own "EXPORT OPTIONS" section (CSV, JSON, calculation timestamps) is
addressed field-by-field, with the one deliberately-deferred item (PDF,
explicitly a documented "Future Version" item) named rather than
silently dropped.

---

### Batch 12 — Dashboard Responsive Layout (M5-023)

Twelfth Milestone 5 batch. M5-023's own dependency ("M5-006 through
M5-021") is now fully satisfied — all of M5-016 through M5-021 shipped
across Batches 4–11. Chose M5-023 over M5-022 (Developer Mode) for this
batch despite M5-022 coming first numerically: M5-023 is P0 (M5-022 is
P2) and is the next bucket 06_TASKS.md's own coarse "IMPLEMENTATION
ORDER" names explicitly ("Recommendations → Responsive and Accessible
States → Testing"), while M5-022 gates nothing until M5-025. M5-024
(Accessibility Pass, which depends on M5-023) was left for its own
batch, the same "don't bundle two tasks that each need real
investigation" discipline Batches 9–11 already established.

**Investigated by rendering the real, compiled app at real viewport
widths via Playwright — not by reading Tailwind class names alone.**
Code review first suggested most Dashboard sections already used
mobile-first responsive classes (`grid-cols-1 sm:grid-cols-2
lg:grid-cols-4` on `DashboardKpiGrid`; the same on `LiquidationRiskPanel`'s
inner grid; `PortfolioCompositionSection`'s existing table/compact-card
split), which turned out to be correct — screenshots at 375px/640px/1280px
showed no problems in any of those. But a `document.documentElement.scrollWidth`
check at exactly 375px (mobile) and 768px (the width the sidebar first
appears, `AppSidebar.tsx`'s own `md:` breakpoint) surfaced two real,
previously-undetected horizontal-overflow bugs that no amount of reading
class names would have found:

- **`AppHeader`'s `<select>` (the portfolio switcher, M4-010) had no
  width constraint** — a long portfolio name forced the header wider
  than a 375px viewport, with no `flex-wrap` to compensate, producing
  real page-level horizontal scroll. Fixed with a `max-w-[45vw]` cap
  below `sm:` (the browser truncates the _displayed_ value only; the
  full name remains selectable in the dropdown's own option list).
- **`PortfolioCompositionSection`'s table was visibly cramped** at
  exactly 768px (sidebar present, `lg:`'s 4-column KPI breakpoint not yet
  reached) — its 6 columns had no room and text visibly ran together.
  Wrapped the table in its own `overflow-x-auto` container with
  `whitespace-nowrap` cells, the standard pattern for "Tables must adapt
  appropriately" without violating "No horizontal page scrolling" — the
  scroll is local to the table, confirmed empirically (the container's
  own `scrollWidth`/`clientWidth` differ, scrolling it reveals the
  "Portfolio %" column, and the _page_ never overflows even after
  scrolling within it).
- **Fixing the table's own container wasn't sufficient by itself** —
  found via the same viewport check still showing overflow after the
  first fix. Root cause: `AppShell`'s `<main>` is a flex item with no
  `min-width` override, and a flex item's default `min-width: auto`
  refuses to shrink below its content's natural width, so the table's
  wide content was widening `<main>` (and the whole page) instead of
  scrolling inside its own container. Added `min-w-0` to `<main>` — the
  standard, well-known fix that lets a flex child shrink to its
  container's width so an inner `overflow-x-auto` can actually contain
  overflow instead of propagating it upward.

**All three fixes touch shared, pre-Milestone-5 layout components**
(`AppHeader.tsx`, `AppShell.tsx` — both M1-006), not Dashboard-owned
files, and apply to every route, not only the Dashboard. This is a
deliberate, documented exception to "only touch Dashboard-owned code,"
made because M5-023's own literal Requirement ("No horizontal page
scrolling") is a property of what the Dashboard route actually renders
on screen, which necessarily includes the always-present header and
shell — reporting M5-023 complete while the Dashboard visibly overflowed
on a real mobile device would not have been honest. Each fix carries its
own detailed comment explaining the empirical finding, not just the
change.

**"Critical metrics remain near the top"** — confirmed already
satisfied by the established render order (`app/page.tsx`, unchanged
since Batch 1: Summary Header → Data Freshness → Quick Actions → Risk
Warnings/No-Debt Notice → **KPI Grid** → Health Factor Status →
Liquidation Risk → Portfolio Composition → Debt/Interest → Leverage →
Recommendations); no reordering was needed, only verified via the same
screenshots.

**Mobile navigation gap noted, not built.** `AppSidebar.tsx` is `hidden
md:block` — below `md:` there is no sidebar and no replacement mobile
menu, so a mobile user cannot navigate away from the current page via
the sidebar (only via in-page links, e.g. Quick Actions' own). This is a
pre-existing M1-006 characteristic, not something M5-023's own text asks
for (its dependency list and Description are Dashboard-content-scoped, a
hamburger-menu feature is not named anywhere in it), and building one
here — affecting global navigation across every route — would be real
scope creep beyond "Optimize the Dashboard for supported screen sizes."
Documented, not silently ignored, and not invented.

**Scope discipline**: `git diff --stat -- engine/ stores/ types/
services/` empty — zero Engine/Store/type/Service files touched. Every
change is CSS/layout-only (Tailwind class changes); no new calculation,
Store action, or Service call anywhere in this batch.

**Validation — Batch 12**

| Command                      | Result                                                                                                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm typecheck`             | ✅ Pass                                                                                                                                                            |
| `pnpm lint`                  | ✅ Pass                                                                                                                                                            |
| `pnpm format:check`          | ✅ Pass                                                                                                                                                            |
| `pnpm test` (Vitest)         | ✅ Pass, 1041/1041 (2 net new)                                                                                                                                     |
| `pnpm test:coverage`         | ✅ 95.55% statements / 89.22% branches / 100% functions / 98.83% lines (project-wide) — unchanged from Batch 11 (CSS-only changes add no new statements/branches). |
| `pnpm test:e2e` (Playwright) | ✅ Pass, 16/16 (4 net new — see below)                                                                                                                             |
| `pnpm build`                 | ✅ Pass — `/` grew from 8.04 kB to 8.09 kB (217 kB First Load JS)                                                                                                  |

**New permanent regression tests — `tests/e2e/responsiveLayout.spec.ts`**
(new file, 4 tests): real-browser viewport checks at 375px/768px/1280px
confirming `document.documentElement.scrollWidth <= clientWidth` on the
Dashboard, using the same long-portfolio-name fixture that produced the
real `AppHeader` bug; a dedicated test confirming the Portfolio
Composition table's own container is genuinely scrollable, that
scrolling it reveals the "Portfolio %" column, and that the page itself
never overflows even mid-scroll. This property cannot be unit-tested in
Vitest/jsdom (no real box-layout computation), so Playwright is the only
honest place for it — a deliberate, permanent guard against regressing
either fix. Two small companion unit tests
(`tests/unit/components/layout/AppHeader.test.tsx`,
`tests/unit/features/dashboard/PortfolioCompositionSection.test.tsx`)
assert the fix's own CSS classes remain present, catching an accidental
revert even though they cannot verify actual layout.

**Manual browser verification**: screenshots captured at 375px, 640px,
768px, and 1280px, before and after each fix, driving the real Creation
Flow through to the Dashboard. Confirmed visually and via the
`scrollWidth`/`clientWidth` check at every width: no horizontal page
scroll, KPI grid at 1/2/4 columns matching Mobile/Tablet/Desktop per
this task's own Description, Liquidation Risk's 3-card grid at
1/2/3 columns, the Portfolio Composition table scrolling locally and
cleanly at 768px instead of visibly cramping, and the header's portfolio
switcher truncating cleanly on mobile instead of forcing page overflow.

**Architecture audit**: `git diff --stat -- engine/ stores/ types/
services/` empty. Every changed file is either a pre-existing shared
layout component (`AppHeader.tsx`, `AppShell.tsx`) or an existing
Dashboard component (`PortfolioCompositionSection.tsx`) — no new
component, type, or builder was added; this batch is exclusively
CSS/layout adjustments to already-existing render trees.

**Traceability**: M5-023's Description (Desktop/Tablet/Mobile column
behavior), both Requirements ("No horizontal page scrolling," "Tables
must adapt appropriately," "Critical metrics remain near the top" —
three Requirements total, all three addressed), and its DoD are each
addressed individually above, with the two real bugs found and fixed
named specifically rather than a general "looks fine" assertion, and the
one deliberately out-of-scope finding (mobile sidebar navigation)
documented rather than silently ignored or invented.

---

### Batch 13 — Dashboard Accessibility Pass (M5-024)

Thirteenth Milestone 5 batch. M5-024's own dependency (M5-023) is now
satisfied. Chose M5-024 over M5-022 (Developer Mode) for the same
reasoning Batch 12 used to choose M5-023 over M5-022: M5-024 is P0
(M5-022 is P2) and is the other half of `06_TASKS.md`'s own coarse
"Responsive and Accessible States" Implementation Order bucket, which
M5-023 already began.

**M5-024's own DoD names a section that turns out to carry no concrete
content.** "The Dashboard meets the accessibility requirements defined
in the Build Guide" points to `04_BUILD_GUIDE.md`'s own "ACCESSIBILITY"
line — a single checklist tick ("✓ Accessibility") with nothing else
under it anywhere in that document. Not a blocking conflict (a real,
concrete, cross-document-consistent target exists elsewhere): `01_PRD.md`'s
REQ-008-F and REQ-011-E both state "WCAG AA Compliance... Target WCAG
AAA where practical," and `03_UI.md`'s own "ACCESSIBILITY" section
states "Minimum Target: WCAG AA" — three independent sections agreeing
on the same bar. This batch verifies against WCAG AA (the actual,
documented, agreed-upon standard), not the empty Build Guide checkbox
literally named in the DoD text, and not an invented bar of its own.

**Added `@axe-core/playwright` as a new devDependency** — the
industry-standard automated WCAG checker, the only honest way to verify
"meets WCAG AA" as a real, repeatable, re-checkable claim rather than a
one-time manual eyeball. A real browser, run against every structurally
distinct Dashboard state, is also the only way to test "Keyboard
navigation" and "Focus visibility" at all — Vitest/Testing Library run
in jsdom, which does not compute real focus/tab order or visual styling.

**Investigated each of M5-024's 8 Review items individually**, exactly
the per-item discipline Batches 5, 9, and 12 already established for
their own multi-item tasks:

- **Heading order** — audited every heading tag across the whole
  Dashboard render tree (`app/page.tsx` and every `features/dashboard/`
  component): `h1` (route) → `h2` (portfolio name, Summary Header) →
  `h3` (every section: Data Freshness, Quick Actions, Risk Warnings,
  Health Factor Status, Liquidation Risk, Portfolio Composition, Debt
  and Interest, Leverage Summary, Recommendations) — strictly
  sequential, no skipped levels, no `h3` appearing before its own `h2`.
  **Already correct; no fix needed.** Confirmed via code review, not
  assumed.
- **Keyboard navigation** — confirmed via a real scripted Tab-through
  (`tests/e2e/accessibility.spec.ts`) that every interactive control
  (links, buttons, the portfolio switcher `<select>`, the newly
  `aria-disabled` Quick Actions buttons) is reachable and that known
  controls are actually hit. **Already correct** given this codebase's
  consistent use of real `<button>`/`<a>`/`<select>` elements throughout
  every prior batch — no component here invents a fake, unreachable
  "clickable div."
- **Focus visibility** — confirmed via `app/globals.css` (no
  `outline-none`/`focus:outline-none` anywhere in this codebase) and a
  real scripted check that every focused element's computed
  `outline-style`/`outline-width` is non-empty. **Already correct**,
  since nothing here ever strips the browser's own default focus ring.
- **Status announcements — 2 real, found-not-assumed gaps closed.**
  `DashboardErrorBanner` (M5-021) had no live-region role at all —
  fixed with `role="alert"`, mirroring `RiskWarningBanner`'s own
  already-existing `role="alert"` (M5-010) for the identical class of
  condition. `NoDebtNotice` (M5-020) also had none — fixed with
  `role="status"` (polite, not assertive, since it is informational, not
  an error), matching the polite/assertive distinction
  `DashboardSummaryHeader`'s own storage-status line already establishes.
- **Chart alternatives — structurally not applicable, not skipped.**
  No chart exists anywhere on the Dashboard: M5-012 ("Implement
  Portfolio Allocation Chart") was already resolved with no component
  built, since `composition.showAllocationChart` is always `false`
  under Conflict A (single-asset scope). There is nothing to provide an
  alternative _for_.
- **Table semantics — 1 real, found-not-assumed gap closed.** The one
  real `<table>` (`PortfolioCompositionSection`, M5-011) had no
  `scope="col"` on any header cell — a screen reader navigating
  cell-by-cell could not announce which column a data cell belonged to
  (WCAG 1.3.1). Fixed on all 6 header cells.
- **Tooltip accessibility — 2 real, found-not-assumed gaps closed,
  both already flagged as this exact task's own future work by earlier
  batches' own comments** (`KpiCard.tsx`'s own M5-005 comment, and
  `QuickActionsSection.tsx`'s own M5-016 comment). `KpiCard`'s `title`
  attribute lived on a non-focusable `<div>`, only ever reachable by
  mouse hover — fixed by adding `tabIndex={0}` exactly when a `tooltip`
  is actually provided (not unconditionally, which would add a useless
  empty tab stop). `QuickActionsSection`'s unavailable-action buttons
  used the native `disabled` attribute, which removes an element from
  the tab order in every browser — meaning the "explain why" reason
  (this task's own M5-016 Requirement) was **never reachable without a
  mouse**. Fixed by switching to `aria-disabled="true"` (kept focusable,
  no `onClick` exists to guard against regardless). Both are still the
  native `title` mechanism — a richer, dismissible/hoverable tooltip
  component remains M5-022's ("Implement Dashboard Developer Mode") own
  scope, not built here.
- **Color-independent warnings — already correct, confirmed via
  review, not a new fix.** `KpiCard`'s own status label (M5-005) already
  renders "Warning"/"Unavailable" as visible text, not color alone
  (documented in that component's own header comment); `RiskWarningBanner`/
  `DashboardErrorBanner`/`NoDebtNotice` all pair their color-coded
  styling with full explanatory text, never color alone.

**Automated axe-core scans (WCAG 2A + 2AA rule sets) across 4
structurally distinct Dashboard states — zero violations in every
one**, both before and after the fixes above (the fixes address gaps
axe cannot fully automate — keyboard reachability of `title` tooltips,
live-region choice — not violations axe itself flagged): no portfolio
selected, a healthy portfolio with active recommendations, a
calculation failure (Dashboard Error Banner), and a zero-debt portfolio
(Risk Warning Banner + No-Debt Notice together).

**Scope discipline**: `git diff --stat -- engine/ stores/ types/
services/` empty — zero Engine/Store/type/Service files touched. Every
component change is an accessibility-attribute addition
(`role`, `scope`, `tabIndex`, `aria-disabled`) to already-existing
render output; no new calculation, Store action, or Service call. The
one dependency change (`@axe-core/playwright`, devDependency only) is
test tooling, not shipped application code.

**Validation — Batch 13**

| Command                      | Result                                                                                                                                        |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`             | ✅ Pass                                                                                                                                       |
| `pnpm lint`                  | ✅ Pass                                                                                                                                       |
| `pnpm format:check`          | ✅ Pass                                                                                                                                       |
| `pnpm test` (Vitest)         | ✅ Pass, 1046/1046 (5 net new)                                                                                                                |
| `pnpm test:coverage`         | ✅ 95.55% statements / 89.24% branches / 100% functions / 98.83% lines (project-wide) — consistent with Batch 12's 95.55%/89.22%/100%/98.83%. |
| `pnpm test:e2e` (Playwright) | ✅ Pass, 23/23 (7 net new — see below)                                                                                                        |
| `pnpm build`                 | ✅ Pass — `/` grew from 8.09 kB to 8.12 kB (217 kB First Load JS)                                                                             |

**New permanent regression tests — `tests/e2e/accessibility.spec.ts`**
(new file, 7 tests): 4 axe-core WCAG-AA scans across the states named
above; a scripted keyboard-only Tab-through confirming real controls are
reached; a scripted focus-visibility check across 15 Tab presses; a
dedicated test confirming the unavailable Quick Actions button's reason
is reachable via `.focus()` (the specific fix this task made). One
found-and-fixed test-authoring issue along the way: an initial
`getByRole('alert')` assertion was ambiguous against Next.js's own
built-in SPA route announcer (`#__next-route-announcer__`, framework-
injected, also `role="alert"`) — rescoped to the error banner's own
text. Six small companion unit tests
(`KpiCard.test.tsx`, `DashboardErrorBanner.test.tsx`, `NoDebtNotice.test.tsx`,
`PortfolioCompositionSection.test.tsx`, plus the `toBeDisabled()` →
`aria-disabled` assertion updates in `QuickActionsSection.test.tsx`/
`page.test.tsx` that the `aria-disabled` switch required) assert each
fix's own attributes remain present.

**Manual/automated browser verification**: ran the axe-core scans and
scripted keyboard/focus checks against the real compiled dev server
(not mocked), driving the actual Creation Flow through to the Dashboard
for each of the 4 states. Confirmed zero WCAG AA violations in every
state, confirmed the previously-mouse-only tooltip reasons are now
reachable via `.focus()`, and confirmed Tab order reaches every real
control without getting stuck.

**Architecture audit**: `git diff --stat -- engine/ stores/ types/
services/` empty. Every changed component file already existed; no new
component, type, or builder was added. `package.json`'s only change is
the one new devDependency.

**Traceability**: all 8 of M5-024's Review items are addressed
individually above — 4 confirmed already correct via direct
investigation (not assumed), 4 real gaps found and fixed, 1 confirmed
structurally not applicable (chart alternatives) — and its DoD is
addressed by substituting the verifiable, cross-document-consistent
WCAG AA target for the Build Guide's own empty checklist reference,
documented rather than silently reinterpreted.

---

### Batch 14 — Dashboard Developer Mode (M5-022)

Fourteenth Milestone 5 batch, the last "feature" task before Milestone
5's own Testing phase (M5-025 depends on "M5-006 through M5-022" and its
own "Cover" list explicitly names "Developer Mode" as a state to test —
confirming this task genuinely gates that later one, not just by
numeric order).

**Investigated where the toggle's own state should live — a real gap,
not assumed.** 03_UI.md's "DEVELOPER MODE" section ("It is disabled by
default") implies a persistent, app-wide control, but its own
"SETTINGS" page section's literal Version 1 field list (BTC Price
Provider, Currency, Target Health Factor, Display Precision, Theme)
does not name a Developer Mode toggle, and no task anywhere in
`06_TASKS.md` assigns building a Settings page (`/settings` remains the
Milestone 1 `PlaceholderPage` scaffold). M5-022's own Dependencies list
is only M5-003 — not a Settings-page task — confirming the toggle is
meant to be self-contained. Resolved with a new, small, dedicated
`stores/developerModeStore.ts`, the same lightweight-Store pattern
`stores/portfolioStore.ts` already established, in-memory only (Conflict
B) — not by inventing a Settings page or persistence this milestone does
not build.

**Checked which of M5-022's 7 "Display where appropriate" items are
genuinely new, gated content, rather than assuming all 7 needed new
UI.** `ServiceMetadata` (`services/shared/result.ts`, M3-002) already
carries `engineVersion`/`formulaVersion`; `DashboardMetric` (M5-003)
already carries `rawValue`/`formulaId` — none of these were previously
threaded through to any rendered output. But "Assumptions"
(`LiquidationRiskPanel`'s own `assumptions` line, M5-009), "Warnings"
(`RiskWarningBanner`'s own `calculationWarnings` case, reading
`DashboardViewModelOk.warnings` directly, M5-010), and "Calculation
timestamp" (the "Calculated {timestamp}" line above the KPI grid,
M5-001) are **already visible to every user today, unconditionally** —
moving them behind a new toggle would hide information from normal
users, the opposite of this task's own DoD ("without cluttering," not
"without informing"). Only "Raw values," "Formula IDs," "Engine
version," and "Formula version" are genuinely new, Developer-Mode-gated
content; those four are what this batch built.

**M5-022 — `features/dashboard/components/DeveloperModeToggle.tsx`**
(+ `stores/developerModeStore.ts`), rendered in the shared base section
of `app/page.tsx` (alongside `DashboardSummaryHeader`/`DataFreshnessSection`/
`QuickActionsSection`) — a display preference, not tied to calculation
success. `features/dashboard/utils/buildKpiDeveloperDetails.ts` (new)
feeds `KpiCard`'s own `developerModeDetails` slot (added M5-005, unused
until this batch) with each metric's Formula ID, raw value, and the
calculation's shared Engine/Formula version; wired into both
`DashboardKpiGrid` (M5-006) and `LiquidationRiskPanel` (M5-009), the two
sections that already use `KpiCard`. `DashboardViewModelOk` (M5-003)
gained `engineVersion`/`formulaVersion` fields, read directly off
`ServiceResult.metadata` — no new calculation, only two more fields
threaded through an already-computed value.

- **"Developer Mode must not change calculation behavior"** (this
  task's own Requirement): enforced structurally, not just by
  convention — `useDeveloperModeStore`'s `enabled` flag is read only by
  Dashboard view-layer components; no Engine or Service call anywhere
  takes it as an input.
- **A metric with no `formulaId` (e.g. the zero-debt liquidation trio)
  shows no developer details even when the toggle is on** — nothing
  formula-specific to elaborate on for a value that was never computed,
  confirmed via a dedicated test.

**Scope discipline**: `git diff --stat -- engine/ services/ types/`
empty — zero Engine/Service/shared-type files touched.
`git diff --stat -- stores/` shows only the one new file
(`developerModeStore.ts`); `stores/portfolioStore.ts` itself is
untouched. Every value displayed is already-computed Service output,
reshaped, not recalculated.

**Validation — Batch 14**

| Command                      | Result                                                                                                                                        |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`             | ✅ Pass                                                                                                                                       |
| `pnpm lint`                  | ✅ Pass                                                                                                                                       |
| `pnpm format:check`          | ✅ Pass                                                                                                                                       |
| `pnpm test` (Vitest)         | ✅ Pass, 1060/1060 (14 net new)                                                                                                               |
| `pnpm test:coverage`         | ✅ 95.58% statements / 89.32% branches / 100% functions / 98.84% lines (project-wide) — consistent with Batch 13's 95.55%/89.24%/100%/98.83%. |
| `pnpm test:e2e` (Playwright) | ✅ Pass, 24/24 (1 net new — see below)                                                                                                        |
| `pnpm build`                 | ✅ Pass — `/` grew from 8.12 kB to 8.45 kB (217 kB First Load JS)                                                                             |

**Extended `tests/e2e/accessibility.spec.ts` (Batch 13) with a 5th
axe-core WCAG-AA scan state**: Developer Mode enabled — zero violations,
closing the loop on this batch's own new UI (a checkbox and per-card
detail blocks) rather than leaving it unverified by the accessibility
suite that batch already built.

**Manual browser verification**: toggled Developer Mode on for a real
portfolio through the actual Creation Flow — confirmed every KPI card
and all three Liquidation Risk cards show their own Formula ID, raw
value, and a shared "Engine v0.1.0, Formula v1.0" line; confirmed no
developer details render before toggling; confirmed the displayed KPI
values themselves are unchanged before/after toggling (calculation
behavior unaffected); screenshot captured, no console errors.

**Architecture audit**: `git diff --stat -- engine/ services/ types/`
empty; `git diff --stat -- stores/` shows only the new
`developerModeStore.ts`. `DeveloperModeToggle.tsx` and
`buildKpiDeveloperDetails.ts` both import only from within
`features/dashboard/` or the new Store — no `@/services` or `@/engine`
import in either.

**Traceability**: M5-022's Description, all 7 "Display where
appropriate" items (4 newly gated, 3 confirmed already satisfied for
all users, not silently dropped), its Requirement, and its DoD are each
addressed individually above.

---

### Batch 15 — M5-025 (Create Dashboard Component Tests)

**Dependencies satisfied**: M5-006 through M5-022 are all synchronized
to GitHub as of Batch 14, unblocking this task — the last
`Dependencies` entry (M5-022) was itself the previous batch.

**This batch found no missing component and added zero production
code.** Every one of the 15 Dashboard components already had its own
dedicated test file, built incrementally alongside its component
across Batches 1–14 (`ls features/dashboard/components/` and
`ls tests/unit/features/dashboard/` are 1:1). The real work this task's
own text calls for is checking each component's tests against the 8
named `Cover` items and closing genuine gaps — an audit task, the same
shape as Batch 13's (M5-024) own accessibility pass, not a build task.

**Audited each of the 8 `Cover` items individually against the existing
suite, rather than assuming "components have tests" already satisfies
the task:**

- **Normal values** — already satisfied everywhere; every existing
  `describe` block's base case is a normal-value fixture.
- **Zero debt** — partially satisfied (`DashboardKpiGrid`'s
  "N/A (no debt)" test, `NoDebtNotice`). **Closed this batch** in the 4
  components that had no zero-debt test of their own:
  `HealthFactorStatusSection` (Health Factor is exactly `Infinity` at
  zero debt — `formatHealthFactor`'s own header comment already
  documents `Intl.NumberFormat` rendering this as "∞" natively — a real
  behavior, now verified, not assumed), `LiquidationRiskPanel` (all
  three calculated estimates render `Unavailable`/"N/A (no debt)"),
  `DebtAndInterestPanel` (all four money figures render exactly
  `$0.00`, not `NaN` or a dash), `LeverageSummarySection` (leverage is
  exactly `1`, not `Infinity` — `buildLeverageSummary.ts`'s own header
  comment already explains why: `calculatePortfolioSummary` fails the
  whole summary on `DIVISION_BY_ZERO` before leverage could ever be
  non-finite — now verified with a real zero-debt fixture instead of
  only asserted in a comment).
- **Missing data** — already fully audited in Batch 9 (M5-020): every
  reachable missing-data case (`DashboardErrorBanner`'s calculation
  failure, the zero-debt-driven `unavailable` KPIs) already has a
  test; collateral/price/protocol-missing states remain confirmed
  structurally unreachable via required Zod fields. No new gap found.
- **Warning states** — already satisfied (`RiskWarningBanner`'s
  `role="alert"` and multiple-simultaneous-warnings tests, `KpiCard`'s
  `status="warning"` test). No new gap found.
- **Critical Health Factor** — genuine gap, **closed this batch**.
  Added a shared near-liquidation fixture (2 BTC × $50,000 × 0.8
  liquidation threshold ÷ $79,000 debt ≈ 1.0127 — deliberately just
  above the 1.0 liquidation boundary) to `HealthFactorStatusSection`
  and `LiquidationRiskPanel`, asserting the real computed value renders
  without clamping, rounding to a whole number, or crashing. No risk-band
  label is asserted or invented — Conflict #1 still blocks that; this
  only verifies numeric behavior at an extreme value.
- **Stale data** — genuine gap, **closed this batch**. `'Stale'` is a
  real, reachable `freshnessLabel` value (`services/market/quote.ts`'s
  own 5-minute `FRESHNESS_THRESHOLD_MINUTES`), but no component test
  had ever driven it. `DataFreshnessSection` now covers a `Stale`
  `freshnessLabel` directly. `DashboardSummaryHeader` now covers it
  through a real fixture, not a synthetic one: `vi.useFakeTimers()` /
  `vi.setSystemTime()` advances 6 minutes past the portfolio's real
  `marketUpdatedAt`, then calls `buildDashboardViewModel` again (which
  computes market freshness fresh, at call time, via
  `normalizeMarketQuote`'s own `now` parameter) — confirming the
  ", stale" suffix this component's own JSX already renders.
- **Developer Mode** — already satisfied (`DashboardKpiGrid`,
  `LiquidationRiskPanel`, `KpiCard`, `DeveloperModeToggle`, all from
  Batch 14 / M5-022). No new gap found.
- **Long values** — genuine gap, **closed this batch**. `KpiCard` now
  covers a long formatted primary value (a 24-character currency
  string) rendering in full. `DashboardSummaryHeader` now covers a
  200-character portfolio name rendering in full — confirmed against
  `types/portfolio.schema.ts`'s own `name: z.string().min(1, ...)`,
  which has no maximum length, so a long name is a real, reachable
  input, not a fabricated edge case.

**Zero production code changed** — this batch is the cleanest possible
scope for its own task: `git diff --stat -- engine/ services/ types/
stores/ features/dashboard/components/ features/dashboard/utils/
app/` is empty. Only 7 test files were touched, all under
`tests/unit/features/dashboard/`.

**Validation — Batch 15**

| Command                      | Result                                                                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`             | ✅ Pass                                                                                                                         |
| `pnpm lint`                  | ✅ Pass                                                                                                                         |
| `pnpm format:check`          | ✅ Pass                                                                                                                         |
| `pnpm test` (Vitest)         | ✅ Pass, 1070/1070 (10 net new)                                                                                                 |
| `pnpm test:coverage`         | ✅ 95.58% statements / 89.41% branches / 100% functions / 98.84% lines (project-wide) — consistent with Batch 14's own numbers. |
| `pnpm build`                 | ✅ Pass — `/` unchanged at 8.45 kB (no production code touched)                                                                 |
| `pnpm test:e2e` (Playwright) | ✅ Pass, 24/24 (unchanged — M5-027 is the dedicated, later E2E task, not this one)                                              |

**Architecture audit**: `git diff --stat -- engine/ services/ types/
stores/` empty; `git status --porcelain` shows exactly 7 modified test
files and no new or deleted files.

**Traceability**: M5-025's Description ("Test individual Dashboard
components") and all 8 `Cover` items are each addressed individually
above; its DoD ("All critical display states have automated tests")
is satisfied — every named critical display state now has at least one
real, fixture-driven component test, not a placeholder.

---

### Batch 16 — M5-026 (Create Dashboard Integration Tests)

**Dependencies satisfied**: M5-025 is synchronized to GitHub as of
Batch 15.

**Found and followed an existing, exact precedent rather than inventing
a new testing convention.** `tests/integration/` already exists, with a
`portfolio/portfolioWorkflows.test.ts` (M4-018) and a
`services/coreWorkflows.test.ts` (M3-014) — both established the same
shape: no React rendering at all, one `describe` block per item in the
task's own `Cover` list, chaining real, non-mocked Store/Service calls
across multiple sequential steps in a single test. `portfolioWorkflows.test.ts`'s
own header comment already states the reasoning this batch reuses
verbatim: page-level rendering is already exhaustively covered by unit
tests (`tests/unit/app/page.test.tsx`'s own 13 `describe` blocks); what
an integration test adds is a multi-step sequence spanning several
calls in one continuous test, which no per-action unit test exercises
end-to-end. Building a new, dedicated
`tests/integration/dashboard/dashboardWorkflows.test.ts` (no such
directory existed yet) follows that precedent exactly, one layer higher
than M4-018's own file — chaining real Store actions with the
Dashboard's own real builder functions (`buildDashboardViewModel` →
`buildHealthFactorStatus` → `buildRiskWarnings`, the exact call chain
`app/page.tsx` itself makes), not the raw `PortfolioSummary` M4-018's
own file stops at.

**All 6 named `Cover` items, one `describe` block each (8 tests
total):**

- **Load active portfolio** — two portfolios created, one selected;
  confirms the view model derives from exactly the active record, and
  that no active selection yields no record (not a crash) — `load()`
  itself has nothing to load (Conflict B, already established).
- **Generate summary** — a real `Portfolio` input flows through
  `calculatePortfolioSummary` and into `buildDashboardViewModel`
  unchanged, cross-checked against the exact `netEquity`/`healthFactor`
  values `portfolioWorkflows.test.ts`'s own "Create first portfolio"
  test already established at the Store layer.
- **Refresh price** — the genuinely new case no existing test covers:
  the portfolio's stored market price is changed directly (simulating
  data changing underneath the active record), then
  `recomputeSummary(id)` — the Dashboard's own Refresh button
  mechanism — is called explicitly and confirmed to re-derive the view
  model from the _current_ price, not a stale cached one.
  (`DashboardSummaryHeader.test.tsx`'s own Refresh test, Batch 4, only
  confirms the button calls `recomputeSummary` and the result is still
  `ok`; it never changes the underlying price first.)
- **Switch portfolio** — two portfolios with different collateral;
  switching active selection twice (and back) confirms each produces
  its own correct, independent view model and that switching never
  mutates either record — the same non-destructive guarantee
  `portfolioWorkflows.test.ts`'s own "Switch portfolios" test already
  proved at the Store layer, now re-confirmed one layer up.
- **Display warnings** — a target-breaching Health Factor flows through
  the real `buildHealthFactorStatus` → `buildRiskWarnings` chain into
  an actual `HEALTH_FACTOR_BELOW_TARGET` warning object (not a
  synthetic one, unlike `RiskWarningBanner.test.tsx`'s own
  component-level tests); a second test repays debt until the target is
  no longer breached and confirms the warning disappears, following the
  same portfolio record across the transition.
- **Recover from Service failure** — a zero-collateral, nonzero-debt
  portfolio yields `viewModel.ok === false` with identity/freshness
  still populated (M5-004's own DoD, confirmed at this layer); fixing
  the collateral via `update()` recovers the view model to `ok: true`
  automatically, in the same continuous test — the same recovery
  `portfolioWorkflows.test.ts`'s own "Recover from invalid input" block
  already proved at the Store layer, now re-confirmed at the Dashboard
  view-model layer.

**Zero production code changed** — `git diff --stat -- engine/
services/ types/ stores/ features/dashboard/components/
features/dashboard/utils/ features/dashboard/types/ app/` is empty.
Only one new file was added:
`tests/integration/dashboard/dashboardWorkflows.test.ts`.

**Validation — Batch 16**

| Command                      | Result                                                                                                                                    |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`             | ✅ Pass                                                                                                                                   |
| `pnpm lint`                  | ✅ Pass                                                                                                                                   |
| `pnpm format:check`          | ✅ Pass                                                                                                                                   |
| `pnpm test` (Vitest)         | ✅ Pass, 1078/1078 (8 net new)                                                                                                            |
| `pnpm test:coverage`         | ✅ 95.58% statements / 89.41% branches / 100% functions / 98.84% lines (project-wide) — unchanged from Batch 15 (no source line changed). |
| `pnpm build`                 | ✅ Pass — `/` unchanged at 8.45 kB (no production code touched)                                                                           |
| `pnpm test:e2e` (Playwright) | ✅ Pass, 24/24 (unchanged — M5-027 is the dedicated, later E2E task, not this one)                                                        |

**Architecture audit**: `git diff --stat -- engine/ services/ types/
stores/` empty; `git status --porcelain` shows exactly one new,
untracked directory (`tests/integration/dashboard/`) and no modified
files at all.

**Traceability**: M5-026's Description ("Test Dashboard integration
with Stores and Services") and all 6 `Cover` items are each addressed
individually above; its DoD ("Dashboard data remains consistent across
state transitions") is satisfied literally — every test chains multiple
sequential state transitions on the same portfolio record and asserts
consistency at each step, not just a single before/after snapshot.

---

### Batch 17 — M5-027 (Create Dashboard End-to-End Tests)

**Dependencies satisfied**: M5-026 is synchronized to GitHub as of
Batch 16.

**Followed `tests/e2e/portfolioWorkflows.spec.ts`'s (M4-018) own
established convention exactly**: one `test('Cover: <Flow>', ...)`
block per item in this task's own "Flows" list, real in-app link
navigation between steps (never a mid-flow `page.goto()`, which reloads
the document and wipes the in-memory Zustand store — Conflict B, the
same finding that file's own header comment already documents), the
same `fillByLabel`/portfolio-creation helper shape. New
`tests/e2e/dashboardWorkflows.spec.ts`.

**All 8 named `Flows`, one test each:**

- **Open first portfolio** — creates a portfolio and confirms the
  Dashboard renders its identity.
- **Review core metrics** — confirms Net Portfolio Value, Health
  Factor, and Loan-to-Value are visible with real, correctly-computed
  values.
- **Switch portfolios** — a second portfolio with different collateral;
  switching via `AppHeader`'s own switcher confirms the Dashboard shows
  each one's own distinct, correct Net Portfolio Value.
- **Update manual BTC price** — edits the price via the Portfolio page
  reached from the Dashboard's own "Edit Portfolio" link, previews, and
  applies.
- **Observe recalculation** — a separate, dedicated test (not folded
  into the price-update test, since the task names them as two distinct
  Flows): confirms the Dashboard's Net Portfolio Value changes from
  $80,000 to $100,000 once the price update is applied and the user
  returns to the Dashboard.
- **Open risk details** — confirms the Liquidation Risk and Health
  Factor Status sections render with real values; both are already
  unconditionally visible on the Dashboard (no expand/collapse gating
  exists to "open"), so this test confirms the content itself, not an
  invented disclosure interaction.
- **Navigate to Simulation Workspace** / **Navigate to Exit Planner** —
  via `AppSidebar`'s real links to both placeholder routes, the one
  honestly testable path today. `QuickActionsSection`'s own "Run
  simulation"/"Create exit plan" buttons are deliberately
  `aria-disabled` (M5-016, Batch 11 — Milestones 6/7 not built yet);
  each test confirms that attribute too, so the suite documents both
  the real path and the deliberately inert one, rather than silently
  only testing the path that happens to work.

**DoD ("Critical Dashboard workflows pass in supported viewport
sizes")** satisfied by a dedicated, separate parametrized check — not
by repeating all 8 Flows three times over, which would triple the
file's runtime for no new signal, since `tests/e2e/responsiveLayout.spec.ts`
(M5-023, Batch 12) already proves the page itself never overflows at
any of the three sizes. Reused that file's own `VIEWPORTS` breakpoints
(375/768/1280px) and "navigate wide, then resize" technique: every
cross-page navigation step (creating a second portfolio, editing the
price) happens at the default desktop viewport first — `AppSidebar`'s
own links are hidden below `md:`, and no mobile-navigation replacement
exists yet (a pre-existing, already-documented gap from Batch 12's own
manual audit) — then the viewport resizes only once the workflow has
already completed, confirming its _result_ renders correctly and
without horizontal overflow at that size. This was a real, found-not-
assumed fix: the first draft resized before the multi-step workflow and
timed out waiting for the hidden sidebar's "Dashboard" link mid-flow.

**Two other real, found-not-assumed bugs in the first draft, both
fixed:** `getByRole('link', { name: 'Edit Portfolio' })` was ambiguous
— `DashboardSummaryHeader`'s own "Edit Portfolio" and
`QuickActionsSection`'s own "Edit portfolio" (lowercase) both matched;
fixed with `exact: true`. `getByText(<portfolio name>)` was ambiguous
whenever a name was short/simple enough to also appear verbatim as an
`<option>` in `AppHeader`'s own switcher `<select>`; fixed by scoping
every such assertion to `getByRole('heading', { name: ... })`, matching
the Summary Header's own `<h2>` specifically.

**Zero production code changed** — `git diff --stat -- engine/
services/ types/ stores/ features/ app/ components/` is empty. Only one
new file was added: `tests/e2e/dashboardWorkflows.spec.ts`.

**Validation — Batch 17**

| Command                      | Result                                                                                                                                    |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`             | ✅ Pass                                                                                                                                   |
| `pnpm lint`                  | ✅ Pass                                                                                                                                   |
| `pnpm format:check`          | ✅ Pass                                                                                                                                   |
| `pnpm test` (Vitest)         | ✅ Pass, 1078/1078 (unchanged — this batch is Playwright-only)                                                                            |
| `pnpm test:coverage`         | ✅ 95.58% statements / 89.41% branches / 100% functions / 98.84% lines (project-wide) — unchanged from Batch 16 (no source line changed). |
| `pnpm build`                 | ✅ Pass — `/` unchanged at 8.45 kB (no production code touched)                                                                           |
| `pnpm test:e2e` (Playwright) | ✅ Pass, 35/35 (11 net new)                                                                                                               |

**Architecture audit**: `git diff --stat -- engine/ services/ types/
stores/ features/ app/ components/` empty; `git status --porcelain`
shows exactly one new, untracked file
(`tests/e2e/dashboardWorkflows.spec.ts`) and no modified files at all.

**Traceability**: M5-027's Description ("Create Playwright tests for
critical Dashboard workflows") and all 8 `Flows` are each addressed
individually above; its DoD ("Critical Dashboard workflows pass in
supported viewport sizes") is satisfied by the dedicated 3-viewport
parametrized test, not asserted without evidence.

---

### Batch 18 — M5-028 (Validate Dashboard Against UI Specification) — final Milestone 5 task

**Dependencies satisfied**: M5-027 is synchronized to GitHub as of
Batch 17. This is the last Milestone 5 task per `06_TASKS.md`.

**Read `03_UI.md` in full for the first time at this granularity** —
not just the sections already individually cited across 17 prior
batches (ACCESSIBILITY, ERROR HANDLING, DEVELOPER MODE, EXPORT
OPTIONS, MOBILE NAVIGATION), but the entire document, page by page,
since this task's own Description is explicitly "a final implementation
audit against `03_UI.md`," not against any one section of it.

**Found the largest single gap in this engagement: `03_UI.md`'s own
Page 3 ("Dashboard") describes an entirely different, never-built
Dashboard design** — see Conflict #30 above for the full comparison
table and reasoning. In short: Page 3's own Section 1–7 mockup
(Market Snapshot with 24-hour price change, a Portfolio Score, a Risk
Category, a Position Timeline chart, a Recent Activity event log) does
not match `06_TASKS.md`'s own M5-001–M5-024 task list, which this
entire Milestone 5 build has correctly followed task-by-task since
Batch 1. Cross-checked one concrete case precisely: Page 3's own
"SECTION 2 PORTFOLIO SUMMARY" card list does not match M5-006's own
"Cards" list, but M5-006's list matches the actually-built
`DashboardKpiGrid` exactly, field for field — conclusive evidence Page
3 is a superseded draft, not a requirement this build silently
dropped. Not retrofitted: doing so would mean inventing a
historical-data subsystem (Position Timeline, Recent Activity) with no
documented storage or projection formula, violating Conflict B (no
persistence before Milestone 8) and Conflict #7 (no documented
compound-interest formula) simultaneously, for an "M"-effort audit task
whose own dependency chain never asked for one. Flagged as a new
conflict requiring a product decision (rewrite Page 3, or mark it
superseded), not an engineering one.

**Individually verified this task's own 7 named `Verify` items, not
just the one large finding:**

- **Information hierarchy** — `app/page.tsx`'s own section order
  (identity/freshness → error or KPI grid → risk sections → composition
  → recommendations → quick actions) matches `06_TASKS.md`'s own
  Implementation Order note cited across Batches 1–7; no reordering
  needed.
- **Required components** — every `06_TASKS.md` M5-xxx component task
  (M5-004 through M5-024, excluding blocked M5-008) has a real,
  synchronized component; cross-checked against
  `features/dashboard/index.ts`'s own export list.
- **Terminology** — spot-checked the one place wording could plausibly
  drift: `DashboardKpiGrid`'s card is labeled "Loan-to-Value," not
  M5-006's own casual "Current LTV" — confirmed _correct_, not a
  deviation, since `02_Formulas.md`'s own F-020 is officially named
  "Loan-to-Value (LTV)," the more authoritative source for a metric's
  own name.
- **Formatting** — currency/percentage/Health-Factor formatting was
  already settled by Conflict #6 (Milestone 2/3) and has been applied
  consistently by every batch since; no new drift found.
- **States** — loading (M5-019), empty (M5-020), and error (M5-021)
  states were each already built and tested (Batches 9–10); re-verified
  against Page 3's own smaller `EMPTY DASHBOARD`/`ERROR HANDLING` rules
  individually (see Conflict #30) rather than assumed satisfied by
  those earlier batches alone.
- **Responsive behavior** — M5-023 (Batch 12) already satisfies this;
  Page 10's own "MOBILE EXPERIENCE" note ("Essential Features Only" on
  mobile) conflicts with M5-023's own literal DoD ("All Dashboard
  functionality remains usable on mobile") — resolved in favor of the
  already-built, already-tested `06_TASKS.md` requirement, the same
  precedent this whole audit applies throughout.
- **Accessibility** — M5-024 (Batch 13) already satisfies WCAG AA; this
  batch's own tooltip fix (below) surfaced and fixed one more real gap
  in the same category.

**One real, small, fixable `TOOLTIPS` gap found and fixed**: `03_UI.md`'s
own cross-cutting "Every important metric includes a tooltip" rule
(Page 3) was not satisfied by `DebtAndInterestPanel` (M5-013) or
`LeverageSummarySection` (M5-014) — the only two Dashboard sections
with zero tooltips anywhere, unlike every other section (which either
uses `KpiCard` or, like `HealthFactorStatusSection`, carries a manual
`title`). Added Formula ID tooltips to both, reusing already-documented
IDs rather than inventing new ones — Total Debt (F-003) and Annual
Interest Cost (F-032) are the exact same Service values
`DashboardKpiGrid` already tooltips; Monthly/Daily reuse
`calculateDebtInterestBreakdown`'s own documented F-031/F-030; Gross
Exposure/Effective BTC Exposure (F-002), Net Equity (F-004), and
Leverage Ratio (F-011) are `LeverageSummarySection`'s own values under
a second, differently-worded label for metrics `DashboardKpiGrid`
already tooltips (`buildLeverageSummary.ts`'s own header comment
already documents this aliasing). Current Borrow Rate is left
untooltipped — a raw stored input, not a Formula output, consistent
with "Current market price" in `LiquidationRiskPanel` also carrying no
tooltip.

**Adding those tooltips surfaced a second, real, pre-existing
accessibility gap, found by applying this batch's own `Accessibility`
Verify item to the fix it had just made**: `HealthFactorStatusSection`'s
own "Current Health Factor" tooltip (built in Batch 4, M5-007) had no
`tabIndex`, meaning it was never keyboard-reachable — the exact WCAG
2.1.1 issue Batch 13 (M5-024) fixed for `KpiCard`, never applied here
since this component predates that fix and does not use `KpiCard`.
Fixed by adding `tabIndex={0}` to that div and to every new tooltip
this batch added in `DebtAndInterestPanel`/`LeverageSummarySection`,
so this batch does not ship a new instance of the same gap it is
auditing for.

**Verified the Milestone 5 Acceptance Criteria checklist (`06_TASKS.md`,
end of Milestone 5) directly, all 12 items** — Dashboard uses the
active portfolio ✓; core portfolio metrics are displayed ✓; Health
Factor is explained clearly ✓; liquidation risk is visible and
actionable ✓; debt and interest costs are displayed ✓; portfolio
composition is understandable ✓; recommendations are transparent ✓;
manual and stale data are clearly identified ✓; Dashboard supports
loading, empty, and error states ✓; responsive behavior is complete ✓;
accessibility requirements are satisfied ✓; Dashboard tests pass ✓
(1083/1083 unit+integration, 35/35 e2e). Every item traces to a
specific, already-synchronized batch.

**Scope discipline**: `git diff --stat -- engine/ services/ types/
stores/` empty. Exactly 3 component files touched
(`DebtAndInterestPanel.tsx`, `LeverageSummarySection.tsx`,
`HealthFactorStatusSection.tsx`) plus their 3 test files — every change
is a presentational `title`/`tabIndex` addition, zero new business
logic, zero new data flow.

**Validation — Batch 18**

| Command                      | Result                                                                                                                                          |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`             | ✅ Pass                                                                                                                                         |
| `pnpm lint`                  | ✅ Pass                                                                                                                                         |
| `pnpm format:check`          | ✅ Pass                                                                                                                                         |
| `pnpm test` (Vitest)         | ✅ Pass, 1083/1083 (5 net new)                                                                                                                  |
| `pnpm test:coverage`         | ✅ 95.58% statements / 89.41% branches / 100% functions / 98.84% lines (project-wide) — unchanged from Batch 17.                                |
| `pnpm build`                 | ✅ Pass — `/` grew from 8.45 kB to 8.49 kB (new tooltip attributes only)                                                                        |
| `pnpm test:e2e` (Playwright) | ✅ Pass, 35/35 (unchanged — including all 5 WCAG AA scans and both keyboard/focus checks, confirming the new tooltips introduced no regression) |

**Architecture audit**: `git diff --stat -- engine/ services/ types/
stores/` empty; `git status --porcelain` shows exactly 6 modified files
(3 components, 3 tests) and no new or deleted files.

**Traceability**: M5-028's Description ("Perform a final implementation
audit against `03_UI.md`") and all 7 `Verify` items are each addressed
individually above; its DoD ("No undocumented UI deviations remain
without explicit approval") is satisfied — every deviation found is
either fixed (the `TOOLTIPS` gap and its accessibility follow-on) or
explicitly documented as Conflict #30, awaiting a product decision, not
silently left unrecorded. **This closes Milestone 5's own task list**:
M5-001 through M5-028 are now all addressed (M5-008 remains the one
formally, permanently blocked task, per Conflict #1).

---

## Milestone 6 progress

Milestone 5 was confirmed synchronized to GitHub, and a permanent
`MILESTONE_5_COMPLETION.md` snapshot was committed before this
milestone began — the same Batch-0-style documentation review used at
the start of Milestones 4 and 5 (re-reading `06_TASKS.md`'s own
Milestone 6 section fresh, `03_UI.md`'s own Page 5 ("Simulation
Workspace"), and the relevant `01_PRD.md` REQ-004 chapter, before any
code in this section) preceded any implementation.

**Read ahead of implementation**: `06_TASKS.md`'s own Milestone 6
header (`MILESTONE OBJECTIVE`, `DELIVERABLES`, `IMPLEMENTATION ORDER`)
and all 26 tasks (M6-001–M6-026); `03_UI.md` Page 5 ("Simulation
Workspace") in full; `01_PRD.md`'s REQ-004 "Simulation Engine
Specification" chapter (REQ-004-A through REQ-004-E) in full. **Found
that the Simulation Engine and Service layer this milestone's UI will
consume already exist**, built in Milestones 2–3:
`engine/simulation/` (`simulatePriceScenario`, `simulateInterestScenario`,
`simulatePositionChange`, `compareScenarios`, `rankScenarios`,
`calculateDebtGrowth`, `calculatePortfolioGain`, `resolveScenarioPrice`
— M2-019–M2-022) and `services/simulation/scenario.ts`
(`simulateScenario`, M3-009 — "Coordinate scenario creation and
comparison," DoD: "Simulation features require no direct Formula Engine
orchestration"). Milestone 6's own tasks build the Workspace UI and
Store that call these already-real functions; they do not build a
second calculation path. This is the single most important fact this
milestone's implementation depends on, cited here so every later batch
can rely on it without re-deriving it.

### Batch 1 — Simulation Foundation (M6-001, M6-002)

First Milestone 6 task batch, following `06_TASKS.md`'s own
`IMPLEMENTATION ORDER` ("Simulation Foundation" is the first of 7
steps) and its own per-task `Dependencies` chain (M6-001 depends on
M5-028, now satisfied; M6-002 depends on M6-001). Scoped to these two
small (`S` effort), tightly-coupled scaffolding tasks only — mirroring
Milestone 5's own Batch 1 precedent (`M5-001, M5-002`, foundation
before any Store or calculation-driven content) — leaving M6-003
("Implement Simulation Store," `L` effort, a substantial 6-piece
Zustand store) as its own, later batch rather than bundling a
significantly larger unit of work into the first one.

**M6-001 — `app/simulation/page.tsx`** replaces the Milestone 1
`PlaceholderPage` scaffold with this task's own named regions. Its
"Include" list names 6 items: Workspace layout, Simulation sidebar,
Scenario editor, Results area, Comparison area, Responsive layout.
**"Simulation sidebar" and "Scenario editor" are read as the same
region** (a persistent controls panel, positioned as a sidebar on wide
screens), not two separate ones — `03_UI.md`'s own Page 5 "PAGE LAYOUT"
names a single "Scenario Controls" section with no separate "sidebar"
region anywhere in its five-section layout, and its own "DESIGN RULES"
("Inputs remain grouped together") supports one consolidated controls
region rather than inventing a second, undocumented one. Built as three
regions: `<aside aria-label="Scenario Controls">` (`lg:w-80`, sidebar
on wide screens, stacks above the main column below `lg:`), "Simulation
Results," and "Portfolio Comparison." **Structure only, no business
logic** — the same "no business logic" baseline the Milestone 1
`PlaceholderPage` this route replaces already documented for this exact
route, now narrowed to real, named regions instead of one generic
placeholder paragraph; no Store or calculation exists yet
(M6-003/M6-004, later tasks), so this file imports nothing from
`@/features/simulation` or `@/stores`.

**DoD ("Users can access the Simulation Workspace from the Dashboard")
was already structurally satisfied** by `AppSidebar`'s own existing
"Simulation" link (M1-006), which already navigates to `/simulation`
from every route including the Dashboard — confirmed unchanged via
`tests/e2e/dashboardWorkflows.spec.ts`'s own "Navigate to Simulation
Workspace" test (M5-027, Batch 17), which still passes against this
new page. This task's own work was making the _destination_ a real
Workspace layout rather than a bare placeholder, not building new
navigation.

**Scoping decision, not a conflict: `QuickActionsSection`'s own "Run
simulation" link (`features/dashboard`, M5-016) is deliberately left
`aria-disabled` by this batch.** The route now renders three
structural, still-empty regions with no genuine simulation capability —
re-enabling a Dashboard-level shortcut to it today would be premature.
Deferred to whichever later Milestone 6 batch first gives this route
real functionality (M6-004/M6-005, the Scenario Builder and Price
Simulation), not this purely structural task.

**M6-002 — `features/simulation/`** created with `components/`,
`hooks/`, `services/`, `types/`, `utils/` (each holding only a
`.gitkeep` for now) and `index.ts` as the sole public entry point — the
same structure and "public entry point" convention
`features/dashboard/index.ts` (M5-002) already established. **Deviates
deliberately from M6-002's own literal directory-tree text**, which
also names `state/` and `tests/` subdirectories: `features/dashboard/`'s
own real, already-shipped structure (Milestone 5, Batches 1–18) never
used either. Every Store in this codebase lives in the project's one
top-level `stores/` directory (`stores/portfolioStore.ts`,
`stores/developerModeStore.ts` — both established by M1-003's own
top-level directory list, a sibling of `features/`, not nested inside
it), and every test file across Milestones 2–5 lives in the project's
one top-level `tests/` directory, never inside a feature-local `tests/`
folder. Following M6-002's own literal tree would split state
management and testing across two different, inconsistent conventions
for no documented reason. The Simulation Store (M6-003) will live in
`stores/simulationStore.ts`; Simulation tests will live under
`tests/unit/features/simulation/`, `tests/integration/simulation/`,
and `tests/e2e/` — see `features/simulation/index.ts`'s own header
comment for the full reasoning, reproduced there so it travels with the
code, not only this write-up.

**Manual browser verification**: started the production server,
navigated to `/simulation` at desktop (1280×900) and mobile (375×812)
viewports, screenshotted both. Desktop: Scenario Controls renders as a
left-hand sidebar (`lg:w-80`) beside a right-hand column stacking
Simulation Results above Portfolio Comparison. Mobile: all three
regions stack vertically, full width, no horizontal overflow
(`document.documentElement.scrollWidth === clientWidth`, both 375px).
No console errors in either capture.

**Zero Engine/Service/Store code changed** — `git diff --stat -- engine/
services/ types/ stores/` empty. Only `app/simulation/page.tsx`
modified; `features/simulation/` and its test directory are new.

**Validation — Batch 1**

| Command                      | Result                                                                                                                                  |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`             | ✅ Pass                                                                                                                                 |
| `pnpm lint`                  | ✅ Pass                                                                                                                                 |
| `pnpm format:check`          | ✅ Pass                                                                                                                                 |
| `pnpm test` (Vitest)         | ✅ Pass, 1087/1087 (4 net new)                                                                                                          |
| `pnpm test:coverage`         | ✅ 95.58% statements / 89.41% branches / 100% functions / 98.84% lines (project-wide) — unchanged from Milestone 5's own final numbers. |
| `pnpm build`                 | ✅ Pass — `/simulation` remains a static route (no client-side JS added; no interactivity yet)                                          |
| `pnpm test:e2e` (Playwright) | ✅ Pass, 35/35 (unchanged — including the existing "Navigate to Simulation Workspace" test, confirming no regression)                   |

**Architecture audit**: `git diff --stat -- engine/ services/ types/
stores/` empty; `git status --porcelain` shows one modified file
(`app/simulation/page.tsx`) and two new, untracked directories
(`features/simulation/`, `tests/unit/app/simulation/`).

**Traceability**: M6-001's Description and all 6 `Include` items, and
M6-002's Description and its own directory structure (with the
documented `state/`/`tests/` deviation), are each addressed
individually above; both DoDs ("Users can access the Simulation
Workspace from the Dashboard"; "Simulation code remains isolated from
unrelated features") are satisfied.

---

### Batch 2 — Simulation Store (M6-003)

**Dependencies satisfied**: M6-002 is synchronized to GitHub as of
Batch 1. Scoped to this one task alone — `L` effort, a substantial
6-piece Zustand store — rather than bundling it with a later task,
mirroring the same "give substantial state-management work its own
batch" discipline `portfolioStore.ts`'s own Milestone 4 batches and
`developerModeStore.ts`'s own Milestone 5 batch (14) already
established.

**`stores/simulationStore.ts` — all 6 named `Store` fields built**:
`currentScenario`, `currentResult`, `savedScenarios`,
`comparisonSelection`, `status`, `errors`, plus `previewMode`. Mirrors
`stores/portfolioStore.ts`'s own established conventions exactly: a
`SOURCE_STATUS = 'manual'` internal constant, `status`/`errors` fields
driven by a real (if synchronously-resolved, never React-paintable)
state transition — the same honest-partial-reality precedent
`MILESTONE_4_COMPLETION.md`'s own "Lessons Learned" already
established for `portfolioStore`'s own `saveStatus`.

**Reuses `simulateScenario` (M3-009, `services/simulation/scenario.ts`)
directly — no new calculation anywhere.** `runSimulation(portfolio)`
calls it exactly as already published, storing the real
`ServiceResult<SimulationResult>` outcome; `git diff --stat -- engine/
services/ types/` is empty, confirming no Engine or Service code
changed to support this Store.

**DoD ("Simulation state is completely independent from portfolio
state") verified two ways, not just asserted**: structurally (this file
never imports `stores/portfolioStore.ts`, and `runSimulation` accepts
an already-resolved `ApplicationPortfolio` value at call time, never a
Store reference — matching `01_PRD.md` REQ-004's own "SIMULATION
WORKFLOW," "Clone Portfolio" as a plain value snapshot, not a live
binding) and with an executable test that creates/mutates a real
`Portfolio` in `usePortfolioStore` alongside an active
`useSimulationStore` result and confirms neither Store's state leaks
into the other in either direction.

**Scoping decision, not a conflict: `SavedSimulation` deliberately
carries only `id`/`scenario`/`result`/`createdAt`, not
`name`/`description`/a portfolio reference.** Those three fields are
M6-015's ("Save Simulation") own explicit "Include" list — a separate,
later, `P1` task whose own Dependencies name only M6-003. Building its
full field shape here would be inventing that task's own scope, the
same discipline `services/portfolio/models.ts`'s own header comment
already established for `ApplicationPortfolio` vs. M4-001
(`ApplicationPortfolio` was kept deliberately minimal; M4-001 extended
it later). `saveCurrentScenario()` returns the new record's `id`;
M6-015's own later UI is what will let a user attach a name.

**Not re-exported through `stores/index.ts` or `features/simulation/index.ts`** —
found and followed the _actual_, currently-used convention rather than
the older one: `stores/index.ts` only re-exports `portfolioStore`
(its original M4-003 occupant); `developerModeStore.ts` (M5-022, more
recent) is imported directly via its own subpath
(`@/stores/developerModeStore`) everywhere it's used, bypassing both
barrels entirely. `simulationStore.ts` follows that same, more recent,
actually-followed pattern.

**Zero UI wiring this batch** — `git diff --stat -- app/ features/` is
empty. `app/simulation/page.tsx` (M6-001) does not yet import this
Store; that wiring is M6-004's ("Scenario Builder") own job, the next
task in this milestone's `IMPLEMENTATION ORDER`.

**Validation — Batch 2**

| Command                      | Result                                                                                                                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`             | ✅ Pass                                                                                                                                                                         |
| `pnpm lint`                  | ✅ Pass                                                                                                                                                                         |
| `pnpm format:check`          | ✅ Pass                                                                                                                                                                         |
| `pnpm test` (Vitest)         | ✅ Pass, 1100/1100 (13 net new)                                                                                                                                                 |
| `pnpm test:coverage`         | ✅ 95.65% statements / 89.51% branches / 100% functions / 98.86% lines (project-wide) — up slightly from Batch 1 (`stores/` coverage itself rose to 97.63%/95.16%/100%/97.34%). |
| `pnpm build`                 | ✅ Pass — `/simulation` unchanged (0 B added; the Store is not yet imported by any client component)                                                                            |
| `pnpm test:e2e` (Playwright) | ✅ Pass, 35/35 (unchanged — no UI touched this batch)                                                                                                                           |

**Architecture audit**: `git diff --stat -- engine/ services/ types/
app/ features/` empty; `git status --porcelain` shows exactly two new,
untracked files (`stores/simulationStore.ts`,
`tests/unit/stores/simulationStore.test.ts`) and no modified files at
all.

**Traceability**: M6-003's Description and all 6 named `Store` fields
are each addressed individually above; its DoD ("Simulation state is
completely independent from portfolio state") is verified both
structurally and by a dedicated executable test, not asserted without
evidence.

---

### Batch 3 — Scenario Builder (M6-004)

**Dependencies satisfied**: M6-003 (Simulation Store) is synchronized
to GitHub as of Batch 2; M3-009 (`simulateScenario`) has existed since
Milestone 3.

**Scoping decision, not a conflict: "Collateral"/"Debt" are each one
signed delta field, not four separate add/withdraw/borrow/repay
fields.** `03_UI.md` Page 5 and `01_PRD.md` REQ-004 both describe these
directionally (Additional Borrow / Debt Repayment, Increase / Decrease
Collateral) — four fields — but M6-004's own literal "Users can modify"
list names only six items total ("Collateral," "Debt" as two of them).
A signed delta (positive = add/borrow, negative = withdraw/repay)
captures both directions of each while keeping this task's own literal
6-field count intact, documented in
`features/simulation/types/scenarioBuilder.ts`'s own header comment.

**Scoping decision, not a conflict: only BTC Price is wired to a real
calculation this batch; the other five fields are real, validated,
controlled inputs with no calculation trigger yet.** M6-004's own
`Dependencies` name only M3-009 (`simulateScenario`, price/interest
scenarios) — Borrow rate, Collateral delta, and Debt delta each belong
to their own later, dedicated tasks (M6-006 "Implement Interest Rate
Simulation," M6-008 "Implement Portfolio Action Simulation") whose own
DoDs are specifically about wiring their own Service outputs; Time
horizon belongs to M6-007 ("Implement Time Projection"). **Target
Health Factor has no later task naming it as an input anywhere** —
found while cross-referencing all 26 Milestone 6 tasks, a genuine
specification gap, documented rather than either invented a calculation
for it or silently dropping the field. M6-004's own DoD is narrower
than "every input calculates" — it is literally "Scenario inputs are
validated before calculation," satisfied by real validation on all six
fields regardless of which are Service-wired yet.

**Controlled inputs with live, per-keystroke validation — not
`react-hook-form`'s Preview/Apply submit cycle `app/portfolio/page.tsx`'s
own forms use.** `03_UI.md` Page 5's own "DESIGN PHILOSOPHY" is
explicit and is the opposite of a submit-gated pattern: "Every input
updates the simulation immediately. No 'Calculate' button. No 'Run
Simulation' button." Reusing the Portfolio forms' own submit-oriented
machinery would have directly contradicted this task's own governing
design principle, so this batch built a small, pure, Store-independent
validator (`validateScenarioBuilderInput`) instead — a deliberate,
documented departure from the otherwise-consistent Portfolio-forms
convention, not an inconsistency.

**`features/simulation/index.ts` now re-exports real content** —
`ScenarioBuilder`, the `scenarioBuilder` types, and
`validateScenarioBuilderInput`/`hasScenarioBuilderErrors` — and
`app/simulation/page.tsx` now imports from that barrel
(`@/features/simulation`), not a direct component subpath, matching
`app/page.tsx`'s own established convention for `@/features/dashboard`
(a genuine fix: the first draft of this batch imported directly from
`@/features/simulation/components/ScenarioBuilder`, contradicting the
barrel's own stated purpose, caught before commit).
`components/`/`types/`/`utils/` no longer hold `.gitkeep` placeholders,
now that each has real content; `hooks/`/`services/` still do.

**`app/simulation/page.tsx` gates the Scenario Builder on an active
portfolio**, reusing the exact "no active portfolio" pattern
`app/page.tsx` (Dashboard) already established — a scenario is
meaningless without a real portfolio to validate deltas against or
simulate a price change from.

**Results area and Portfolio Comparison remain the M6-001 placeholder
this batch.** `runSimulation` is wired and does populate
`currentResult` for a valid BTC Price change (verified directly via the
Store in tests), but rendering it is M6-009's ("Implement Scenario
Summary") own later, dedicated task — not built here to avoid
pre-empting that task's own scope.

**Manual browser verification**: created a real portfolio, navigated to
the Simulation Workspace, confirmed all six fields render pre-filled
with the portfolio's own current values (screenshot). Entered an
invalid BTC price (`-5`) and confirmed the inline validation message
("BTC price must be a positive number.") renders correctly, matching
`03_UI.md`'s own "AUTO VALIDATION" example exactly (screenshot). No
console errors in either capture.

**Zero Engine/Service/Store/type code changed** — `git diff --stat --
engine/ services/ types/ stores/` empty. Only `app/simulation/page.tsx`
and `features/simulation/` (new component, types, utils, and the
barrel) changed.

**Validation — Batch 3**

| Command                      | Result                                                                                                                                                                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`             | ✅ Pass                                                                                                                                                                                                                               |
| `pnpm lint`                  | ✅ Pass                                                                                                                                                                                                                               |
| `pnpm format:check`          | ✅ Pass                                                                                                                                                                                                                               |
| `pnpm test` (Vitest)         | ✅ Pass, 1121/1121 (21 net new)                                                                                                                                                                                                       |
| `pnpm test:coverage`         | ✅ 95.74% statements / 89.88% branches / 100% functions / 98.88% lines (project-wide) — up from Batch 2 (a coverage gap found during validation — 3 "non-numeric input" branches — was closed with 3 additional tests before commit). |
| `pnpm build`                 | ✅ Pass — `/simulation` grew from 0 B to 2.41 kB (its first real client-side JS)                                                                                                                                                      |
| `pnpm test:e2e` (Playwright) | ✅ Pass, 35/35 (unchanged — including "Navigate to Simulation Workspace," confirming "Run simulation" is still correctly `aria-disabled`)                                                                                             |

**Architecture audit**: `git diff --stat -- engine/ services/ types/
stores/` empty; `git status --porcelain` shows one modified file
(`app/simulation/page.tsx`), `.gitkeep` removals in three now-populated
`features/simulation/` subdirectories, one modified barrel
(`features/simulation/index.ts`), three new source files, one modified
test file, and one new test directory.

**Traceability**: M6-004's Description and all 6 named "Users can
modify" fields are each addressed individually above (one wired to a
real calculation, five real and validated with their own wiring
correctly deferred to later, dedicated tasks); its DoD ("Scenario
inputs are validated before calculation") is satisfied and verified
both by 21 new automated tests and direct manual browser confirmation.

---

### Batch 4 — Price Scenario Simulation (M6-005)

**Dependencies satisfied**: M6-004 (Scenario Builder) is synchronized
to GitHub as of Batch 3.

**All 4 named `Support` items mapped one at a time, not assumed already
complete**: "Manual price" was already wired in Batch 3 (the BTC Price
input); this batch added "Percentage change" (a new, independent
Percentage Change input, same live-validate-and-simulate wiring as BTC
Price) and "Preset scenarios" (8 quick buttons); "Custom scenarios" is
not a fourth mechanism — `03_UI.md` Page 5's own wording ("Users may
also define custom scenarios") describes the two free-form inputs
themselves, as opposed to the fixed presets, confirmed by re-reading
the surrounding text rather than assumed.

**Scoping decision, not a conflict: 8 presets, not `03_UI.md` Page 5's
own 7.** That page's own "PRESET SCENARIOS" mockup lists "+10%, +25%,
+50%, +100%, -10%, -20%, -30%, Reset" (7, plus Reset); `01_PRD.md`'s
REQ-004-A ("BTC PRICE SIMULATION") own "Required Presets" list is
fuller: the same 7 plus `-50%`, plus "Custom Price." Resolved in favor
of the PRD's own list — explicitly labeled "Required," a stronger claim
than a page mockup's own example row — rather than silently dropping
the one preset the two documents disagree on. "Reset" is not duplicated
as its own preset button — the existing "Reset Scenario" button
(M6-004, Batch 3) already does exactly this.

**No Engine access from the UI layer — a real constraint actively
checked, not assumed.** `04_BUILD_GUIDE.md`'s own "DEPENDENCY RULES":
"Only services communicate directly with the Formula Engine" (found by
searching for this exact sentence before designing the preset buttons,
since displaying a resolved dollar price next to each percentage preset
was the first design considered). `resolveScenarioPrice` (F-051) is
publicly exported from `@/engine` but never imported into
`ScenarioBuilder.tsx` — a percentage-change scenario is sent to
`simulateScenario` (via the Store) exactly as entered, with no
client-side re-derivation of F-051's own formula. The resolved price
becomes visible once M6-009 ("Implement Scenario Summary") renders
`currentResult` — not built here, avoiding both a forbidden dependency
and a duplicated calculation.

**Manual browser verification**: created a real portfolio, navigated to
the Simulation Workspace, confirmed all 8 preset buttons render
(screenshot). Clicked "+25%" and confirmed the Percentage Change field
updates to `0.25` and a real simulation runs (checked via the Store's
own `currentResult`, matching the unit tests' own assertions). No
console errors.

**Zero Engine/Service/Store/type code changed** — `git diff --stat --
engine/ services/ types/ stores/` empty. Only
`features/simulation/components/ScenarioBuilder.tsx`,
`features/simulation/types/scenarioBuilder.ts`, and
`features/simulation/utils/validateScenarioBuilderInput.ts` changed,
plus their test files.

**Validation — Batch 4**

| Command                      | Result                                                                                                            |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`             | ✅ Pass                                                                                                           |
| `pnpm lint`                  | ✅ Pass                                                                                                           |
| `pnpm format:check`          | ✅ Pass                                                                                                           |
| `pnpm test` (Vitest)         | ✅ Pass, 1128/1128 (7 net new)                                                                                    |
| `pnpm test:coverage`         | ✅ 95.75% statements / 89.94% branches / 100% functions / 98.88% lines (project-wide) — up slightly from Batch 3. |
| `pnpm build`                 | ✅ Pass — `/simulation` grew from 2.41 kB to 2.68 kB                                                              |
| `pnpm test:e2e` (Playwright) | ✅ Pass, 35/35 (unchanged)                                                                                        |

**Architecture audit**: `git diff --stat -- engine/ services/ types/
stores/` empty; `git status --porcelain` shows exactly 5 modified
files (3 source, 2 tests) and no new or deleted files.

**Traceability**: M6-005's Description ("Allow simulation of BTC price
changes") and all 4 named `Support` items are each addressed
individually above; its DoD ("Portfolio values update using Simulation
Service outputs") is satisfied and verified both by 7 new automated
tests and direct manual browser confirmation.

---

### Batch 5 — Portfolio Action Simulation (M6-008)

**Dependencies satisfied**: M6-004 (Scenario Builder) is synchronized
to GitHub as of Batch 3; its own "Collateral Change (BTC)"/"Debt Change
(USD)" fields were built but deliberately left unwired specifically for
this task (documented in `ScenarioBuilder.tsx`'s own Batch 3 header
comment).

**New Service function, not an extension of the locked
`PortfolioAction` type.** `services/portfolio/actionPreview.ts`'s own
`previewPortfolioAction` (M3-006) is explicitly limited to exactly six
named variants "with no interface of its own... No extensibility
fields or inferred behavior beyond the six named actions, per
instruction" — extending it with a seventh "combined" variant would
violate that already-approved constraint. Instead, a small, new,
Simulation-only function, `simulatePortfolioAction`
(`services/simulation/portfolioAction.ts`), was added: it reuses
`calculatePortfolioSummary` (M3-005) directly, the same
"snapshot/apply/snapshot" pattern `previewPortfolioAction` already
established, and returns the already-exported `PortfolioActionPreview`
(`{ before, after }`) shape rather than inventing a new one. No new
calculation was written — every number comes from an already-public
Service function.

**One function satisfies all 5 named `Actions`.** "Add collateral,"
"Withdraw collateral," "Borrow," "Repay," and "Combined actions" are
not five code paths — `PortfolioActionSimulationInput`'s
`collateralDelta`/`debtDelta` are each a single signed delta (positive
= add/borrow, negative = withdraw/repay), matching the signed-delta
design `ScenarioBuilder.tsx`'s own fields already used since Batch 3;
"Combined actions" is simply both non-zero at once, requiring no
separate "action type" input or branch.

**Store wiring**: `stores/simulationStore.ts` gained a second,
independent result field, `portfolioActionPreview`, alongside
`currentResult` — kept separate because `PortfolioActionPreview` (`{
before, after }` `PortfolioSummary` objects) is structurally different
from `SimulationResult` (`{ baseline, scenario, comparison,
assumptions }`, from price/interest scenarios); forcing one into the
other's shape would have been a fabricated fit. The new
`runPortfolioActionSimulation` action shares `status`/`errors` with the
existing `runSimulation` action — both represent "a calculation is in
flight or failed," regardless of which kind ran.

**UI wiring**: `ScenarioBuilder.tsx`'s "Collateral Change (BTC)" and
"Debt Change (USD)" fields now call `runPortfolioActionSimulation` on
every valid change, always sending both current delta values together
(not just the field that changed) — a single Service call per change,
consistent with "Combined actions" needing no separate mechanism. Both
fields already had real, live validation from Batch 3
(over-withdrawal/over-repayment/LTV-limit checks); invalid values still
block the Store call exactly as before, unchanged this batch.

**Real, pre-existing e2e test bug found and fixed during this batch's
mandatory `pnpm test:e2e` run — not part of M6-008's own scope, but
blocking the required validation pipeline.**
`tests/e2e/dashboardWorkflows.spec.ts`'s "Navigate to Simulation
Workspace" test (M5-027, written in Milestone 5 before
`/simulation` had any real content) asserts
`page.getByRole('heading', { name: 'Simulation' })` without `exact:
true`. Milestone 6 Batch 1's `app/simulation/page.tsx` rewrite added a
second heading, "Simulation Results" (the `WorkspaceSection`
placeholder), whose accessible name also contains the substring
"Simulation" — Playwright's default non-exact name matching resolves
both, a strict-mode violation. The failure is timing-dependent (a
`git status --porcelain`-clean rerun with `--workers=1` passed 35/35
every time; the default parallel-worker run reproduced the violation
deterministically once discovered) which is why it slipped through
Batches 1, 3, and 4's own "35/35 unchanged" results — those runs
happened to resolve the assertion before both headings were
simultaneously visible under lighter load. Fixed with a one-line,
test-only change: `{ name: 'Simulation', exact: true }`. Confirmed
fixed with two consecutive full default-parallel-worker
`pnpm test:e2e` runs, both 35/35, after the fix (33/34/35 flakiness
patterns before the fix, including two runs this batch that separately
also showed `page.waitForURL('**/portfolio')` timeouts in unrelated
Portfolio-workflow tests — traced to this sandbox's own resource
contention under full parallelism, not a code regression, and not
reproduced at all under `--workers=1` or in either of the two clean
default-parallel confirmation runs after the fix).

**Manual browser verification**: created a real portfolio, navigated
to the Simulation Workspace, entered `1` in "Collateral Change (BTC)"
then `10000` in "Debt Change (USD)" and confirmed
`portfolioActionPreview` populated with the expected combined-action
numbers (3 BTC × $50,000 = $150,000 collateral; $30,000 debt) via a
Store-state check (screenshot). Entered `-5` in "Collateral Change
(BTC)" and confirmed the existing inline validation error
("Withdrawal cannot exceed current collateral.") still correctly
blocks the Store call (screenshot). No console errors in either
capture.

**Coverage gap found and closed before commit**: the new
`simulatePortfolioAction`'s own "before" (unmodified-portfolio)
failure branch had no test — every existing test applied a delta to an
already-valid starting portfolio. Closed with one additional test
(an already-invalid starting portfolio, zero collateral) asserting a
clean failure with no delta applied. `services/simulation/`
(new+existing files) reached 100% branch coverage as a direct result.

**Only `services/` (not `engine/` or `types/`) changed this batch — the
expected exception, not a deviation.** Unlike Batches 1, 3, and 4 (all
UI/Store-only, zero Service diff), M6-008 genuinely needed a small new
Service capability; `git diff --stat -- engine/ services/ types/`
shows only `services/simulation/index.ts`'s export list changed
(`services/simulation/portfolioAction.ts` itself is new, so it does not
appear in a diff of already-tracked files). No Engine code changed —
`simulatePortfolioAction` composes only already-public Service
functions.

**Validation — Batch 5**

| Command                      | Result                                                                                                                                                                 |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`             | ✅ Pass                                                                                                                                                                |
| `pnpm lint`                  | ✅ Pass                                                                                                                                                                |
| `pnpm format:check`          | ✅ Pass                                                                                                                                                                |
| `pnpm test` (Vitest)         | ✅ Pass, 1144/1144 (16 net new)                                                                                                                                        |
| `pnpm test:coverage`         | ✅ 95.78% statements / 89.99% branches / 100% functions / 98.89% lines (project-wide) — up from Batch 4; `services/simulation/` at 100% branches.                      |
| `pnpm build`                 | ✅ Pass — `/simulation` at 2.8 kB                                                                                                                                      |
| `pnpm test:e2e` (Playwright) | ✅ Pass, 35/35 — 1 real pre-existing test bug found and fixed this batch (see above); confirmed stable across two consecutive full parallel-worker runs after the fix. |

**Architecture audit**: `git diff --stat -- engine/ services/ types/`
shows only `services/simulation/index.ts` (export list); `git diff
--stat -- stores/` shows only `stores/simulationStore.ts` (new field +
action, additive only). `git status --porcelain` shows 6 modified
files (3 source, 1 e2e test, 2 unit test) and 2 new files (1 source, 1
unit test), no deletions.

**Traceability**: M6-008's Description ("Simulate portfolio actions.")
and all 5 named `Actions` are each addressed individually above (one
function, two signed deltas, no separate code path per action); its
DoD ("Users can evaluate actions before applying them.") is satisfied
by the before/after `PortfolioActionPreview` — a real preview, nothing
applied to the actual portfolio — and verified both by 16 new automated
tests and direct manual browser confirmation.

---

### Batch 6 — Interest Rate Simulation (M6-006)

**Repository re-sync required before this batch began.** `git ls-remote
origin main` showed the designated branch
`claude/profitpilot-repo-review-nty3yy` no longer exists on the remote
(deleted after Batch 5's own PR merged) and `origin/main`'s own tip
(`a2f928b`) carries Batch 5's exact content, re-authored — confirmed via
`git diff 513469f a2f928b --stat` (empty). Per the established "already
merged" recovery procedure, the local branch was restarted from
`origin/main` (`git checkout -B claude/profitpilot-repo-review-nty3yy
origin/main`) before any new work began.

**Dependencies satisfied**: M6-004 (Scenario Builder) is synchronized
to GitHub as of Batch 3; its own "Borrow Rate (0–1)" field was built and
validated then, but deliberately left unwired (documented in
`ScenarioBuilder.tsx`'s own Batch 3/6 header comments) pending this
task.

**No new UI for "Rate increase," "Rate decrease," or "Custom rate."**
Unlike M6-005's own Include list, M6-006's names no preset buttons —
the single, already-built, free-form Borrow Rate field satisfies all
three by construction (any value above, below, or unrelated to the
portfolio's own current rate).

**Structural dependency not named in M6-006's own `Dependencies`
field, resolved by reusing an already-built field, not by inventing
new UI or new scope.** `simulateInterestScenario` (M2-020) requires a
`priceScenario` and `timeHorizonDays` alongside `borrowApr` — the
Service's `SimulationScenario`'s own `interest` variant has no
"rate-only" shape. `timeHorizonDays` is supplied by the Holding Period
field (`holdingPeriod`/`customHoldingPeriodDays`), already built and
validated as one of M6-004's own six fields in Batch 3, and whose
values (`30`/`90`/`180`/`365`/custom) already match M6-007's own later
"Support" list verbatim — reading its current value here is not
M6-007's own scope (Time Projection's own DoD is about _displaying_
projections across multiple horizons, a separate, later, dedicated
task). `priceScenario` reuses whichever of BTC Price/Percentage Change
is currently active, the same precedence `ScenarioBuilder.tsx`'s own
handlers already use. New pure helpers
(`features/simulation/utils/resolveScenarioInputs.ts`,
`resolvePriceScenarioInput`/`resolveTimeHorizonDays`) do this reading;
no Engine access, no new calculation.

**`PriceScenarioInput` re-exported from `services/simulation/index.ts`**
— the only Service-layer change this batch. It is an Engine type
(`engine/simulation/resolveScenarioPrice.ts`), needed by the new
resolver helpers; re-exporting it through the Service barrel (which
already imports it internally in `scenario.ts`) keeps
`04_BUILD_GUIDE.md`'s own "Only services communicate directly with the
Formula Engine" rule intact — `features/simulation/` still never
imports `@/engine` directly.

**Documented conflict, not silently resolved: M6-006's own DoD
("Users understand the cost implications of changing rates") reads as
requiring a visible display, but this batch does not render one.**
Unlike M6-005's own DoD ("Portfolio values update using Simulation
Service outputs" — a Service/state-level claim, satisfied by
`currentResult` updating), M6-006's phrasing centers on user
understanding, which more naturally implies something on screen.
Rendering it here anyway was rejected: `M6-009` ("Implement Scenario
Summary") is the one dedicated task for displaying `currentResult`
across every scenario type, and building a second, ad hoc display for
interest scenarios alone would fragment that single future UI and
duplicate work. Complicating this further, `M6-009`'s own
`Dependencies` name only `M6-005` and `M6-008` — not `M6-006` — a
genuine inconsistency in the task graph itself (Batch 5's own
`portfolioActionPreview` field proves `M6-009` was always expected to
eventually cover more than just price scenarios, so this reads as an
omission, not a deliberate exclusion). Flagged for correction when
M6-009 is reached: `Simulation Results` should render interest-scenario
`debtCost` too, regardless of the formal dependency list. In the
meantime, the calculation itself is real and verified — via 11 new
automated tests and a direct Store-state manual browser check — even
though nothing new appears on screen yet, matching M6-005/M6-008's own
established "wire now, display in M6-009" precedent for every other
scenario field so far.

**Documented conflict, not built: "Supply APR" (`01_PRD.md`
REQ-004-E's own "Inputs" list) has no home in the actual Service/Engine
layer.** `simulateInterestScenario`'s own `InterestScenarioParams` has
no `supplyApr` field at all — only `priceScenario`, `timeHorizonDays`,
`borrowApr` — and `06_TASKS.md`'s own M6-006 "Include" list never names
Supply APR either, only the PRD does. Resolved the same way every
other `06_TASKS.md`-vs-`01_PRD.md` gap in this engagement has been:
`06_TASKS.md` is the authoritative build driver. Adding a `supplyApr`
field to the completed Milestone 2 Engine function would be scope creep
on an already-closed milestone for a calculation no current task
requests — not built.

**Manual browser verification**: created a real portfolio, navigated
to the Simulation Workspace, entered `0.1` in "Borrow Rate (0–1)" and
confirmed the field accepts the value with no console errors
(screenshot). Entered `-1` and confirmed the existing inline validation
error ("Borrow rate cannot be negative.") still correctly blocks the
Store call (screenshot).

**Only `services/` (not `engine/`, `types/`, or `stores/`) changed this
batch, and only by one type re-export.** `stores/simulationStore.ts`
needed no changes at all — `runSimulation`/`setCurrentScenario` already
handle any `SimulationScenario` value generically, including the
`interest` variant, since Batch 2. `git diff --stat -- engine/
services/ types/` shows only `services/simulation/index.ts`; `git diff
--stat -- stores/` is empty.

**Validation — Batch 6**

| Command                      | Result                                                                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm typecheck`             | ✅ Pass                                                                                                                        |
| `pnpm lint`                  | ✅ Pass                                                                                                                        |
| `pnpm format:check`          | ✅ Pass                                                                                                                        |
| `pnpm test` (Vitest)         | ✅ Pass, 1155/1155 (11 net new)                                                                                                |
| `pnpm test:coverage`         | ✅ 95.81% statements / 90.10% branches / 100% functions / 98.90% lines (project-wide) — up from Batch 5; new resolver at 100%. |
| `pnpm build`                 | ✅ Pass — `/simulation` grew from 2.8 kB to 2.93 kB                                                                            |
| `pnpm test:e2e` (Playwright) | ✅ Pass, 35/35 (unchanged)                                                                                                     |

**Architecture audit**: `git diff --stat -- engine/ services/ types/
stores/` shows only `services/simulation/index.ts` (10-line type
re-export addition). `git status --porcelain` shows 4 modified files
(3 source, 1 unit test) and 2 new files (1 source, 1 unit test), no
deletions.

**Traceability**: M6-006's Description ("Simulate borrow rate
changes.") and all 4 named `Include` items are each addressed
individually above (three satisfied by the already-built free-form
field, one — "Projected interest cost" — calculated and verified but
not yet displayed, a documented DoD tension rather than a silent gap);
verified by 11 new automated tests and direct manual browser
confirmation.

---

### Batch 7 — Time Projection (M6-007)

**Repository re-sync required before this batch began, again.** `git
ls-remote origin main` showed `claude/profitpilot-repo-review-nty3yy`
no longer exists remotely (deleted after Batch 6's own PR merged) and
`origin/main`'s tip (`c883b05`) carries Batch 6's exact content,
re-authored — confirmed via `git diff 2ecd97f c883b05 --stat` (empty).
Restarted the local branch from `origin/main`, per the same recovery
procedure used before Batch 6.

**Dependencies satisfied**: M6-006 (Interest Rate Simulation) is
synchronized to GitHub as of Batch 6.

**No new fields, no new UI controls.** M6-007's own "Support" list
(30/90/180/365 days, Custom duration) matches the Holding Period
selector and Custom Holding Period Days input verbatim — both already
built, validated, and visible since Batch 3 (M6-004). `03_UI.md` Page
5's own "HOLDING PERIOD" section confirms this reading directly:
"Interest calculations use the selected period" — the same field this
whole milestone has been building toward, not a new one.

**The actual gap this batch closed: Holding Period changes didn't
previously _do_ anything.** Batch 6 read the field's value passively,
only when Borrow Rate changed. M6-007's own Description — "Project
portfolio changes over time" — requires the projection to actually
update when the assumed time span changes, matching `03_UI.md`'s own
"Design Philosophy" ("Every input updates the simulation immediately")
already governing every other field in this form. Fixed by wiring
`holdingPeriod`/`customHoldingPeriodDays` to re-run
`resolveInterestScenario` (extracted from Batch 6's own inlined Borrow
Rate logic in `resolveScenarioInputs.ts`, now shared by both handlers)
whenever an interest scenario is already active
(`currentScenario?.type === 'interest'`).

**Gated on an active interest scenario, not unconditional — a
deliberate scoping decision.** Time horizon has no meaning for a
`type: 'price'` scenario (`SimulationScenario`'s own price variant has
no `timeHorizonDays` field at all), and `03_UI.md`'s own "Interest
calculations use the selected period" describes modifying an _existing_
interest calculation, not spontaneously creating one from a price-only
or empty Store state. Changing Holding Period before Borrow Rate has
ever been touched correctly does nothing — verified by an explicit
test.

**M6-007's own DoD ("Time assumptions are clearly displayed") needed no
new display element — a genuine difference from Batch 6's own DoD
tension, not the same pattern repeated.** The Holding Period `<select>`
and the conditionally shown Custom Holding Period Days input (Batch 3)
are themselves real, visible, always-current controls — the assumed
time span is continuously on screen by construction, satisfying "clearly
displayed" without duplicating anything into a Results panel or
pre-empting M6-009. This is unlike M6-006's own DoD ("Users understand
the cost implications"), which needed a _calculated result value_ no
existing control shows — that gap remains open and deferred to M6-009,
documented in Batch 6's own write-up; this batch found no equivalent
gap.

**Manual browser verification**: created a real portfolio, confirmed
selecting a new Holding Period _before_ touching Borrow Rate does
nothing (no Store change). Then set Borrow Rate to start a real interest
scenario, changed Holding Period to "365 Days" and confirmed the field
updates with no console errors (screenshot), then switched to "Custom"
and entered `45` days, confirming that value takes effect too.

**Zero Engine/Service/Store code changed this batch** —
`git diff --stat -- engine/ services/ types/ stores/` is completely
empty. Every change is confined to `features/simulation/` (the shared
resolver helper and `ScenarioBuilder.tsx`'s own wiring) and its tests —
the smallest-footprint batch in this milestone so far.

**Validation — Batch 7**

| Command                      | Result                                                                                                   |
| ---------------------------- | -------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`             | ✅ Pass                                                                                                  |
| `pnpm lint`                  | ✅ Pass                                                                                                  |
| `pnpm format:check`          | ✅ Pass                                                                                                  |
| `pnpm test` (Vitest)         | ✅ Pass, 1165/1165 (10 net new)                                                                          |
| `pnpm test:coverage`         | ✅ 95.83% statements / 90.15% branches / 100% functions / 98.90% lines (project-wide) — up from Batch 6. |
| `pnpm build`                 | ✅ Pass — `/simulation` grew from 2.93 kB to 2.98 kB                                                     |
| `pnpm test:e2e` (Playwright) | ✅ Pass, 35/35 (unchanged)                                                                               |

**Architecture audit**: `git diff --stat -- engine/ services/ types/
stores/` is empty. `git status --porcelain` shows 4 modified files (2
source, 2 unit test), no new or deleted files.

**Traceability**: M6-007's Description ("Project portfolio changes over
time.") is satisfied by Holding Period/Custom Duration now
live-triggering a real recalculation of an already-active interest
scenario; all 5 named `Support` durations are unchanged from Batch 3's
own already-complete field; its DoD ("Time assumptions are clearly
displayed") is satisfied by the already-visible selector/custom input
themselves, reasoned through explicitly above rather than assumed;
verified by 10 new automated tests and direct manual browser
confirmation.

---

### Batch 8 — Scenario Summary (M6-009)

**Repository re-sync required before this batch began, again.** `git
ls-remote origin main` showed `claude/profitpilot-repo-review-nty3yy`
no longer exists remotely (deleted after Batch 7's own PR merged) and
`origin/main`'s tip (`ec968c6`) carries Batch 7's exact content,
re-authored — confirmed via `git diff 4a9f821 ec968c6 --stat` (empty).
Restarted the local branch from `origin/main`, per the same recovery
procedure used before Batches 6 and 7.

**Dependencies satisfied**: M6-005 (Price Scenario Simulation) and
M6-008 (Portfolio Action Simulation) are both synchronized to GitHub.
M6-009 is the "Implement Scenario Summary" task this whole milestone
has been deferring result-display to since Batch 4 — see this write-up
for how each deferred item actually resolved.

**Field-by-field mapping against real Service types, not assumed.**
Before writing any UI, every one of M6-009's 8 named Display items was
traced against the actual fields `SimulationResult`
(`engine/simulation/compareScenarios.ts`'s `ScenarioSummary`) and
`PortfolioActionSimulationResult` (`PortfolioSummary`,
`services/portfolio/summary.ts`) really expose:

- Portfolio Value, Health Factor, Leverage, Interest Cost — present in
  both.
- Profit/Loss — present in `ScenarioSummary`; **missing from
  `PortfolioActionPreview`**, requiring a Service change (below).
- Debt — **missing from `ScenarioSummary` entirely** (only `debtCost`,
  interest cost, a different concept); present in `PortfolioSummary`
  (`debtValue`).
- Liquidation Price — **`ScenarioSummary` only has `liquidationDistance`**,
  no price field; `PortfolioSummary.liquidation.price` exists.
- Warnings — neither `ScenarioSummary` nor `PortfolioActionPreview`
  itself carries warnings; the Store was silently discarding
  `ServiceResult.warnings` on every successful run (a real, pre-existing
  gap, not a Batch 8 regression — found while tracing this item).

Two genuine, documented gaps for price/interest scenario display
(Debt, Liquidation Price — properly labeled "Liquidation Distance"
instead of mislabeled) rather than either duplicating Formula Engine
logic in the UI to back-derive them, or extending `ScenarioSummary`
itself (a completed Milestone 2 Engine type). Both fields display fully
for portfolio-action results, which use the richer `PortfolioSummary`.

**One real Service extension: `profitOrLoss` added to a new,
Simulation-local `PortfolioActionSimulationResult` type
(`services/simulation/portfolioAction.ts`), not to the shared
`PortfolioActionPreview`.** Widening `PortfolioActionPreview` itself
would touch `services/portfolio/actionPreview.ts`'s own locked M3-006
type; instead, `simulatePortfolioAction` now returns a local superset
(`{ before, after, profitOrLoss }`), computed via `calculatePortfolioGain`
(F-007) — the exact same already-public Engine function
`services/simulation/scenario.ts` already calls for price/interest
scenarios, using collateral value as "Current Value"/"Initial
Investment," the same definition already established there, not a new
one invented here. Failure propagates honestly via the shared
`formulaStep` helper (matching `scenario.ts`'s own pattern), not
silently defaulted — an early draft that defaulted to `0` on failure
was rejected during self-review before commit as inconsistent with
every other Service in this codebase.

**Second, smaller Store change: `warnings: ServiceWarning[]`, shared by
both `runSimulation` and `runPortfolioActionSimulation`** — captures
`ServiceResult.warnings`, which both Service calls already computed
and the Store was simply discarding. No new warning-generation logic;
`06_TASKS.md` M6-014 ("Implement Simulation Warnings") is a separate,
later, dedicated task (Dependencies: M6-009) that will add its own
specific categories (Unsafe Health Factor, Near liquidation, Stale
prices, Invalid assumptions) — not pre-empted here.

**Real bug found and fixed during this batch's own mandatory manual
browser verification, not by a unit test.** The first `ScenarioSummary`
draft used an "if `currentResult`, else `portfolioActionPreview`"
branch, reasoning in its own header comment that the two fields are
"never both" populated. Manually testing the actual page — touching a
price field, then a Collateral Change field, in one session — proved
that assumption false: the two Store actions are genuinely independent
(Batch 5's own design) and neither clears the other's field, so both
end up populated after entirely ordinary use. The branch silently hid
the Portfolio Action result behind the Price/Interest one. Fixed by
rendering both sections simultaneously, each under its own heading,
whenever populated — closer to the DoD's own literal wording ("displays
only calculated Service results," not "displays only some of them")
than the original design. A regression test
(`ScenarioSummary.test.tsx`, "both result kinds populated at once")
was added asserting both sections render together; all 8 component
tests pass, and the fix was re-verified live in the browser afterward
(screenshot).

**Manual browser verification**: created a real portfolio, confirmed
the empty-state placeholder, then a BTC Price change producing a full
Price/Interest Scenario summary with correct before→after numbers
(screenshot). Then, with that scenario still active, entered a
Collateral Change and confirmed both the Price/Interest Scenario
_and_ Portfolio Action sections render together, correctly labeled,
with distinct real numbers for each (screenshot — the bug-fix
verification above). No console errors in any capture.

**Only `services/simulation/` and `stores/simulationStore.ts` changed
this batch — the expected footprint for a Service extension plus a
Store field, no `engine/`/`types/` changes.** `git diff --stat --
engine/ services/ types/` shows only `services/simulation/index.ts`
(export list) and `services/simulation/portfolioAction.ts`
(`profitOrLoss`); `git diff --stat -- stores/` shows only
`stores/simulationStore.ts` (the `warnings` field and its type
update).

**Validation — Batch 8**

| Command                      | Result                                                                                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`             | ✅ Pass                                                                                                                                                 |
| `pnpm lint`                  | ✅ Pass                                                                                                                                                 |
| `pnpm format:check`          | ✅ Pass                                                                                                                                                 |
| `pnpm test` (Vitest)         | ✅ Pass, 1186/1186 (21 net new)                                                                                                                         |
| `pnpm test:coverage`         | ✅ 95.80% statements / 90.11% branches / 100% functions / 98.91% lines (project-wide) — up from Batch 7; `features/simulation/utils/format.ts` at 100%. |
| `pnpm build`                 | ✅ Pass — `/simulation` grew from 2.98 kB to 3.86 kB (its first real Results content)                                                                   |
| `pnpm test:e2e` (Playwright) | ✅ Pass, 35/35 (unchanged)                                                                                                                              |

**Architecture audit**: `git diff --stat -- engine/ services/ types/`
shows only `services/simulation/index.ts` and
`services/simulation/portfolioAction.ts`; `git diff --stat -- stores/`
shows only `stores/simulationStore.ts`. `git status --porcelain` shows
8 modified files (5 source, 3 unit test) and 4 new files (2 source, 2
unit test), no deletions.

**Traceability**: M6-009's Description (Display: Portfolio value, Debt,
Health Factor, Liquidation price, Leverage, Interest cost, Profit/Loss,
Warnings) is addressed item-by-item above — 6 of 8 fully satisfied for
both result kinds, 2 (Debt, Liquidation Price) satisfied only for
portfolio-action results with the price/interest gap explicitly
documented, not silently dropped; its DoD ("Summary displays only
calculated Service results") is satisfied by construction (every
rendered value traces to a real `ScenarioMetricDifference` or
`PortfolioSummary`/`PortfolioActionSimulationResult` field, zero
UI-side arithmetic) and was the exact principle that caught and fixed
this batch's own real display bug; verified by 21 new automated tests
and direct manual browser confirmation, including a live re-check of
the bug fix.

---

### Batch 9 — Scenario Comparison (M6-010)

**Repository re-sync required before this batch began, again.** `git
ls-remote origin main` showed `claude/profitpilot-repo-review-nty3yy`
no longer exists remotely (deleted after Batch 8's own PR merged) and
`origin/main`'s tip (`2d72ef9`) carries Batch 8's exact content,
re-authored — confirmed via `git diff c620b53 2d72ef9 --stat` (empty).
Restarted the local branch from `origin/main`, per the same recovery
procedure used before every batch since Batch 6.

**Dependencies satisfied**: M6-009 (Scenario Summary) is synchronized
to GitHub.

**A genuinely different concept from `ScenarioSummary`, not a
duplicate — verified before writing any code.** `03_UI.md` Page 5's own
"SECTION 3 PORTFOLIO COMPARISON" mockup ("Compare current portfolio
with simulation") describes exactly what `ScenarioSummary` (Batch 8)
already builds — baseline vs. the one active scenario.
`06_TASKS.md`'s own M6-010 Description is explicit and different:
"Compare **multiple** scenarios side-by-side." Resolved in favor of
`06_TASKS.md`'s own more specific wording, the same
authoritative-build-driver precedent this whole engagement has followed
for every prior `03_UI.md` divergence.

**Zero Store changes — the fields this task needed were already real,
built in Batch 2 (M6-003), and never consumed by any UI until now.**
`savedScenarios`/`comparisonSelection`/`saveCurrentScenario`/
`toggleComparisonSelection`/`deleteSavedScenario` all already existed.
This batch is pure UI: a new `ScenarioComparison.tsx` reading and
selecting from those fields directly.

**"Without recalculation inside the UI" (DoD) is satisfied
structurally.** Every `SavedSimulation` already carries its own
`result: SimulationResult`, computed once at save time. The comparison
table reads `saved.result.scenario` fields directly — it never calls
`runSimulation`/`simulateScenario`.

**Documented, load-bearing gap found and not worked around: no "Save
Scenario" button exists anywhere in the app.** `06_TASKS.md` M6-015
("Save Simulation") is a separate, later, P1 task (Dependencies:
M6-003 only) that owns building the real save UI, with its own
"Include: Name, Description, Timestamp, Portfolio reference" list — the
exact three fields `SavedSimulation`'s own Batch 2 header comment
already flagged as deliberately excluded pending that task. Building
even a bare save trigger here would invent part of M6-015's own scope.
This means `savedScenarios` is honestly empty for every real user
today; `ScenarioComparison`'s own empty state says so explicitly
("Saving a scenario is implemented in a later Milestone 6 batch
(M6-015)") rather than implying the feature is broken. Each saved
scenario is labeled by type + real timestamp, not a name, for the same
reason.

**Same two documented field-availability gaps `ScenarioSummary` already
found (Batch 8), carried forward, not re-litigated**: "Debt" and
"Liquidation price" — 2 of M6-010's own 7 named `Compare` items — have
no home in `ScenarioSummary` (`engine/simulation/compareScenarios.ts`);
shown as "Interest" (`debtCost`, the `Compare` list's own item) and
honestly labeled "Liquidation Distance" instead. "Risk" (the 7th item)
is blocked by Conflict #1, the same Health Factor risk-band
classification blocked since Milestone 5 — not built, flagged the same
way Milestone 5 already flagged it for the Dashboard.

**Manual browser verification required a temporary workaround, used
and fully reverted, not shipped.** With no Save button, no real user
flow can populate `savedScenarios` for a live check. A temporary
`window.__simStoreDebug = useSimulationStore` line was added to
`stores/simulationStore.ts`, used to seed two real saved scenarios via
the Store's own `saveCurrentScenario` action (the same call the unit
tests already make), verified visually (screenshots: empty state; two
saved, unselected; two selected with a real comparison table), then
the line was removed entirely before finalizing this batch — confirmed
via `git diff -- stores/simulationStore.ts` showing no changes. This
mirrors the disposable ad-hoc verification scripts already routine for
every batch, just applied to Store state instead of the DOM.

**Validation — Batch 9**

| Command                      | Result                                                                                                           |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`             | ✅ Pass                                                                                                          |
| `pnpm lint`                  | ✅ Pass                                                                                                          |
| `pnpm format:check`          | ✅ Pass                                                                                                          |
| `pnpm test` (Vitest)         | ✅ Pass, 1192/1192 (6 net new)                                                                                   |
| `pnpm test:coverage`         | ✅ 95.80% statements / 90.11% branches / 100% functions / 98.91% lines (project-wide) — consistent with Batch 8. |
| `pnpm build`                 | ✅ Pass — `/simulation` grew from 3.86 kB to 4.34 kB                                                             |
| `pnpm test:e2e` (Playwright) | ✅ Pass, 35/35 (unchanged)                                                                                       |

**Architecture audit**: `git diff --stat -- engine/ services/ types/
stores/` is completely empty — the cleanest possible result for this
batch, since every Store field it needed already existed. `git status
--porcelain` shows 4 modified files (3 source, 1 unit test) and 2 new
files (1 source, 1 unit test), no deletions.

**Traceability**: M6-010's Description ("Compare multiple scenarios
side-by-side.") is satisfied by the new selection + comparison table,
reading only already-saved `SavedSimulation.result` values; 5 of 7
named `Compare` items are shown with real numbers (Equity, Health
Factor, Interest, Leverage, Liquidation Distance in place of
Liquidation Price), 2 (Debt, Risk) are documented gaps, not silently
dropped; its DoD ("Users can compare scenarios without recalculation
inside the UI") is satisfied by construction (zero Service/Engine
calls inside `ScenarioComparison.tsx`); verified by 6 new automated
tests and direct manual browser confirmation via the temporary,
fully-reverted seeding workaround described above.

---

### Batch 10 — Scenario Charts (M6-011)

**Repository re-sync required before this batch began, again.** `git
ls-remote origin main` showed `claude/profitpilot-repo-review-nty3yy`
no longer exists remotely (deleted after Batch 9's own PR merged) and
`origin/main`'s tip (`689c81b`) carries Batch 9's exact content,
re-authored — confirmed via `git diff 0c44385 689c81b --stat` (empty).
Restarted the local branch from `origin/main`.

**Dependencies satisfied**: M6-010 (Scenario Comparison) is
synchronized to GitHub.

**Significant finding, fixed before this batch's own validation could
be trusted: `features/simulation/**` and `app/simulation/**` were never
in `vitest.config.ts`'s coverage `include` list, for the entire
milestone.** Discovered while investigating why this batch's own new
`ScenarioCharts.tsx` showed no coverage row at all. `vitest.config.ts`
lists each feature/route explicitly as it is built
(`features/dashboard/**`, `app/portfolio/**`, etc.); Milestone 6's own
two entries were simply never added when Batch 1 began. This means
every "X% covered" / "at 100%" claim about Simulation files in Batches
1–9's own write-ups was based on those files not being measured at
all, not on genuine, verified coverage — coverage was silently 0%
tracked, not silently 100% passed. Fixed by adding both entries to the
`include` list, which immediately surfaced 4 real, previously
invisible gaps (`ScenarioBuilder.tsx`, `ScenarioComparison.tsx`,
`ScenarioCharts.tsx`, `ScenarioSummary.tsx`) — 3 were closed with new
tests this batch (Target Health Factor's own error/onChange paths, the
Percentage-Change-cleared-to-empty path, and the "Interest Scenario"
label branch in both `ScenarioComparison`/`ScenarioCharts`); the
remaining 2 (`ScenarioSummary.tsx` lines 111/138) are genuinely
unreachable defensive `if (x === null) return null;` guards — the
parent component already gates rendering on non-null, the same
"unreachable given valid inputs, kept for defense in depth" pattern
already accepted elsewhere in this codebase
(`simulateInterestScenario.ts`, `portfolioAction.ts`) — left uncovered
rather than forcing an artificial test. This is a correction, not a new
requirement invented mid-milestone: `pnpm test:coverage` has been a
mandatory pipeline step since Batch 1; it was simply never measuring
what it claimed to.

**No new UI for chart selection.** `ScenarioCharts.tsx` reads the exact
same `savedScenarios`/`comparisonSelection` Store state
`ScenarioComparison` (Batch 9) already manages — no new Store field,
no second selection mechanism.

**Only 3 of M6-011's own 5 named chart targets are actually
chartable — a structural, permanent gap for this milestone's data, not
a "sometimes" one.** `saveCurrentScenario` only ever saves
`currentResult` (price/interest scenarios); it never saves
`portfolioActionPreview`. `SavedSimulation.result.scenario` is a
`ScenarioSummary` with no `debtValue`/`collateralValue` field at
all — the same gap Batches 8/9 already found for "Debt," recurring here
for "BTC exposure" too (F-010, `engine/portfolio/calculateExposure.ts`,
numerically identical to Collateral Value under Conflict A). Unlike
Batches 8/9's gaps, which resolve for portfolio-action results, there
is no saved-scenario path that ever carries this data — "Debt" and
"BTC exposure" charts are not built at all, documented in the
component's own header comment rather than rendered empty.

**"Accessible alternatives" (Requirement) satisfied two ways, not
just claimed.** First, `ScenarioComparison`'s own table (rendered
directly above on the page) already presents every charted number in
plain text. Second, each chart's own container carries `role="img"`
and a text `aria-label` summarizing its real values directly (verified
via `toHaveAccessibleName` in tests and read back via
`page.getAttribute('aria-label')` in manual browser verification) —
not relying on `recharts`' own SVG output, which has no built-in
accessible name.

**`recharts` (already installed since M1-002, no new dependency added)
is the first chart in this entire application.** `/simulation`'s own
bundle grew substantially (4.34 kB → 95.8 kB; First Load JS 215 kB →
306 kB) — an expected, one-time cost of bundling a charting library for
the first time, not a regression to investigate.

**Manual browser verification required the same temporary workaround
as Batch 9, used and fully reverted again.** With still no Save button
(M6-015, unbuilt), a temporary `window.__simStoreDebug =
useSimulationStore` line was added to `stores/simulationStore.ts`,
used to seed two real saved scenarios, verified visually (empty state;
3 rendered charts with correct values and accessible labels,
screenshot), then removed completely — confirmed via an empty `git
diff` on that file before finalizing.

**Validation — Batch 10**

| Command                      | Result                                                                                                                                                                                       |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`             | ✅ Pass                                                                                                                                                                                      |
| `pnpm lint`                  | ✅ Pass                                                                                                                                                                                      |
| `pnpm format:check`          | ✅ Pass                                                                                                                                                                                      |
| `pnpm test` (Vitest)         | ✅ Pass, 1201/1201 (9 net new: 1 new component's own tests + 4 tests closing the newly-discovered pre-existing coverage gaps)                                                                |
| `pnpm test:coverage`         | ✅ 96.03% statements / 90.66% branches / 100% functions / 98.99% lines (project-wide) — up meaningfully from Batch 9's 95.80%, now that Simulation is genuinely measured for the first time. |
| `pnpm build`                 | ✅ Pass — `/simulation` grew from 4.34 kB to 95.8 kB (first `recharts` bundle; expected)                                                                                                     |
| `pnpm test:e2e` (Playwright) | ✅ Pass, 35/35 (unchanged)                                                                                                                                                                   |

**Architecture audit**: `git diff --stat -- engine/ services/ types/
stores/` is completely empty. `git status --porcelain` shows 6
modified files (2 source, 4 unit test) and 2 new files (1 source, 1
unit test), no deletions.

**Traceability**: M6-011's Description ("Create charts for: Portfolio
value, Health Factor, Debt, Interest cost, BTC exposure") is addressed
item-by-item — 3 of 5 charted with real data, 2 (Debt, BTC exposure)
documented as a structural gap, not silently dropped; both named
`Requirements` (Accessible alternatives, Responsive) are satisfied by
construction (`role="img"` + `aria-label`; `ResponsiveContainer`); its
DoD ("Charts enhance understanding without replacing numerical data")
is satisfied by the charts being strictly additive to the already-real
`ScenarioComparison` table, never the only place a number appears;
verified by 4 new `ScenarioCharts.tsx`-specific tests (of the batch's
own 9 net-new tests total — the other 5 close the newly-discovered
pre-existing coverage gaps in `ScenarioBuilder.tsx`/
`ScenarioComparison.tsx`, unrelated to M6-011's own scope) and direct
manual browser confirmation. This batch also closed a real,
milestone-wide coverage measurement gap found while performing that
verification — documented above rather than left for a future batch to
rediscover.

---

### Batch 11 — Scenario Timeline (M6-012)

**Repository re-sync required before this batch began, again.** `git
ls-remote origin main` showed `claude/profitpilot-repo-review-nty3yy`
no longer exists remotely (deleted after Batch 10's own PR merged) and
`origin/main`'s tip carries Batch 10's exact content, re-authored —
confirmed via an empty `git diff --stat` between the prior local HEAD
and `origin/main`'s new tip. Restarted the local branch from
`origin/main`.

**A second, mid-batch recovery was also required.** After this batch's
implementation, validation, and manual browser verification were
already complete, the local working tree unexpectedly reverted to an
earlier commit (`M6-007`), deleting this batch's entire uncommitted
implementation from disk (not just leaving it unstaged) along with the
working-tree-only presence of Batches 8–10's own files. A fresh `git
fetch origin main` confirmed `origin/main`'s real tip was unaffected
(still Batch 10's `M6-011`, containing all of Batches 1–10 intact);
the local branch was re-synced to it (`git checkout -B
claude/profitpilot-repo-review-nty3yy origin/main`), and this batch's
implementation was redone from scratch on the correct base, then
re-validated in full — the second validation run reproduced identical
results (1210/1210 tests, identical coverage percentages, identical
bundle sizes) to the first, confirming the redo was faithful.

**Dependencies satisfied**: M6-007 (Time Projection) is synchronized
to GitHub.

**No dedicated timeline/projection function exists anywhere in
`engine/` or `services/` — confirmed by grep before design began.**
M6-012's own Description ("Display projected portfolio evolution
across the selected time horizon") is satisfied entirely by
composition: `runTimelineProjection` (`stores/simulationStore.ts`)
calls the already-public `simulateScenario` Service (M3-009)
repeatedly, holding the active interest scenario's own
`priceScenario`/`borrowApr` fixed and varying only `timeHorizonDays`.
No new Formula Engine logic was written.

**5 evenly-spaced points (0/25/50/75/100% of the scenario's own
`timeHorizonDays`) — a documented granularity choice, not a spec
requirement.** Neither `06_TASKS.md` nor either spec document names a
specific point count or spacing for this projection; 5 points was
chosen as a reasonable, readable default and flagged explicitly as an
interpretive decision (see the new Unresolved documentation conflicts
entry below) rather than treated as self-evidently correct.

**Confirmed `timeHorizonDays: 0` is a valid, non-erroring input before
relying on it.** `calculateProratedInterest` (F-030) validates its day
count via `validateTimePeriod`, itself a thin wrapper over
`validateNonNegative` — strict positivity is never required, so the
timeline's first point needed no special-casing. At day 0, the
scenario's own price adjustment is still fully applied (via
`simulateInterestScenario`'s own `resolveScenarioPrice` call) while
interest accrual is exactly 0 — a coherent, emergent behavior of
composing the existing function, not a new rule invented for this
batch.

**Only meaningful for `type: 'interest'` scenarios — the same gating
`ScenarioBuilder.tsx`'s own Holding Period wiring already established
in Batch 7.** `type: 'price'` scenarios have no `timeHorizonDays` and
no time to project across; `runTimelineProjection` clears
`timelineProjection` to `null` (rather than erroring) when no interest
scenario is active, so it is safe to call unconditionally from every
interest-relevant `ScenarioBuilder.tsx` field (Borrow Rate, Holding
Period, Custom Holding Period Days) — mirroring the existing
`runSimulation` calls in the same branches.

**`warnings` deliberately left untouched by `runTimelineProjection` —
a design decision made and corrected during implementation, before any
test was written.** An initial draft mirrored `runSimulation`'s own
`warnings: result.warnings` / `warnings: []` pattern; on review this
was recognized as misleading, since `runTimelineProjection` makes 5
separate calculation calls and overwriting `warnings` with only the
last point's own value (or blanking it on any single point's failure)
would misrepresent the other 4 calls' own state. `warnings` is now
left untouched by this action entirely, documented in
`stores/simulationStore.ts`'s own header comment, and verified by a
dedicated test.

**`ScenarioSummary` (Engine type, `engine/simulation/compareScenarios.ts`)
reused wholesale for `TimelinePoint`, not a narrower invented type** —
the same "reuse existing types" discipline already applied to
`ScenarioComparisonResult` (Batch 9) and `PortfolioActionPreview`
(Batch 5). Re-exported through `services/simulation/index.ts` rather
than importing `@/engine` directly from the Store, preserving
`04_BUILD_GUIDE.md`'s own "Only services communicate directly with the
Formula Engine" rule.

**`ScenarioTimeline.tsx` renders 3 `recharts` `LineChart`s — Portfolio
Value, Health Factor, Interest Cost — over the 5 projected points**,
each in a `role="img"` container with a text `aria-label` summarizing
its own values, the same accessible-alternative pattern
`ScenarioCharts.tsx` (Batch 10) established. **M6-012, unlike M6-011,
names no `Requirements` section in `06_TASKS.md` at all** — this
treatment is applied for internal consistency with the rest of the
Simulation Workspace, not because M6-012 itself requires it; the
write-up here is careful not to claim it satisfies a named M6-012
requirement that does not exist. Line charts, not bar charts, since
this is a single scenario's own values across a continuous day axis,
not a comparison of discrete saved scenarios.

**Manual browser verification needed no temporary debug hook this
time — unlike Batches 9/10.** A real portfolio was created through the
real Portfolio creation flow, navigated to Simulation via in-app
`<Link>` navigation (not `page.goto()`, which would wipe the in-memory
Store per Conflict B), and Borrow Rate was set to a real, non-default
value on the Scenario Builder. Screenshots confirmed: (1) the empty
state renders before any interest scenario is active; (2) after
setting Borrow Rate, all 3 timeline charts render with 5 points each,
correct `aria-label` text (`"Day 0 $80,000.00, Day 7.5 $79,958.90, ...
Day 30 $79,835.62"` for Portfolio Value; `"Day 0 $0.00, ... Day 30
$164.38"` for Interest Cost), and the Day-30 endpoint values match the
existing Simulation Results panel's own already-real
`$164.38`/`$79,835.62` figures exactly — confirming the timeline and
the single-point Simulation Results share the same underlying
calculation, not a second, divergent one.

**Validation — Batch 11**

| Command                      | Result                                                                                                                                                                                  |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`             | ✅ Pass                                                                                                                                                                                 |
| `pnpm lint`                  | ✅ Pass                                                                                                                                                                                 |
| `pnpm format:check`          | ✅ Pass                                                                                                                                                                                 |
| `pnpm test` (Vitest)         | ✅ Pass, 1210/1210 (9 net new: `ScenarioTimeline.tsx`'s own 3 tests, `runTimelineProjection`'s own 5 Store tests, 1 new `ScenarioBuilder.tsx` wiring assertion added to existing tests) |
| `pnpm test:coverage`         | ✅ 96.1% statements / 90.72% branches / 100% functions / 99% lines (project-wide); `ScenarioTimeline.tsx` and the new `stores/simulationStore.ts` code are both fully covered           |
| `pnpm build`                 | ✅ Pass — `/simulation` grew from 95.8 kB to 105 kB (3 additional `LineChart`s; no new dependency, `recharts` already bundled since Batch 10)                                           |
| `pnpm test:e2e` (Playwright) | ✅ Pass, 35/35 (unchanged)                                                                                                                                                              |

**Architecture audit**: `git diff --stat -- engine/ services/ types/
stores/` shows real, expected changes for the first time since
Batch 5 — `services/simulation/index.ts` (+7 lines, a type re-export
only) and `stores/simulationStore.ts` (+64 lines, the new
`TimelinePoint` type, `timelineProjection` field, and
`runTimelineProjection` action). Both are the justified footprint of
this batch's own genuine need (a new multi-call Store action reusing
an existing Engine type), not an unintended deviation — `engine/` and
`types/` show zero changes, confirming no new Formula Engine logic was
written. `git status --porcelain` shows 8 modified files (4 source, 4
unit test) and 2 new files (1 source, 1 unit test), no deletions.

**Traceability**: M6-012's Dependencies (M6-007) were satisfied as of
Batch 7; its Description ("Display projected portfolio evolution
across the selected time horizon") is satisfied by
`runTimelineProjection` + `ScenarioTimeline.tsx` together, composing
only already-public Service calls; its DoD ("Users can visualize
projected changes over time") is satisfied by 3 real, correctly-scaled
line charts rendered from real computed values, verified by 9 new
tests and direct manual browser confirmation, including a cross-check
against the existing Simulation Results panel's own already-real
figures. M6-012 names no `Requirements` section — noted explicitly
above rather than silently assumed absent.

---

### Batch 12 — Simulation Assumptions Panel (M6-013)

**Repository re-sync required before this batch began, again.** `git
ls-remote origin main` (run directly, not just `git fetch`'s own
summary) showed the real `origin/main` tip was `3317681` — "feat(ui):
implement simulation timeline (M6-012)" — while the local checkout had
gone stale at an earlier commit (`M6-007`) for a second time this
engagement, the same recurring container/session behavior Batch 11's
own write-up already documented. A fresh `git fetch origin main`
confirmed the real tip was unaffected and carried Batches 1–11 intact;
the local branch was re-synced to it (`git checkout -B
claude/profitpilot-repo-review-nty3yy origin/main`) and verified clean
(`git status --short` empty, `git diff --stat HEAD origin/main`
empty) before any implementation began.

**Dependencies satisfied**: M6-009 (Scenario Summary) is synchronized
to GitHub.

**No dedicated "Assumptions Panel" mockup exists in `03_UI.md` Page
5 — confirmed by search before design began.** Only two passing
mentions exist ("Modify simulation assumptions" for Scenario Controls'
own purpose; "Exports include all simulation assumptions" for the
separate, later Export feature). `06_TASKS.md`'s own literal Include
list ("Price assumptions, Rate assumptions, Protocol parameters, Fees,
Slippage, Formula version") is the sole source of truth for this
component's content, the same precedent `ScenarioCharts.tsx` (Batch 10) already established for an un-mocked task. `01_PRD.md`'s own
Principle Two ("Transparency" — "Every displayed number must have a
documented origin... Which assumptions were used?") is the governing
design principle applied throughout.

**"Fees" and "Slippage" are a structural, permanent gap — the same
conflict #8 pattern already established twice in Milestone 2, not a
new discovery.** A grep across `02_Formulas.md` before implementation
confirmed no Formula ID or equation for swap fees or slippage exists
anywhere in the specification, exactly like `engine/loop/
calculateLoopCosts.ts` and `engine/exit/calculateExitPosition.ts`
already found and documented. This batch reuses those two functions'
own exact wording ("No Formula ID or equation for swap fees/slippage
exists in 02_Formulas.md") for the panel's own explanatory text,
rather than inventing new phrasing or a fabricated `$0`/`N/A` value.

**"Formula version" required a Store change: `ServiceMetadata` was
being silently discarded, the same class of gap `warnings` had before
Batch 9 fixed it.** `simulateScenario`/`simulatePortfolioAction` both
already return a full `ServiceMetadata` (`engineVersion`,
`formulaVersion`, `sourceStatus`, `calculationTimestamp`,
`services/shared/result.ts`, already exported through the `@/services`
barrel — no new re-export needed, unlike Batch 11's `ScenarioSummary`)
on every successful call; `stores/simulationStore.ts` previously read
only `.data`/`.warnings` from each `ServiceResult`, throwing the
`.metadata` away entirely. Added a new shared `lastMetadata` field, set
on success and cleared to `null` on failure for both
`runSimulation`/`runPortfolioActionSimulation` (mirroring how
`currentResult`/`portfolioActionPreview` themselves are only ever
populated on success), cleared by `setCurrentScenario` alongside
`warnings`/`timelineProjection`, and — for the same reason
`runTimelineProjection` already leaves `warnings` untouched (Batch 11) — also left untouched by `runTimelineProjection`, since its 5
calls would otherwise overwrite it with only the last point's own
metadata.

**"Rate Assumptions" deliberately kept distinct from "Protocol
Parameters," not merged into one section.** Protocol Parameters always
shows the portfolio's own currently configured Borrow APR (real, from
`portfolio.protocol`); Rate Assumptions only renders for an active
`type: 'interest'` scenario and shows the _simulated_ Borrow APR and
time horizon specifically — these can legitimately differ, since
Borrow Rate is a user-editable Scenario Builder field (Batch 6).
Verified directly in manual browser testing: Protocol Parameters showed
the portfolio's real 5% Borrow APR while Rate Assumptions simultaneously
showed the simulated 10%, confirming the two numbers are genuinely
independent, not duplicated.

**Panel renders for both `currentResult` (price/interest scenarios)
and `portfolioActionPreview` (portfolio actions) — matching the DoD's
own "Every simulation," not scoped narrowly to price/interest only.**
A portfolio action has no price scenario of its own (it uses the
portfolio's current market price unmodified); this is labeled
explicitly ("$X (current, unmodified)") rather than shown as a
misleading blank or a fabricated value, and no Rate Assumptions row is
shown for it, since no rate is being overridden beyond the Protocol's
own already-displayed value.

**Placed directly after "Simulation Results," before "Portfolio
Comparison"** — per Principle Two, answering "what was assumed" right
next to "what was calculated," rather than at the end of the page.

**Manual browser verification used real UI interaction only** — a real
portfolio created through the real creation flow, in-app `<Link>`
navigation to Simulation (not `page.goto()`, which would wipe the
in-memory Store per Conflict B), and Borrow Rate set to a real,
non-default value. Confirmed: the empty state renders before any
simulation runs; after setting Borrow Rate, Price Assumptions
($50,000.00), Rate Assumptions (10.00% over 30 days), Protocol
Parameters (Max LTV 75.00% · Liquidation Threshold 80.00% · Borrow APR
5.00% · Supply APR 2.00%), Fees & Slippage (documented unavailable),
and Formula Version (Engine 0.1.0 · Formula 1.0) all rendered with
real, independently-verifiable values — screenshotted.

**Validation — Batch 12**

| Command                      | Result                                                                                                                                                                                                                           |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`             | ✅ Pass                                                                                                                                                                                                                          |
| `pnpm lint`                  | ✅ Pass                                                                                                                                                                                                                          |
| `pnpm format:check`          | ✅ Pass                                                                                                                                                                                                                          |
| `pnpm test` (Vitest)         | ✅ Pass, 1221/1221 (11 net new: `SimulationAssumptions.tsx`'s own 5 tests, `lastMetadata`'s own 6 Store tests)                                                                                                                   |
| `pnpm test:coverage`         | ✅ 96.13% statements / 90.84% branches / 100% functions / 99.01% lines (project-wide); `SimulationAssumptions.tsx` at 100% branch coverage after a negative-percentage-change test closed one initially-uncovered ternary branch |
| `pnpm build`                 | ✅ Pass — `/simulation` grew from 105 kB to 106 kB (one new component, no new dependency)                                                                                                                                        |
| `pnpm test:e2e` (Playwright) | ✅ Pass, 35/35 (unchanged)                                                                                                                                                                                                       |

**Architecture audit**: `git diff --stat -- engine/ services/ types/
stores/` shows only `stores/simulationStore.ts` (+44/-3 lines, the new
`lastMetadata` field and its three call sites) — no `engine/`,
`services/`, or `types/` changes at all, confirming no new Formula
Engine or Service logic was written; `ServiceMetadata` was already a
real, existing, exported type, only newly consumed. `git status
--porcelain` shows 5 modified files (3 source, 2 unit test) and 2 new
files (1 source, 1 unit test), no deletions.

**Traceability**: M6-013's Dependencies (M6-009) were satisfied as of
Batch 8; its Description ("Display all assumptions used") is satisfied
by all 6 named Include items addressed one-by-one — 4 real and
computed (Price assumptions, Rate assumptions, Protocol parameters,
Formula version), 2 documented as a structural, permanent gap (Fees,
Slippage) rather than silently dropped or fabricated; its DoD ("Every
simulation is fully transparent") is satisfied by rendering for both
simulation result types and being honest about what is and isn't
available, verified by 11 new tests and direct manual browser
confirmation. M6-013 names no `Requirements` section — noted
explicitly rather than silently assumed absent, the same discipline
Batch 11 already established for M6-012.

---

## Unresolved documentation conflicts

These are **not** resolved in code. They are flagged for a product/engineering
decision before the milestone that depends on them.

### 1. Health Factor risk-band thresholds disagree across four documents — BLOCKS Milestone 2 (Risk classification, Formula F-026/F-060) and Milestone 5 (Dashboard)

| Source                                         | Bands                                                                                                              |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| README.md / `01_PRD.md` REQ-001 Dashboard card | HF>2.0 Green Safe · 1.50–2.00 Yellow Monitor · 1.20–1.50 Orange Elevated · <1.20 Red Critical · ≤1.00 Liquidation  |
| `01_PRD.md` REQ-005 Risk Engine categories     | SAFE >2.50 · MONITOR 2.00–2.50 · ELEVATED 1.50–2.00 · HIGH RISK 1.20–1.50 · LIQUIDATION RISK ≤1.20                 |
| `02_Formulas.md` F-026 Risk Category           | HF≥2.00 Very Safe · 1.70–1.99 Safe · 1.50–1.69 Moderate · 1.30–1.49 High Risk · 1.10–1.29 Critical · <1.10 Extreme |
| `02_Formulas.md` F-060 Recommendation rules    | HF≥2.00 Excellent · 1.80–2.00 Healthy · 1.60–1.80 Good · 1.40–1.60 Caution · 1.20–1.40 High Risk · <1.20 Critical  |

No canonical set is designated. **This is now an active blocker**: Batch 3
(M2-009) implemented Health Factor (F-022) and everything downstream of it,
but skipped F-026 (Health Factor status classification) specifically
because of this conflict — it's the only sub-item left undone in M2-009.
Action needed: pick one banding scheme (or explicitly define which doc
governs which context) before F-026 (Batch 3 cleanup) or F-060 (Batch 8,
Recommendation Engine) can be implemented.

### 2. Two `04_BUILD_GUIDE.md` pages are referenced but missing content

The file's own "NEXT" footers announce **Page 4 — "Database Design, Data
Models & State Management"** and **Page 7 — "Frontend Implementation,
Components, Forms & Responsive Behavior,"** but neither page body exists in
the file (content jumps from page-labeled-3 to page-labeled-5, and
page-labeled-6 to page-labeled-8). No content was invented to fill this gap,
per instruction. State-management/data-model design for Milestone 3/4 and
detailed frontend/component/form conventions for Milestone 4+ will need this
content supplied, or will have to be inferred from `01_PRD.md` REQ-009
(State Management) and `03_UI.md` when those milestones start — flagging now
so it isn't a surprise later.

### 3. `01_PRD.md` REQ-001 through REQ-017 sequencing vs. version scope (v0.1–v1.0)

The PRD's per-page "Blocking Dependencies" chain reads as strictly
sequential (each REQ blocked on _all_ prior REQs), but REQ-015's actual v0.1
feature scope is narrow while REQ-012 (Security), REQ-013 (DevOps/CI-CD),
REQ-014 (AI framework), REQ-016 (Governance) read as full-project, ongoing
concerns. No document maps REQ numbers to version milestones. Not a
Milestone-1 blocker; noted for whoever plans Milestone 8+ (Security/DevOps
hardening) scope.

### 4. Minor / non-blocking

- `06_TASKS.md` M1-006 places an application-shell/placeholder-pages task in
  Milestone 1, before the Formula Engine (Milestone 2) exists. Implemented as
  specified (explicitly "no business logic"), consistent with the task text,
  but technically precedes the Engine — noted per the repository review.
- `06_TASKS.md`'s own summary claims "250+ tasks"; actual count across
  M1–M10 is ~325. Cosmetic.
- `04_BUILD_GUIDE.md` pins "Next.js 15, React 19"; `06_TASKS.md` M1-001 says
  "latest stable version of Next.js." Resolved by using **Next.js 15.5.21 /
  React 19.1.0** (latest 15.x/19.x — both fully available, no compatibility
  deviation was required). Flagging the wording mismatch between the two docs
  rather than silently picking a side.

### 5. Single-asset vs. multi-asset collateral/debt scope — RESOLVED for Milestone 2 in favor of single-asset

Several `06_TASKS.md` Milestone 2 task descriptions imply multi-asset support
(M2-006 "by asset" / allocation percentages, M2-007 "weighted maximum LTV",
M2-009 "weighted liquidation threshold", M2-028 "multiple collateral assets" /
"multiple debt assets"), but `01_PRD.md` REQ-003 is explicit: _"Version 0.1
assumes Bitcoin only"_ (collateral) and _"Version 0.1 assumes one
stablecoin"_ (debt), and every one of `02_Formulas.md`'s F-001–F-069 is
written single-asset. Batch 1's shared types (`engine/shared/types.ts`) were
built single-asset, following the PRD's explicit v0.1 scope and the
documented Formula IDs, since building multi-asset aggregation now would mean
inventing formulas that don't exist in `02_Formulas.md` — which conflicts
with "do not invent functionality." **This decision was made without
explicit confirmation and should be reviewed** — if multi-asset support is
actually wanted for Milestone 2, `engine/shared/types.ts` will need
revisiting before Batch 2 (Portfolio Mathematics) builds on it.

### 6. Health Factor display precision: 2 decimals vs. 3 decimals

`02_Formulas.md` "PRECISION STANDARD" (page 1) states Health Factor uses 3
decimals; `01_PRD.md` REQ-002 "PRECISION REQUIREMENTS" states 2 decimals.
`engine/shared/decimal.ts`'s `DISPLAY_PRECISION.healthFactor` uses **3**,
following `02_Formulas.md` as the document of record for calculations. This
is a single constant and trivially reversible if the intended value is 2.

### 7. Compound interest (M2-013/M2-014) has no documented formula — BLOCKS M2-013, M2-014, and downstream tasks

`02_Formulas.md` F-030–F-034 (Interest & Position Decay) are simple-interest
only; F-033 states explicitly: _"Future versions may support continuous
compounding."_ `06_TASKS.md` M2-013 ("Implement Compound Interest
Calculations") and M2-014 ("Implement Variable Rate Projection," which
depends on M2-013) have no formula to implement against. **Not implemented,
per instruction, rather than inventing a compounding model.** Downstream
impact: M2-017 ("Loop Cost Calculations") formally depends on M2-013, but
its "Borrowing interest" sub-item turned out to be satisfiable via simple
interest (M2-012) independent of this blocker — see the Batch 5 section
above; M2-017 is still marked Partial because the formal dependency itself
remains unsatisfied. M2-020 ("Interest Scenario Simulation") depends on
M2-014 and will hit the same blocker when its batch (6) is reached, unless
this is resolved first. Action needed:
either author and document a compounding formula (frequency, day-count
convention, protocol-defined vs. continuous), or descope M2-013/M2-014 from
Version 1 explicitly.

**Related, separately confirmed**: F-034, F-035, F-036, F-038, and F-039
(the rest of the Interest & Position Decay chapter) have no task assignment
anywhere in `06_TASKS.md` at all — see the Batch 4 section above. This
mirrors the F-005–F-008 gap found in Batch 2 and should likely be resolved
together with it.

### 8. Swap fees / slippage / gas estimate have no documented formula anywhere — BLOCKS full M2-017 and recurs in later milestones

`06_TASKS.md` names "Swap fees", "Slippage", and "Gas estimate" (or close
variants) as required inputs/outputs across at least five task
descriptions (M2-016's "Fees and slippage assumptions" input, M2-017's cost
breakdown, and further occurrences later in the document), but
`02_Formulas.md` has zero matches for any of these terms — no Formula ID,
equation, or worked example exists for transaction/execution costs anywhere
in the spec. Found while implementing Batch 5 (M2-017): "Borrowing
interest" and "Break-even BTC appreciation" are fully documented (F-032,
F-037) and were implemented; swap fees, slippage, gas estimate, and the
"Total implementation cost" that would sum them were not, and are itemized
as `unavailable` (with reasons) in `calculateLoopCosts`'s result rather
than invented or silently dropped. Action needed: author and document a
transaction-cost model (fixed vs. percentage swap fee, slippage-vs-size
curve, gas estimation source) in `02_Formulas.md`, or explicitly descope
these fields from the tasks that reference them.

**Update — Milestone 3 Batch 7 (M3-010, M3-011)**: revisited as
instructed. Confirmed this does not block the Service layer either —
`calculateLoopCosts` and `calculateExitPosition` (M2-023) are both
already fully implemented and itemize the same gap as a normal,
successful result rather than failing. `planLoopStrategy` and `planExit`
pass the itemization straight through. Still open at the specification
level; no new formula was authored.

### 9. The entire Recommendation Engine formula chapter (F-060–F-069) has no task assignment anywhere in `06_TASKS.md`

Found while implementing Batch 6 (M2-018): F-065 "Interest Warning" looked
like it might satisfy M2-018's "Excessive cost" check, but a search showed
it has no assigned task. Checking the rest of the chapter for the same
report confirmed **all ten Formula IDs F-060 through F-069 — Risk
Category (also see conflict #1), Loop Recommendation, Interest Warning, and
the rest of the Recommendation Engine chapter — have zero matches anywhere
in `06_TASKS.md`.** This is a third instance of the same pattern as
F-005–F-008 (Batch 2, Portfolio Metrics) and F-034/035/036/038/039 (Batch 4,
Interest & Position Decay), now spanning a full chapter rather than a few
scattered IDs. Not a Batch 6 omission — none of these were ever assigned to
M2-018 or any other task. Flagged for the same eventual resolution: the
M2-032 Formula Traceability Audit, or a `06_TASKS.md` update that assigns a
Recommendation Engine milestone/task set to this chapter.

### 10. "Target cash proceeds" (M2-024) has ambiguous mechanics, not just a missing formula — BLOCKS full M2-024

**This is a behavioral / business-rule ambiguity about execution order,
not a missing mathematical formula.** Found while implementing Batch 9.
`06_TASKS.md` lists "Target cash proceeds" as one of M2-024's five target
types, and a later milestone's task (M7-024) implies an equation for the
resulting figure ("Net cash proceeds = Gross sale value − Debt repaid −
..."), so this is not the same class of gap as swap fees/slippage/gas
estimate (conflict #8), where no equation exists at all — the arithmetic
for either interpretation below is straightforward once the business rule
is picked. The blocker is that **selecting "Target cash proceeds" as an
exit type doesn't determine a unique execution order**, and the two
candidate interpretations produce different, individually valid
calculations:

- **(a) Repay debt first, then withdraw proceeds**: fully repay the
  current debt, and whatever cash remains from the BTC sale is the "cash
  proceeds" the user receives. Debt goes to zero; retained BTC and cash
  proceeds both fall out of that single sale.
- **(b) Preserve debt, maximize cash withdrawal**: sell BTC purely for
  liquidity without touching debt at all — debt stays unchanged, and the
  full sale value becomes cash proceeds. This worsens LTV/Health Factor
  (collateral drops, debt doesn't), which interpretation (a) does not.

Both are coherent, materially different exits — (a) resolves to a
`targetDebt` of 0 (a full exit as already implemented), while (b) has no
representation in `calculateExitPosition`'s current `targetDebt` model at
all, since it never reduces debt. No document specifies which is meant.
Not implemented — see the Batch 9 section above for the fuller reasoning.
Action needed: specify which execution order "Target cash proceeds"
means (or both, as separate exit types) before this can be implemented.

**Update — Milestone 3 Batch 7 (M3-011)**: revisited as instructed.
`calculateTargetExit`'s `ExitTarget` union already excludes "Target cash
proceeds" as a target type — that scoping decision was made at M2-024,
so the Service layer simply inherits the same coverage.
`planExit` accepts `ExitTarget` exactly as the Engine defines it; no new
target type was invented to work around the gap. Still open at the
specification level.

### 11. "Exit readiness" (M2-025) has no Formula ID anywhere in the Recommendation Engine chapter — BLOCKS full M2-025

Found while implementing Batch 10. `06_TASKS.md` M2-025 lists "Exit
readiness" as one of six "Recommendation categories," but a full read of
every Formula ID in the chapter (F-060 through F-069) found none that
names or implies it — unlike F-060/F-065 (documented formulas blocked by
other conflicts), there is nothing here to implement against at all, the
same class of gap as conflict #9 (the whole chapter's task-assignment
gap) but at the level of a single category within an otherwise-assigned
task. Not implemented; `generateRecommendations` itemizes it in
`unavailableCategories`. Action needed: either author an "Exit readiness"
formula in `02_Formulas.md`, or map this category to existing Exit
Strategy chapter formulas (F-047 "Risk Reduction Efficiency" looks like
the closest conceptual fit, though `06_TASKS.md` never draws that
connection) and update the task documentation to say so explicitly.

### 12. F-067 "Simple Portfolio Score" documents weights but not the component formulas they weight

**Why F-067 cannot currently be implemented, stated directly: weighting
factors alone are insufficient to compute the score.** A weighted sum
needs two things — the weights, and the per-component values being
weighted. F-067 supplies only the first. The specification does not
define how each raw component (e.g. a Health Factor of 1.6, a Debt Ratio
of 0.4) is calculated into its own 0–100 sub-score before that weight is
applied — there is no equation, scale, or worked sub-example for any of
the five components (Health Factor, Debt Ratio, Interest Cost, Leverage,
Portfolio Growth). Therefore the overall weighted score cannot be
computed without inventing that missing normalization behavior ourselves,
which is out of scope.

Found while implementing Batch 10 (not required by M2-025/M2-026, so not
blocking anything yet — flagged for whoever is assigned it). F-067 gives
explicit weights (Health Factor 40%, Debt Ratio 20%, Interest Cost 15%,
Leverage 15%, Portfolio Growth 10%) combining into a 0–100 score, unlike
F-058 "Scenario Ranking Score" (conflict, Batch 8) which has no weights
at all — so this gap is narrower than F-058's, but not zero. This
chapter's own "IMPLEMENTATION NOTES" state "No hidden scoring," which
argues against inventing the missing normalization rather than for it.
Action needed: either document each component's 0–100 conversion, or
descope F-067 explicitly.

### 13. F-040 "Target Debt" does not account for collateral sold during an exit — `calculateTargetExit`'s `'healthFactor'` target does not exactly reproduce the requested Health Factor

**F-040 itself is not being marked incorrect.** Stated directly, as four
separate points: (1) F-040 is not wrong — it correctly computes Target
Debt under its own stated equation. (2) The conflict arises because F-040
assumes collateral stays fixed while debt changes. (3) M2-024 applies
F-040 to `calculateTargetExit`'s `'healthFactor'` target, a workflow that
_simultaneously_ changes collateral (sells BTC to fund the repayment
F-040's output leads to) — a scenario F-040's own assumption doesn't
cover. (4) Therefore this is a mismatch between F-040's documented
assumption (fixed collateral) and M2-024's documented task behavior
(collateral changes as part of the same exit), not necessarily an error
in F-040 itself.

Found via Batch 11's own M2-027 invariant suite ("Target Health Factor
results reproduce the target"), applied against Batch 9's
`calculateTargetExit`. `02_Formulas.md`'s EXIT DEPENDENCY GRAPH chains
F-040 "Target Debt" → F-041 "Required Debt Repayment" → F-042 "BTC Sale
Required" sequentially, with F-040 computed against the _current_
(pre-sale) collateral value. But executing that repayment via
`calculateExitPosition` (M2-023) sells BTC to fund it, which reduces
collateral value — an effect F-040 was never designed to account for (it
has no "solved iteratively" note the way F-045 "Target Price Exit" does).
Concretely: collateral $120,000, debt $60,000, threshold 80%, target HF
2.00 → F-040 says target debt $48,000, but selling the $12,000 of BTC
needed to reach it drops collateral to $108,000, producing an actual
Health Factor of 1.80, not 2.00.

**Not fixed in code** — the mathematically self-consistent equation (solve
`H = ((Collateral − R) × Threshold) / (Debt − R)` for repayment `R`) is
straightforward to derive but appears nowhere in `02_Formulas.md`, and
inventing it would mean implementing undocumented behavior. The Engine
implements F-040 exactly as documented; the discrepancy is flagged in
`calculateTargetExit.ts`'s own code comment and asserted precisely by a
dedicated invariant test (`tests/unit/engine/invariants/targetHealthFactorInvariant.test.ts`)
rather than hidden. Every other target-Health-Factor consumer
(`calculateAdditionalBorrow` F-027, `calculateRepaymentRecommendation`
F-062, `calculateAdditionalCollateralRecommendation` F-063) reproduces its
target exactly, since none of them sell collateral to fund the change —
this is specific to the sell-based exit path. Action needed: either
`02_Formulas.md` documents a self-consistent Target Debt equation for the
exit case (or says F-040 is explicitly an approximation here), or the
approximation is accepted and stated as intended behavior at the
specification level.

**Update — Milestone 3 Batch 7 (M3-011)**: revisited as instructed. The
Service layer does not correct or hide the approximation —
`planExit` calls `calculateTargetExit` as-is and reports whatever Health
Factor the "after" summary actually computes, so the undershoot remains
visible in the Service's own before/after comparison exactly as it
exists in the Engine (verified by
`tests/unit/services/exit/plan.test.ts`'s healthFactor-target test,
which asserts the resulting Health Factor is below the requested
target). Still open at the specification level; no corrective equation
was invented.

---

### 14. `02_Formulas.md`'s official Golden Reference Portfolio's loop step cannot be reproduced as an immutable fixture — the "Target borrow percentage" it implies is never given a value

**The published Golden Reference Portfolio is not being marked
incorrect.** Stated directly, as three separate points: (1) The scenario
as documented — starting position, protocol parameters, "Loop Strategy:
Automatic," "Stop at Target HF: 1.80" — is internally consistent and
nothing in it is wrong. (2) It simply omits a value for
`targetBorrowPercentage` (or an equivalent intermediate parameter, e.g. an
explicit per-step borrow rule) — the one input `calculateLoopStrategy`
(F-018, M2-016) requires beyond the stop condition in order to execute the
loop deterministically, and neither `02_Formulas.md` nor `06_TASKS.md`
assigns "Automatic" a concrete numeric meaning anywhere. (3) Therefore the
documented Target HF 1.80 example cannot be deterministically recreated as
a single immutable fixture without introducing an undocumented assumption
about that missing parameter — this is a gap in what the scenario
specifies, not an error in what it does specify.

`02_Formulas.md`'s "GOLDEN REFERENCE PORTFOLIO" specifies a starting
position (3.33333333 BTC, zero debt) plus "Loop Strategy: Automatic /
Stop at Target HF: 1.80," implying the scenario's _real_ reference state
is what results after looping from that start to Health Factor 1.80. But
`calculateLoopStrategy` (F-018, M2-016) — the Engine's only implementation
of "repeated loop calculations" — requires a `targetBorrowPercentage`
input, because `06_TASKS.md` M2-016 itself lists "Target borrow
percentage" as a required input, separate from "Minimum Health Factor."
`02_Formulas.md`'s F-018 pseudo-algorithm ("while Health Factor > Target:
Borrow, Buy BTC, Deposit BTC, Repeat") never states how much to borrow
per step, and the Golden Reference Portfolio's own description ("Loop
Strategy: Automatic") does not supply a numeric value either — "Automatic"
is not defined anywhere as a synonym for "borrow to maximum capacity each
step" or any other specific percentage.

**Not fixed by inventing a value.** Any single assumed
`targetBorrowPercentage` (e.g. 100% of available borrow capacity each
step) would produce a different final collateral/debt state, and locking
one in as an "immutable" fixture (M2-028's own DoD wording) would mean
enshrining an invented assumption as if it were documented, undetectable
to a future reader as anything other than a genuine spec value. Instead,
`tests/fixtures/goldenReferencePortfolios.ts`'s `NO_DEBT` fixture
reproduces only the portion of the official scenario that is fully
specified — the pre-loop starting state — and this gap is documented
here and in that file's own comments rather than silently worked around.
Action needed: `02_Formulas.md` or `06_TASKS.md` specifies a concrete
target borrow percentage (or an explicit rule, e.g. "borrow to Max LTV
each step") for "Automatic" loop strategies, after which the post-loop
state can be added as a further fixture.

---

### 15. M2-029's DoD, read literally, would require implementing all 69 Formula IDs — in direct tension with "never invent formulas"

**M2-029's DoD text**: "A formula coverage report identifies no untested
Version 1 Formula IDs." Taken 100% literally, this requires every one of
`02_Formulas.md`'s 69 Formula IDs (F-001–F-069) to have a passing test —
but 33 of them have no implementation, for reasons ranging from "no task
in `06_TASKS.md` assigns it" (the majority) to "only a discrete example
table is given, with no equation or interpolation rule" (F-029, F-058,
F-067) to "the Engine's own documented Method is an unspecified
'Iterative Solver'" (F-045, F-056, F-057) to "never defined anywhere in
the document at all" (F-009). None of these are testable without first
inventing the missing formula, scoring model, or numerical method — which
directly contradicts this batch's own instruction ("Never invent
formulas, regression expectations, tolerances, assumptions, or
architecture") and the discipline every prior batch has followed.

**Resolution applied (not a code fix, a DoD interpretation, stated here
explicitly)**: "no untested Version 1 Formula IDs" is read as "no Formula
ID is _silently_ untested" — every one of the 69 is mechanically
accounted for in `tests/fixtures/formulaCoverage.ts` as either genuinely
implemented-and-tested (36) or explicitly documented as not implemented,
with a specific reason (33), and `formulaCoverage.test.ts` fails the
build if either set drifts without the registry being updated to match.
This satisfies the DoD's evident intent — nothing is quietly missing from
the picture — without inventing the 33 missing formulas.

**Tracked is not the same as implemented, stated plainly**: the Formula
Coverage Registry **tracks** all 69 documented Formula IDs — it has one
entry for every single one, `'implemented'` or `'not_implemented'`,
with no ID omitted. Actual **implementation** remains limited to the 36
Version 1 formulas the specification actually supports with a real
equation and a task assigning it. Being present in the registry is not a
claim that a Formula ID works, has code behind it, or is safe to call —
only that its status has been recorded and, when unimplemented, why.
`formulaCoverage.test.ts` enforces this distinction mechanically: it
fails if a `'not_implemented'` entry is ever found tagged in `engine/`
source (the registry would be stale in the "hasn't caught up to a real
implementation" direction) and equally fails if an `'implemented'` entry
has no matching source tag (stale in the "claims an implementation that
doesn't exist" direction). Action needed: either the DoD is reworded to
say "Version 1 Formula IDs **with an implementation**," or a product
decision authorizes implementing (a subset of) the 33 gaps, at which
point they move from "documented gap" to "implemented" in the registry.

---

### 16. `04_BUILD_GUIDE.md` and `02_Formulas.md` state different Engine performance targets; M2-030 names 2 more benchmark categories than the Build Guide defines

**Two source documents disagree on the numbers.** `04_BUILD_GUIDE.md`
states, identically in 3 separate places (Page 3's "PERFORMANCE TARGETS,"
a later app-level "PERFORMANCE TARGETS," and the dedicated "PERFORMANCE
TESTS" section): Portfolio Calculation < 10ms, Loop Calculation/Loop
Strategy < 20ms, Simulation < 50ms, Recommendation < 20ms, Dashboard
Refresh < 100ms. `02_Formulas.md`'s own "PERFORMANCE TARGETS" section
states different numbers for two of the same categories: Portfolio
Calculation < 50ms (5× looser) and Scenario Simulation < 100ms (2×
looser) — only "Dashboard Refresh < 100ms" agrees across both documents.
M2-030's DoD resolves which one governs _for this task_: "Calculations
satisfy the performance targets defined in the **Build Guide**" — so
`04_BUILD_GUIDE.md`'s tighter numbers were used, and `02_Formulas.md`'s
looser ones were not. This does not resolve the disagreement itself,
only which document this one task defers to; a canonical set should
still be picked before the Engine is benchmarked outside the context of
M2-030 specifically.

**M2-030 names 6 benchmark targets; the Build Guide's own "PERFORMANCE
TESTS" section only defines 4 categories.** M2-030's "Benchmark" list is
Portfolio summary, Health Factor, Liquidation calculations, Loop
strategy, Single scenario, Scenario comparison. The Build Guide's
"Targets" are Single portfolio calculation, Optimal loop calculation,
Standard simulation, Recommendation evaluation — no category named
"Health Factor," "Liquidation calculations," or "Scenario comparison"
exists. Rather than invent new numbers for these 3, they were mapped to
the closest already-documented category: Health Factor and Liquidation
calculations → Single portfolio calculation (< 10ms), since both are
steps in `02_Formulas.md`'s own FORMULA DEPENDENCY GRAPH chain that
starts at "Portfolio Value" — the same chain "Portfolio summary" draws
from; Scenario comparison → Standard simulation (< 50ms), the closest
documented category, and a conservative one since comparing two
already-computed scenarios does no recomputation and should in practice
run well under a full simulation's budget.

**This mapping is a benchmarking categorization only, not a claim about
computational complexity or expected runtime.** Stated explicitly: using
"Single portfolio calculation" as Health Factor's and Liquidation
calculations' budget, and "Standard simulation" as Scenario comparison's,
does **not** assert that these operations have the same computational
cost, the same number of steps, or the same expected runtime as the
category they borrow from — some are almost certainly far cheaper in
practice (a single Health Factor call is a handful of `decimal.js`
operations; "Single portfolio calculation" bundles 8). The mapping exists
solely because `02_Formulas.md`/`04_BUILD_GUIDE.md` provide **no separate
benchmark target** for these 3 items, and reusing the nearest documented
ceiling is the way to give them _some_ enforced upper bound without
inventing a new number specific to their own, unstated complexity. A
future, more precise per-operation target (if one is ever specified)
should replace this borrowed one rather than assume the borrowed ceiling
was ever meant to reflect their actual cost.

Action needed: `06_TASKS.md` or `04_BUILD_GUIDE.md` either merges "Health
Factor"/"Liquidation calculations" explicitly into "Portfolio
Calculation," or the Build Guide adds a "Recommendation"-style dedicated
line item for each — and the "Recommendation evaluation < 20ms" target
itself remains unbenchmarked here, since M2-030's own "Benchmark" list
does not name a recommendation category at all.

---

### 17. `06_TASKS.md` never enumerates which Engine functions count as "internal helpers" for M2-031 — the public/internal split required interpretation, not a documented rule

M2-031's Requirements say "Expose only supported public functions" and
"Hide internal helpers," but no document anywhere — not `06_TASKS.md`,
not `04_BUILD_GUIDE.md`, not `02_Formulas.md` — lists which specific
functions are "internal" versus "public." Every function already carries
a Formula ID, a doc comment, and a full test suite, so "has
documentation" and "is tested" (the usual signals used throughout this
project to distinguish real work from a gap) don't discriminate here —
both categories are fully documented and tested.

**Resolution applied**: each candidate was judged against its own task's
Description/DoD framing, not a stated rule:

- `engine/validation/invariants.ts` (5 check functions): M2-027's DoD
  says "Invariant violations fail **tests**," and its Description says
  "Add automated **checks**" — both are testing-framework language, not
  calculation-output language. Every existing consumer already imports
  these directly from `./validation/invariants`, never through
  `engine/index.ts`, which is corroborating (not conclusive) evidence
  they were never treated as part of the curated surface.
- `engine/validation/validate.ts` (10 validator functions): the stronger
  finding here is that `06_TASKS.md` itself, in later Milestone 3/4
  tasks, introduces a **separate** Zod-based "Portfolio Validation
  Schemas" layer for Service/UI-facing input validation ("Use Zod
  validation") — a second, independent validation mechanism that would
  be redundant if Services were also meant to call
  `engine/validation/validate.ts`'s functions directly. This is textual
  evidence, not just architectural inference.

**Everything else was kept public** on the same standard: every
remaining exported function either carries a Formula ID (a Version 1
calculation with its own documented equation) or, in `rankScenarios`'s
one exception, has its own task DoD explicitly framing it as UI/Service-
facing ("scenarios can be ranked and displayed... without recalculating
values in the UI," M2-022). Nothing was hidden merely because it seemed
"low-level" without a specific textual signal supporting that call.

**This curation reflects the best interpretation of the Version 1
specification available now — it is not a claim that these two modules
should never be public.** Stated directly: `checkNetWorthInvariant` and
`validateNonNegative` (and their siblings) are hidden today because
nothing in the current `06_TASKS.md`/`04_BUILD_GUIDE.md`/`02_Formulas.md`
gives a Service a documented reason to call them directly — not because
of some inherent property that makes them permanently unsuitable for
public use. If a later milestone's specification evolves to give
Services a genuine, documented need for either (e.g. a future task
explicitly asks the UI to run a live consistency check, or a future
Service is asked to pre-validate input before submission rather than
relying on each formula's own returned error), the correct response is
to re-curate `engine/index.ts` to expose them, not to treat this
conflict as having permanently settled the question. Action needed: if a
future milestone finds a function was hidden that a Service genuinely
needs (or exposed that should have been hidden), `engine/index.ts`'s
curation should be revisited explicitly against that milestone's own
specification — the function itself never needs to move, only its
re-export.

---

### 18. "Source status" (M3-002) is named once in the entire specification with no documented value domain

`06_TASKS.md` M3-002's "Include" list names `Source status` as a field
every `ServiceResult`'s metadata must carry, but the term appears
nowhere else in `06_TASKS.md`, `04_BUILD_GUIDE.md`, `01_PRD.md`, or
`02_Formulas.md` — no enum, no example values, no description of what
states it can take. A textually similar but distinct concept, "Data
source" / "Freshness timestamp," appears later on the Protocol Parameter
Service (M3-008) and, separately, in a "Manual or provider data source"
context elsewhere — but those are service-specific fields for a
different Service, not this generic, cross-cutting one.

**Resolution applied (by explicit instruction, not invented)**:
`ServiceMetadata.sourceStatus` is typed as a plain `string` rather than a
literal union — no taxonomy (e.g. `"live" | "cached" | "fallback"`) was
guessed at. Action needed: a future task (plausibly M3-007 Market Data
Service or M3-008 Protocol Parameter Service, both of which have real
data-freshness concepts) should either define this field's actual value
domain, or `06_TASKS.md` should clarify whether "Source status" is
meant to be populated at all by Services that have no notion of a data
source (e.g. a purely Engine-calculation-driven result).

**Update — Milestone 3 Batch 5 (M3-007)**: reached, and partially
clarified without being fully resolved. `04_BUILD_GUIDE.md` (found while
implementing M3-007, see that batch's write-up) turns out to document a
real, concrete vocabulary for exactly this kind of concept — "PRICE
FRESHNESS" (Fresh/Stale/Unavailable) and "SERVICE FALLBACK ORDER"
(Live provider/Last valid cached value/Manual input). M3-007 uses this
real vocabulary (`PriceFreshness`, `PriceOrigin`), but deliberately as
`MarketQuote`'s own concrete fields, **not** by giving
`ServiceMetadata.sourceStatus` a literal-union type — `sourceStatus`
remains exactly as generic as M3-002 defined it, per instruction not to
modify it. So the _generic_, cross-cutting `sourceStatus` field's value
domain is still undefined; what changed is that a concrete,
non-speculative example of what a per-Service source/freshness
vocabulary looks like now exists to model any future resolution on, if
one is ever decided.

**Update — Milestone 3 Batch 8 (M3-008)**: the same pattern repeated
once more, confirming it generalizes rather than being a one-off.
Protocol Parameter Service got its own `ProtocolOrigin` vocabulary
(`'live' | 'cache' | 'manual'`), again kept local to `ProtocolQuote`
rather than folded into the generic `sourceStatus`. Notably, protocol
parameters have _no_ freshness-classification equivalent at all (no
"PROTOCOL FRESHNESS" section exists in `04_BUILD_GUIDE.md`, unlike
prices) — reinforcing that each Service's provenance vocabulary is
genuinely domain-specific, not a single generic scheme `sourceStatus`
could ever cleanly capture. Still open at the generic level.

---

### 19. "Formula version" (M3-002) is singular; how a multi-Engine-call Service aggregates it is unspecified

`ServiceMetadata.formulaVersion` (M3-002's own wording is singular) fits
cleanly for a Service that calls exactly one Engine function, but several
already-scoped future Services will call many — the Portfolio Summary
Service (M3-005) alone is specified to include Collateral value, Debt
value, Net equity, LTV, Leverage, Health Factor, Liquidation information,
and Interest cost, each traceable to a different Engine function with
its own `FormulaResult.metadata.formulaVersion`. Nothing in `06_TASKS.md`
or `04_BUILD_GUIDE.md` says whether a composite Service result should
report one representative version, a list, the newest, or omit the field
when it isn't singular.

**Resolution applied**: M3-002 defines only the per-call metadata shape;
aggregation across multiple Engine calls is explicitly deferred to
whichever Service task first needs to solve it (M3-005 at the latest).
Not solved provisionally here to avoid inventing a composition rule the
specification doesn't state. Action needed: M3-005's own implementation
batch should either find textual guidance elsewhere in `06_TASKS.md` or
flag this as a decision point before shipping a Portfolio Summary
Service result.

**Update — Milestone 3 Batch 4 (M3-005)**: reached, as anticipated, and
still not resolved with a real algorithm. `calculatePortfolioSummary`
implements a checked stopgap: it takes the first successful Engine
call's `formulaVersion` and verifies every later call in the same
summary against it, failing loudly (`FORMULA_VERSION_MISMATCH`) instead
of silently picking one if they ever disagree. Every public Engine
function currently reports `formulaVersion: '1.0'`, so this stopgap
always succeeds today — it is not a real multi-version aggregation rule,
and this conflict remains open. A future Engine version bump affecting
only some formulas would surface this immediately as a Service failure,
which is the intended, honest behavior until the specification defines
an actual aggregation rule.

---

### 20. `calculatePortfolioSummary` cannot summarize a zero-debt portfolio — `calculateLiquidationPrice` (F-024) treats liquidation price as undefined without debt — ✅ RESOLVED, Milestone 4 Batch 0

Found while implementing Milestone 3 Batch 4 (M3-005). A debt-free BTC
deposit (collateral > 0, debt = 0) is a valid economic state — someone
who has deposited collateral but not yet borrowed against it. Composing
the Engine functions M3-005's own "Include" list requires exposes an
inconsistency already present in Milestone 2's own formulas:
`calculateHealthFactor` (F-022) explicitly handles zero debt by
returning success with `Infinity` and a `NO_DEBT` warning (a deliberate
M2-009 design decision), but `calculateLiquidationPrice` (F-024) treats
a zero-debt liquidation price as undefined and returns a `FormulaFailure`
(`NOT_APPLICABLE_NO_DEBT`). Because `calculatePortfolioSummary` composes
both, any zero-debt portfolio makes the whole summary fail at the
liquidation-price step, even though every other field (Collateral Value,
Net Equity, LTV, Leverage, Health Factor) is perfectly well-defined for
that portfolio.

**Resolution applied**: none — the Engine's existing F-024 behavior was
not overridden or special-cased. Inventing a fallback value (e.g.
`null`, `0`, or `Infinity` for `liquidation.price` when debt is zero)
would mean guessing at a business rule `02_Formulas.md` doesn't state,
so `calculatePortfolioSummary` faithfully surfaces the Engine's own
failure instead. Action needed: a product/engineering decision on
whether F-024's "undefined for zero debt" semantics should extend to a
documented `PortfolioSummary`-level convention (e.g. `liquidation: null`
for debt-free portfolios) — that would be a Milestone 2 Engine change or
a Milestone 3 Service-level adaptation, not something to decide inside
this batch's own scope.

**Severity escalated — Milestone 3 Batch 7 (M3-011)**: this is no
longer only an edge case. Planning a **full exit**
(`targetDebt: 0` — the single most common, most important exit type)
always produces a zero-debt resulting portfolio, so
`services/exit/plan.ts`'s `planExit` fails on the "after" comparison for
every full exit today. Pinned explicitly by
`tests/unit/services/exit/plan.test.ts`'s "full exit and conflict #20
interaction" test rather than left as a silent gap. A real fix (e.g.
making `PortfolioLiquidationSummary`'s `price`/`buffer` fields nullable,
mirroring `calculateHealthFactor`'s own zero-debt-as-`Infinity`
precedent) would mean modifying `services/portfolio/summary.ts` —
already shipped and depended on by M3-006 and M3-009 — a
cross-batch-blast-radius change deliberately left for its own dedicated
decision point rather than folded into Batch 7's scope. This is now the
highest-priority open conflict for whoever picks up the next Exit
Planning-adjacent or Portfolio Summary-adjacent work.

**Resolved — Milestone 4 Batch 0** (standalone follow-up, approved
before any M4 task, per the Milestone 4 plan's Conflict C): implemented
exactly the Service-level adaptation anticipated above.
`calculatePortfolioSummary` now checks `debtValue === 0` before calling
`calculateLiquidationPrice`/`calculateLiquidationBuffer` at all and sets
`liquidation: null` instead (not the individual `price`/`buffer`
fields — the whole `PortfolioLiquidationSummary` triple, since
`distance` is also only meaningful together with a defined price).
Engine's F-024/F-025 were left untouched. `services/simulation/scenario.ts`
updated its one direct `.liquidation.distance` read to
`?.liquidation?.distance ?? Infinity`; `services/portfolio/actionPreview.ts`
and `services/exit/plan.ts` needed no changes (opaque `PortfolioSummary`
consumers). The full-exit test in `tests/unit/services/exit/plan.test.ts`
now asserts success instead of the pinned failure. See "Milestone 4
progress" → "Batch 0" above for full detail.

---

### 21. M3-013 asks Services to receive "persistence adapters" through typed dependencies, but no persistence Service or task exists anywhere in Milestone 3

Found while implementing Milestone 3 Batch 9 (M3-013). M3-013's own
Description reads: "Allow Services to receive providers **and
persistence adapters** through typed dependencies." `services/persistence/`
is still its M3-001 placeholder (`export {};`) — no task in Milestone 3
implements a Persistence Service, and persistence/cloud sync is
explicitly scoped to a later milestone (`06_TASKS.md`'s own milestone
overview: "Milestone 8 — Persistence, Authentication, Cloud
Synchronization & Import/Export"). There is no persistence adapter
anywhere in the codebase for a Service to receive as a typed dependency
today.

**Resolution applied**: none — no speculative `PersistenceAdapter`
interface was invented to fill the gap, since 06_TASKS.md gives no shape
for one and Milestone 8 is where that shape would actually be defined
against a real persistence mechanism (local storage vs. Supabase, per
`04_BUILD_GUIDE.md`'s "MANUAL MODE" / "VERSION 1 INTEGRATIONS" sections).
M3-013's other stated Goals (testability, avoiding hardcoded
infrastructure, provider replacement) were verified against the two
Services M3-013 actually lists as Dependencies (M3-007, M3-008), both of
which already satisfy them structurally — see Batch 9's write-up. Action
needed: either `06_TASKS.md` clarifies that M3-013's "persistence
adapters" mention is forward-looking (to be revisited once Milestone 8
defines a real persistence layer), or a future task should formally
introduce a `PersistenceAdapter` interface at the point Milestone 8
actually builds one.

---

### 22. M4-001 names "Settings" as a required Portfolio field, but no task anywhere defines its concrete shape

Found while implementing Milestone 4 Batch 1 (M4-001). M4-001's own
"Include" list names "Settings" alongside identity/name/description/
currency/positions/timestamps, with no field definition. M4-005
("Optional safety targets") and M4-006 ("Default display settings,"
"Safety target settings") both reference the concept later but define no
concrete fields either. The only concrete field list anywhere in the
documentation resembling this is 03_UI.md's Settings page → "PORTFOLIO"
section (Default Target Health Factor, Default Holding Period, Default
BTC Target Price, Default Safety Buffer, Default Portfolio Name) —
explicitly described there as _global application defaults_ for new
portfolios/simulations, not stated to be a per-portfolio override
schema.

**Resolution applied**: `PortfolioSettings` (`types/portfolio.ts`)
models only `safetyTargets` (all fields optional), reusing the four
numeric field names from that global-defaults list, scoped
per-portfolio — the most conservative available interpretation (reusing
already-named fields rather than inventing new ones), matching M4-005's
own "Optional" wording. "Default display settings" has no field list
anywhere in the documentation and is not modeled at all. Action needed:
a product/engineering decision on (a) whether per-portfolio safety
targets really do mirror the global defaults list 1:1, and (b) what
"default display settings" concretely contains, before M4-006
(Portfolio Details Form) needs to render editable fields for either.

---

### 23. 03_UI.md's own page inventory has no room for a "Portfolio List" page, but Milestone 4 requires multiple portfolios

Found while implementing Milestone 4 Batch 2 (M4-004). 03_UI.md's
"APPLICATION STRUCTURE" states plainly: "ProfitPilot consists of six
primary pages" (Dashboard, Portfolio, Simulation, Loop Builder, Exit
Planner, Settings), and "NAVIGATION HIERARCHY" lists exactly those six
as the sidebar's contents. The existing `/portfolio` route is already
spoken for by 03_UI.md's own "PORTFOLIO PAGE" section, a single-portfolio
detail view ("Display complete asset information... answers 'What do I
own?'"), not a browsing/list surface. Yet Milestone 4's own objective is
explicit: "Version 1 must support multiple portfolios," and M4-004
requires "Implement Portfolio List Page." 03_UI.md was seemingly written
assuming one portfolio in view at a time — its Top Navigation section
names "Current Portfolio Name" as a display element, implying a single
active-portfolio mental model, not a multi-portfolio browsing UI.

**Resolution applied**: `app/portfolios/page.tsx` (plural) hosts the
List Page at its own route, but is **not** added to
`constants/navigation.ts`/the sidebar — doing so would directly
contradict "six primary pages." Instead it's reached via a switcher
built into `AppHeader` (M4-010), the Top Navigation location 03_UI.md
already names for portfolio-identity display. This keeps the sidebar's
six items intact while still giving M4-004's DoD ("Users can identify
and open any saved portfolio") a real, reachable page. Action needed: a
product/engineering decision on whether `/portfolios` should ever become
an eighth sidebar-navigable page (contradicting 03_UI.md's explicit page
count) or remain switcher-only, as built here.

---

### 24. M4-005's "Protocol parameters or preset" names a preset option, but no preset values exist anywhere in the documentation

Found while implementing Milestone 4 Batch 3 (M4-005). The task's own
"Collect" list includes "Protocol parameters **or preset**," implying
users should be able to choose a predefined parameter set (e.g., "Aave
V3 defaults") instead of typing every value manually. No such values —
a concrete `maxLoanToValue`/`liquidationThreshold`/`borrowApr`/
`supplyApr` for any real protocol — appear anywhere in the entire
documentation set. 04_BUILD_GUIDE.md's "PROTOCOL SERVICE" section names
the _required fields_ a preset would need but gives no numbers, and the
only place such values would legitimately originate — an
`AaveV3Provider` — has never been built (the same unbuilt
infrastructure-layer gap identified repeatedly across Milestone 3
batches: `services/protocol/quote.ts` never hardcodes provider-specific
values either, by the same reasoning).

**Resolution applied**: the Creation Flow (`app/portfolios/new/page.tsx`)
offers manual entry only, clearly labeled "Protocol parameters (manual
entry — no preset available)." Inventing a specific preset number would
mean fabricating real-world financial data the specification never
states — the same discipline applied throughout this project to
undocumented numeric business rules. Action needed: a product decision
on what "the" Aave V3 preset values should be (and where they'd be
sourced/maintained/kept current) before a preset option can be built.

---

### 25. M4-008 names "Price" and "Rate type" as debt-position fields, but neither has any counterpart in the actual data model

Found while implementing Milestone 4 Batch 4 (M4-008). The task's own
"Fields" list is "Asset, Debt amount, Price, Borrow rate, Rate type" —
mirroring M4-007's collateral fields (which do each have a real
counterpart: quantity, price source, manual price, LTV, threshold). For
debt, two of the five have no real counterpart anywhere:

- **"Price"**: `calculateDebtValue` (F-003, `engine/portfolio/calculateDebtValue.ts`)'s
  own equation is "Debt Value = Borrowed Stablecoins" — a hard 1:1 USD
  peg, with no price parameter accepted by the formula at all. There is
  nothing for an editable "Price" field to control.
- **"Rate type"**: no value domain (Fixed/Variable, or anything else)
  is defined anywhere in `01_PRD.md`, `02_Formulas.md`,
  `04_BUILD_GUIDE.md`, or `06_TASKS.md`. The Engine work that would
  naturally house a fixed-vs-variable interest distinction —
  M2-013/M2-014, "Implement Compound Interest"/"Implement Variable Rate
  Projection" — was formally blocked and never implemented (conflict
  #7). There is no Engine behavior for a "Rate type" control to affect
  even if one were built.

**Resolution applied**: "Price" is rendered as read-only informational
text stating the 1:1 peg assumption explicitly (a real, textually-cited
fact — not an editable field with nothing behind it). "Rate type" is not
rendered at all, since unlike "Price" there is no grounded value to
display even informationally. Action needed: a product/engineering
decision on whether "Price" ever needs to become real (i.e., Version 1
supports a non-pegged or multi-stablecoin debt model, which would be an
Engine-level change to F-003 itself) and what "Rate type" is even
supposed to mean, before either can move past being a documented gap.

---

### 26. M4-009's DoD requires confirmation for "risk-increasing" changes, but no such term is defined anywhere

Found while implementing Milestone 4 Batch 5 (M4-009). The task's own
DoD is "Risk-increasing changes require explicit confirmation after
preview," and Milestone 4's acceptance criteria repeat "Risk-increasing
actions provide previews" — but neither `01_PRD.md`, `02_Formulas.md`,
`04_BUILD_GUIDE.md`, nor `06_TASKS.md` defines what makes a change
"risk-increasing": no threshold (e.g., "Health Factor drops below
X"), no band/classification system, no scoring rule. The term is used
as if its meaning were already established elsewhere in the
specification, but it is not.

**Resolution applied**: per explicit instruction not to invent risk
bands, labels, or thresholds, resolved with the most conservative
possible reading available — a directional comparison, not a
classification system. A change is "risk-increasing" exactly when it
strictly lowers Health Factor (`isRiskIncreasing`,
`app/portfolio/page.tsx`): `after.healthFactor < before.healthFactor`.
Both values already come from `calculatePortfolioSummary` (M3-005); no
new formula, scoring rule, or numeric boundary was introduced. This
correctly triggers confirmation for the two clearest real cases
(withdrawing collateral, increasing debt) without asserting anything
about _how much_ riskier a change is, which the specification never
states. Action needed: a product/engineering decision on whether a
finer-grained classification (e.g., magnitude-based, LTV-based, or
tied to the user's own Safety Target settings from M4-006) is ever
required, versus this directional check being sufficient permanently.

---

### 27. M4-012 never says whether an archived portfolio remains independently selectable

Found while implementing Milestone 4 Batch 6 (M4-012). The task's own
text says Archive should "Hide from active lists while retaining data,"
and its DoD requires archive/delete actions to be "recoverable where
documented." Neither `06_TASKS.md` nor 03_UI.md says whether a user can
still directly select (make active) an archived portfolio while it
remains archived — e.g. by leaving it reachable in the `AppHeader`
switcher, or by making its Portfolio List row still clickable to
navigate to `/portfolio`.

**Resolution applied**: resolved conservatively in favor of internal
consistency with "hide from active lists" — an archived portfolio is
**not** independently selectable. `AppHeader`'s switcher excludes
archived portfolios (matching the Portfolio List Page's own main-list
filtering), and an archived row's name/summary renders as plain text,
not a clickable select control, in `app/portfolios/page.tsx`. The Store
itself doesn't prevent calling `select()` on an archived portfolio's id
directly (no restriction was added to `select` itself, to avoid
scope-creeping a business rule into a Store action M4-003 already
defined), but no UI path in this batch offers that as a click target.
Restoring access requires "Unarchive" first, then the normal switcher/
list selection — the only way M4-012's text itself names ("Hide... while
retaining data" implies data comes back via an explicit un-hide, not a
side door). Action needed: a product decision on whether users should
ever be able to _view_ (not edit) an archived portfolio's detail page
without unarchiving it first — nothing in the current documentation asks
for or against this.

---

### 28. M4-013 requires "auto-save," but M4-009 requires the opposite (explicit confirmation) for the same fields — and two of M4-013's four DoD states cannot be genuinely built

Found while implementing Milestone 4 Batch 8 (M4-013). Two distinct
problems, both resolved without inventing new behavior:

**(a) Auto-save vs. confirmation.** `04_BUILD_GUIDE.md`'s "AUTO SAVE"
section states broadly that "ProfitPilot automatically saves Portfolio
changes," with no field-level exception, and M4-013 names M4-007/M4-008
(Collateral/Debt Position Management) as Dependencies — suggesting
auto-save should extend there. But M4-009's own DoD ("Risk-increasing
changes require explicit confirmation after preview"), already
implemented and approved across Batches 4–5, requires an explicit
Preview → Apply → (conditional) risk-acknowledgment step for exactly
those same fields. Auto-saving them would silently apply changes —
including risk-increasing ones — before any confirmation, deleting the
mechanism M4-009 required.

**Resolution applied**: kept auto-save (debounce) scoped to
`PortfolioDetailsForm` (M4-006) only, unchanged since Batch 3 — its
fields (name/description/currency/safety targets) carry no
risk-increasing meaning. The Collateral/Debt Position Management forms
keep their explicit Preview/Apply gate. This resolves a genuine tension
between two documented principles by keeping the more specific,
already-implemented, already-approved rule rather than regressing it to
satisfy a more general statement — the same kind of resolution applied
throughout this project (specific, tested behavior over an unqualified
general one). Action needed: a product decision on whether M4-013's
Dependencies list should be corrected to drop M4-007/M4-008, since
auto-save was never actually extended to them and — given M4-009 — never
should be without a further, explicit product decision to relax the
confirmation requirement.

**(b) Two of the DoD's four named states ("saved, saving, offline, and
failed") cannot be genuinely built.** `'saving'` and `'error'`/`'failed'`
are real and implemented (`stores/portfolioStore.ts`'s `saveStatus`
field now transitions through both). `'offline'` and a fully
user-observable `'saving'` are not:

- This Store makes no network requests at all — "offline" has no actual
  effect on its behavior (saves are equally instantaneous online or
  offline, since "save" means committing to in-memory state, not
  reaching a server). Wiring `navigator.onLine` to `saveStatus` would be
  real, working code that tells the user something false ("your changes
  aren't saved because you're offline"). Not built, because building it
  would actively mislead, not merely because it was skipped.
- Every mutation is a synchronous in-memory write with no I/O to await,
  so `'saving'` is set and then immediately overwritten by `'saved'`/
  `'error'` within the same JavaScript call, before React ever paints
  it. It is implemented as a real state-machine transition (verifiable
  via direct Store subscription) for correctness, but no artificial
  delay was added to make it visibly renderable — that would fabricate
  latency this Store does not have.

**Resolution applied**: implemented exactly the two DoD states that are
real (`'saved'`, `'error'`), left `'offline'` permanently unreachable,
and implemented `'saving'` as a real-but-typically-unobservable
transition — all documented rather than faked, the same treatment
`loadStatus`/`lastSynchronizedAt` already received under Conflict B in
Batch 1. Action needed: a product decision on whether M4-013's DoD
should be revised to name only the states this synchronous, in-memory
architecture can actually produce, given no real persistence layer
exists before Milestone 8.

### 29. `generateRecommendationSet`'s required `RecommendationRuleConfig` has no portfolio-level source for 5 of its 7 fields, and no documented defaults — found while implementing Milestone 5 Batch 4 (M5-007, M5-009)

Both M5-007 ("Required action to restore target where available") and
M5-009 ("Debt repayment required for target safety" / "Collateral
addition required for target safety") need a recommendation-style action
computed from the portfolio's own data. The obvious candidate,
`generateRecommendationSet` (M3-012), requires a complete
`RecommendationRuleConfig` as one non-optional object:
`borrow.userMinHealthFactor`, `borrow.targetDebtRatio`,
`repayment.targetHealthFactor`, `additionalCollateral.targetHealthFactor`,
`loop.targetHealthFactor`, `loop.loopBorrowPercentage`,
`loop.maxAcceptableAnnualInterestCost` — seven fields, five of which
(everything except the two `targetHealthFactor` fields) have no source
anywhere on `Portfolio`/`PortfolioSettings` and no documented default
value anywhere in the specification (that Service's own header comment
already flags this as a deliberate "never fabricate what the Service
doesn't own" design choice — M3-012 always required its caller to supply
these, and no later task has ever defined where a Dashboard-level caller
should get them from).

**Resolution applied — narrower, not the same capability**: rather than
inventing values for the other five fields (which would silently
misrepresent user preferences nothing documented), added a new, smaller
Service (`calculateTargetHealthFactorActions`,
`services/recommendation/targetHealthFactorActions.ts`) that composes
only the two already-public Engine functions needing solely
`{ portfolio, targetHealthFactor }` — `calculateRepaymentRecommendation`
(F-062) and `calculateAdditionalCollateralRecommendation` (F-063), both
already exported from `@/engine`'s M2-031 curated barrel, previously only
called internally by `generateRecommendations`'s own four-rule
composition. `targetHealthFactor` comes from the portfolio's own,
already-real `settings.safetyTargets.targetHealthFactor` (M4-001) — both
Dashboard sections only compute a "required action" when a portfolio
actually has that field set, matching M5-007's own "where available"
wording literally. This is a real capability with a genuine (if narrower)
scope, not a workaround — it answers "what would restore my configured
target?", not the full four-category recommendation set
`generateRecommendationSet` answers.

Action needed: a product decision on whether `borrow`/`loop`
recommendations should ever be automatically Dashboard-driven (M5-015,
"Implement Recommendation Summary," is the later, still-unbuilt task that
will need to resolve exactly this — either by collecting
`userMinHealthFactor`/`targetDebtRatio`/`loopBorrowPercentage`/
`maxAcceptableAnnualInterestCost` as additional portfolio settings, or by
defining documented default values for them, or by scoping M5-015 to
only the repayment/additionalCollateral categories this batch's new
Service already supports).

---

### 30. `03_UI.md` Page 3 ("Dashboard Design & Portfolio Overview") describes an entirely different, never-built Dashboard design — found while performing the final M5-028 audit (Milestone 5 Batch 18)

**This is the largest single documentation/implementation gap found in
this entire engagement, and the reason M5-028 ("Validate Dashboard
Against UI Specification") exists.** `03_UI.md` is organized as 10
sequential "pages" (its own Document Index, near end of file, names each
one); Page 3 is literally titled "Dashboard" and is the only page whose
purpose is to specify this exact screen. Its own `PAGE LAYOUT` and
`SECTION 1`–`SECTION 7` content describes a design that shares almost no
vocabulary with `06_TASKS.md`'s own M5-001–M5-024 task list — the
specification this entire Milestone 5 build (Batches 1–17) has correctly
followed, task by task, citing each task's own literal text throughout:

| Page 3 (`03_UI.md`) names                                                                                                            | `06_TASKS.md` (M5-xxx) actually specifies                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Market Snapshot" (BTC Price, 24 Hour Change, Borrow/Supply APR, HF, "Portfolio Status")                                             | No task named "Market Snapshot"; no "24 Hour Change" anywhere — no historical price data source exists (Manual Mode, `services/market/quote.ts`)                                                                                                                                        |
| "Portfolio Summary" cards: Portfolio Value, Net Worth, Total BTC, Current Debt, Effective Leverage, **Portfolio Score**              | M5-006's own "Cards" list (built exactly as `DashboardKpiGrid`): Net portfolio value, Total collateral, Total debt, Health Factor, Current LTV, Effective leverage, Annual interest cost, Liquidation price — no "Portfolio Score" anywhere                                             |
| "Health & Risk": Health Factor, Liquidation Price, Distance to Liquidation, Current LTV, **Risk Category**, **Health Factor Gauge**  | M5-007/M5-009's own Display/Cards lists — no "Risk Category" (blocked by Conflict #1, never invented) and no "Health Factor Gauge" visual widget anywhere                                                                                                                               |
| **"Position Timeline"**: 30/90/180/365-day chart of Projected Debt, Interest Paid, Health Factor, Liquidation Price, Portfolio Value | No task named "Position Timeline" or equivalent chart exists anywhere in M5-001–M5-028; would require historical/projected time-series data with no documented source (Conflict B: no persistence; Conflict #7: no documented compound-interest formula for any projection)             |
| **"Recent Activity"**: a timestamped event log (BTC Price Updated, Debt Repaid, etc.)                                                | No task named "Recent Activity" or an activity/event log exists anywhere; no persistence infrastructure exists to store such a log (Conflict B)                                                                                                                                         |
| "Quick Actions": Run Simulation, Build Loop, Exit Planner, Refresh Portfolio, **Settings**                                           | M5-016's own Buttons list (built exactly as `QuickActionsSection`): Edit portfolio, Run simulation, Build loop strategy, Create exit plan, Update prices, Export portfolio — no direct "Settings" shortcut                                                                              |
| "Empty Dashboard": Welcome Message, **Import Existing Portfolio**, Create New Portfolio, **Example Portfolio**                       | M5-020's own DoD ("explains the missing requirement and provides a clear action") — built as "No portfolio is currently selected" + "Select or create one." No Import or Example-Portfolio feature exists anywhere in the application (Milestone 4 never built portfolio import either) |

**Why `06_TASKS.md` is treated as authoritative here, not Page 3** —
the same reasoning this engagement has applied to every prior
`03_UI.md` vs. `06_TASKS.md` mismatch, made explicit for the first time
at this scale: `06_TASKS.md`'s own M5-006 "Cards" list matches the
actually-built `DashboardKpiGrid` exactly, field for field; Page 3's own
"SECTION 2" card list does not match either document precisely — it is
its own third variant. This, plus the complete absence of any task
building a Position Timeline, Recent Activity log, Portfolio Score, or
Risk Category anywhere across 28 Milestone-5 tasks, indicates Page 3 is
an earlier design draft that was superseded when `06_TASKS.md`'s own
task list was written, and was never updated to match — not a
requirement this build silently dropped. Retrofitting the Dashboard to
match Page 3 literally would mean inventing an entire historical-data
subsystem with no documented storage or projection formula (violating
Conflict B and Conflict #7 at once) for an "M"-effort audit task whose
own dependency chain (M5-027) never asked for one.

**What Page 3's smaller, cross-cutting rules were individually checked
against** (not assumed correct just because the page-level structure is
stale) — see the Batch 18 write-up in the Milestone 5 progress section
above for the full per-item audit: `CARD DESIGN`, `TOOLTIPS`, `DASHBOARD
REFRESH`, `EMPTY DASHBOARD`, `ERROR HANDLING`, and `DESIGN RULES` were
each verified individually; one real, small, fixable gap was found
(`TOOLTIPS`: two panels had no Formula ID tooltips) and fixed this
batch. Page 10's own "MOBILE EXPERIENCE" note ("Essential Features
Only" on mobile) also conflicts with M5-023's own literal DoD ("All
Dashboard functionality remains usable on mobile") — resolved the same
way, in favor of the already-built, already-tested `06_TASKS.md`
requirement.

**No code changes were made to reconcile Page 3 itself** — that would
require a product decision (rewrite Page 3 to match the as-built
Dashboard, or treat it as historical and mark it superseded), not an
engineering one. Flagging for that decision, consistent with how every
other unresolved conflict in this list is handled.

---

## Deviations from a literal reading of the docs (all mechanical, none touch business logic or specification content)

- **shadcn/ui**: the `shadcn` CLI's `init` command calls `ui.shadcn.com`,
  which this sandbox's network policy blocks (`403` at the proxy). Ran the
  equivalent manual setup instead — `components.json` (classic schema),
  `utils/cn.ts` (the `cn()` helper), `class-variance-authority` / `clsx` /
  `tailwind-merge` / `tw-animate-css` installed, CSS variables added to
  `app/globals.css`. No shadcn components have been generated yet (none were
  needed for Milestone 1); the next component added via the CLI should work
  normally assuming the same network restriction doesn't apply then, or can
  be added by hand following the same convention.
- **Editor format-on-save**: `06_TASKS.md` M1-004 lists "Format-on-save" as
  a deliverable. This is normally committed as `.vscode/settings.json`;
  that step was declined during implementation, so format-on-save is
  documented in `CONTRIBUTING.md` (`pnpm format`) but not enforced via a
  committed editor config.
- **`vite-tsconfig-paths`**: initially added for path-alias resolution in
  Vitest, then removed in favor of Vitest 4's native `resolve.tsconfigPaths`
  option once it became clear the plugin was redundant. One fewer
  dependency than a literal reading of "install Vitest" might imply; not a
  documented package, so no conflict.
- **pnpm ignored build scripts**: `sharp`, `unrs-resolver`, and
  `@sentry/cli` have native postinstall scripts that pnpm blocks by default
  (security default, not an error). Left unapproved — lint/build/test all
  pass without them, and running `@sentry/cli`'s installer isn't needed
  without a configured Sentry project.

## Explicitly not done (per instruction)

- **No Vercel project created or modified** (M1-009 deferred).
- **No Supabase project/account created.** `@supabase/supabase-js` is
  installed (M1-002) but not initialized anywhere; `supabase/` directory is
  an empty placeholder for Milestone 8.
- **No Sentry project/account created.** `@sentry/nextjs` is installed
  (M1-002) but not initialized/configured; no DSN, no `sentry.*.config.ts`,
  no `next.config.ts` wrapping.
- **No specification document (`docs/*.md`, `README.md`) was modified.**
  Both are explicitly excluded from Prettier's scope (`.prettierignore`) so
  tooling can never reformat them as a side effect.
- **No commit or push performed.** The working tree contains only unstaged
  changes.

---

## Next task

1. **M1-009 (Deploy Initial Application)** remains deferred — no Vercel
   project created, per instruction.
2. **This pass stops here for approval** of Milestone 6 Batch 12
   (M6-013 — Simulation Assumptions Panel) before committing, per
   instruction. Batches 1–11 (M6-001–M6-012) are synchronized to
   GitHub; Milestone 5 (M5-001–M5-007, M5-009–M5-028, excluding
   M5-008) is complete and synchronized, with a permanent snapshot in
   `MILESTONE_5_COMPLETION.md`.
3. **Milestone 4 is complete and synchronized to GitHub.** All 18 tasks
   (M4-001 through M4-018) addressed; a permanent snapshot lives in
   `MILESTONE_4_COMPLETION.md` (committed and synchronized separately,
   before this milestone's own work began). Its three conflict decisions
   remain resolved exactly as established: Conflict A (single
   collateral/single debt position) was never violated across all 18
   tasks; Conflict B (no interim persistence) was upheld throughout;
   Conflict C (resolve Conflict #20 before any M4 batch needing zero-debt
   support) was satisfied by Batch 0 before any dependent batch began.
   Both conflicts continue to apply unchanged to Milestone 5's own work —
   the Dashboard reads the Store's existing single-position,
   in-memory-only `Portfolio` records, adding no new position model or
   persistence mechanism.
4. **Milestone 5 — Dashboard is complete and synchronized to
   GitHub.** All 18 batches (M5-001–M5-007, M5-009–M5-028, excluding
   M5-008) are synchronized; a permanent snapshot lives in
   `MILESTONE_5_COMPLETION.md`. **M5-008 remains wholly unbuilt**,
   still blocked on Conflict #1 (the only formally, permanently
   blocked task in the milestone). Milestone 5 found and documented
   **Conflict #30**: `03_UI.md`'s own Page 3 Dashboard mockup describes
   an entirely different, never-built design (a Position Timeline
   chart, a Recent Activity log, a Portfolio Score) than the
   `06_TASKS.md`-driven Dashboard this milestone actually built —
   resolved in favor of `06_TASKS.md` (the spec this whole build has
   correctly followed throughout), not retrofitted, and flagged for a
   product decision on Page 3 itself.
5. **Milestone 6 — Simulation Workspace is in progress.** Batches 1–11
   (Simulation Foundation: M6-001, M6-002; Simulation Store: M6-003;
   Scenario Builder: M6-004; Price Scenario Simulation: M6-005;
   Portfolio Action Simulation: M6-008; Interest Rate Simulation:
   M6-006; Time Projection: M6-007; Scenario Summary: M6-009; Scenario
   Comparison: M6-010; Scenario Charts: M6-011; Scenario Timeline:
   M6-012) are synchronized to GitHub; Batch 12 (Simulation Assumptions
   Panel: M6-013) is implemented and awaiting approval. The Simulation
   Engine/Service layer this milestone's UI consumes already exists
   from Milestones
   2–3 (`engine/simulation/`, `services/simulation/scenario.ts`) —
   `stores/simulationStore.ts` and `ScenarioBuilder.tsx` call it
   directly, no second calculation path; Batch 4 specifically confirmed
   and followed `04_BUILD_GUIDE.md`'s own "Only services communicate
   directly with the Formula Engine" rule when designing the
   preset-scenario buttons. Batch 5 added the milestone's first
   genuinely new Service function (`simulatePortfolioAction`, composing
   only already-public Service calls) and, while running that batch's
   mandatory `pnpm test:e2e`, found and fixed a real pre-existing e2e
   test bug that had been silently present (but not reliably caught)
   since Batch 1 — see the Batch 5 write-up for the full timing
   analysis. Batch 6 found a genuine DoD/dependency-graph tension:
   M6-006's own DoD ("Users understand the cost implications of
   changing rates") reads as requiring a display, but M6-009's own
   `Dependencies` name only M6-005/M6-008, not M6-006 — this was
   resolved retroactively in Batch 8 (`currentResult` is rendered
   generically regardless of scenario type, so the interest-scenario
   `debtCost` now displays too, even though M6-009's own dependency
   list never formally named M6-006). Batch 7 closed the live-update
   gap Batch 6 deliberately left open (Holding Period changes now
   re-trigger an already-active interest scenario) with zero
   Engine/Service/Store changes. Batch 8 found and fixed a real display
   bug during its own mandatory manual browser verification — an early
   `ScenarioSummary` draft assumed `currentResult`/`portfolioActionPreview`
   are "never both" populated, which real browser testing disproved;
   both now render together — and documented two remaining gaps (Debt
   and Liquidation Price are unavailable for price/interest scenario
   display, only for portfolio actions) rather than fabricating values
   for either. Batch 9 found the same two documented gaps recur for
   `ScenarioComparison` (carried forward, not re-litigated) plus a new
   one: no "Save Scenario" UI exists anywhere yet (M6-015's own later,
   separate task), so `savedScenarios` is honestly empty for every real
   user today — manual browser verification used a temporary,
   fully-reverted `window` debug hook to seed real saved scenarios via
   the Store's own already-real `saveCurrentScenario` action, confirmed
   removed via a clean `git diff` on `stores/simulationStore.ts` before
   finalizing. Batch 10 found a significant, milestone-wide gap while
   investigating why its own new chart component showed no coverage
   row: `vitest.config.ts`'s coverage `include` list never contained
   `features/simulation/**`/`app/simulation/**`, meaning every
   "X% covered" claim about Simulation files in Batches 1–9's own
   write-ups reflected files that were never measured at all, not files
   genuinely verified — fixed by adding both entries, which surfaced 4
   real, previously invisible gaps (3 closed with new tests, 1 left as
   genuinely unreachable defensive code, consistent with precedent
   elsewhere in the codebase). Batch 10 also reused the same "Save
   Scenario" gap and temporary debug-hook verification technique Batch
   9 established, and found the same recurring structural gap ("BTC
   exposure," alongside "Debt") for chart data specifically, since
   `saveCurrentScenario` never captures portfolio-action results.
   `03_UI.md` Page 5's own superseded-mockup pattern Conflict #30
   already found on Page 3 (a "Portfolio Score" card `06_TASKS.md`'s
   own M6-009/M6-010 Display/Compare lists do not name) remains open,
   per `MILESTONE_5_COMPLETION.md`'s own Section 8 recommendation.
   Batch 11 (M6-012, "Implement Scenario Timeline") added no new
   Formula Engine logic — `runTimelineProjection`
   (`stores/simulationStore.ts`) composes the already-public
   `simulateScenario` Service repeatedly at 5 evenly-spaced points
   (0/25/50/75/100% of the active interest scenario's own
   `timeHorizonDays`), a documented granularity choice since neither
   `06_TASKS.md` nor either spec document names a specific point count.
   `ScenarioTimeline.tsx` renders 3 `recharts` `LineChart`s (Portfolio
   Value, Health Factor, Interest Cost), the same `role="img"` +
   `aria-label` accessible-summary pattern `ScenarioCharts.tsx` (Batch 10) established, applied as consistent practice since M6-012 —
   unlike M6-011 — names no `Requirements` section at all. This batch
   also required a mid-batch recovery: after implementation and
   validation were complete, the local working tree unexpectedly
   reverted to an earlier commit, deleting the batch's uncommitted work;
   a fresh `git fetch` confirmed `origin/main` itself was unaffected,
   the local branch was re-synced to it, and the implementation was
   redone from scratch and re-validated, reproducing identical results.
   Manual browser verification needed no temporary debug hook: the
   timeline is driven entirely by the already-real Borrow Rate/Holding
   Period fields on an active interest scenario, fully reachable through
   real UI interaction alone. Batch 12 (M6-013, "Implement Simulation
   Assumptions Panel") reused conflict #8 (no Formula ID for swap
   fees/slippage, already established twice in Milestone 2) rather than
   rediscovering it, and required a Store change of its own:
   `ServiceMetadata` was being silently discarded by both
   `runSimulation`/`runPortfolioActionSimulation` — the same class of
   gap `warnings` had before Batch 9 — fixed by a new shared
   `lastMetadata` field, set on success and cleared on failure, left
   untouched by `runTimelineProjection` for the same reason `warnings`
   already is. "Rate Assumptions" (the simulated Borrow APR/horizon)
   was kept deliberately distinct from "Protocol Parameters" (the
   portfolio's own currently configured Borrow APR), verified in manual
   browser testing to genuinely differ (5% configured vs. 10% simulated)
   rather than duplicating one number under two labels. No dedicated
   "Assumptions Panel" mockup exists in `03_UI.md` Page 5 — only two
   passing mentions — so `06_TASKS.md`'s own literal Include list was
   the sole source of truth, the same precedent Batch 10 already
   established for an un-mocked task.
6. **Batch 2 raised no new numbered conflict, but recorded one deliberate
   scoping decision worth flagging**: `SavedSimulation` (`stores/simulationStore.ts`)
   deliberately carries only `id`/`scenario`/`result`/`createdAt`, not
   `name`/`description`/a portfolio reference — those three fields are
   M6-015's ("Save Simulation") own explicit "Include" list, a separate,
   later task. Building its full field shape now would have been
   inventing that later task's own scope, the same discipline
   `services/portfolio/models.ts` already established for
   `ApplicationPortfolio` vs. M4-001.
7. **Batch 3 raised no new numbered conflict, but recorded two deliberate
   scoping decisions worth flagging**: `ScenarioBuilder.tsx`'s own
   "Collateral"/"Debt" fields are each one signed delta, not four
   separate directional fields, to keep M6-004's own literal 6-field
   count intact; and only BTC Price is wired to a real calculation this
   batch, since M6-004's own `Dependencies` name only M3-009 and the
   other five fields each belong to their own later, dedicated task
   (M6-006/M6-007/M6-008) — except Target Health Factor, which no later
   Milestone 6 task names as an input anywhere, a genuine specification
   gap found while cross-referencing all 26 Milestone 6 tasks, not
   silently resolved either way.
8. **Batch 4 raised no new numbered conflict, but recorded two
   deliberate scoping decisions worth flagging**: 8 BTC Price presets
   are built, not `03_UI.md` Page 5's own 7 — `01_PRD.md` REQ-004-A's
   own "Required Presets" list additionally names `-50%`, resolved in
   its favor as the stronger, explicitly-"Required" claim rather than
   silently dropping the one preset the two documents disagree on; and
   no resolved dollar price is shown next to each percentage preset —
   doing so would require either importing `resolveScenarioPrice`
   (F-051) directly from `@/engine` into UI code (forbidden by
   `04_BUILD_GUIDE.md`'s own "Only services communicate directly with
   the Formula Engine" rule) or re-deriving that same formula a second
   time in the UI layer (a duplicated calculation) — deferred to
   M6-009's own later Scenario Summary display instead.
9. **Batch 5 (M6-008) raised no new numbered conflict, but found and
   fixed one real, pre-existing e2e test bug during this batch's own
   mandatory validation pipeline.** `tests/e2e/dashboardWorkflows.spec.ts`'s
   "Navigate to Simulation Workspace" test (M5-027) asserted a heading
   query without `exact: true`, which became ambiguous once Milestone 6
   Batch 1 added a second, legitimately named "Simulation Results"
   heading to `/simulation` — a genuine regression introduced back in
   Batch 1 that Batches 1, 3, and 4's own "35/35 unchanged" e2e results
   never reliably caught, since the strict-mode violation only manifests
   under certain rendering-timing conditions (confirmed
   deterministically reproducible under default parallel-worker load,
   never reproduced under `--workers=1`). Fixed with a one-line,
   test-only precision fix; not a product or Engine/Service change. Full
   analysis in the Batch 5 write-up above.
10. **Batch 6 (M6-006) raised two documented conflicts, neither
    silently resolved.** First: M6-006's own DoD ("Users understand the
    cost implications of changing rates") reads as requiring a visible
    display, but no display was built this batch — `M6-009` is the one
    dedicated Scenario Summary task, and its own `Dependencies` name
    only `M6-005`/`M6-008`, not `M6-006`, a genuine task-graph
    inconsistency flagged for correction when M6-009 is reached, rather
    than built ad hoc here and fragmented across two display
    mechanisms. Second: `01_PRD.md` REQ-004-E's own "Supply APR" input
    has no home anywhere in the actual Engine/Service layer
    (`simulateInterestScenario`'s own `InterestScenarioParams` never had
    it, and `06_TASKS.md`'s own M6-006 Include list never names it
    either) — resolved in favor of `06_TASKS.md`, the same
    authoritative-build-driver precedent every other PRD/Tasks gap in
    this engagement has followed; not built, and not a Milestone 2
    Engine change.
11. **Batch 7 (M6-007) raised no new numbered conflict.** Its own DoD
    ("Time assumptions are clearly displayed") was reasoned through
    explicitly rather than assumed satisfied or deferred like Batch 6's
    own DoD: the Holding Period selector and Custom Holding Period Days
    input (Batch 3) are themselves real, always-visible controls, so no
    new display element was needed — a genuinely different outcome from
    Batch 6's own still-open display gap, not the same pattern applied
    twice. Zero Engine/Service/Store files changed.
12. **Batch 8 (M6-009) found and fixed one real display bug during its
    own mandatory manual browser verification, and documented two
    remaining field-availability gaps.** An early `ScenarioSummary`
    draft rendered `currentResult`/`portfolioActionPreview` with an
    "if one, else the other" branch, reasoning the two are "never both"
    populated — real browser testing (touching a price field, then a
    Collateral Change field, in one session) disproved this: both
    Store actions are genuinely independent (Batch 5's own design) and
    neither clears the other's field, so the branch was silently
    hiding a real, calculated Portfolio Action result whenever a price
    scenario had run first. Fixed by rendering both sections together,
    each under its own heading, with a regression test added. Separately,
    two of M6-009's own 8 Display items — Debt and Liquidation Price —
    have no home in `ScenarioSummary` (the Engine type behind
    price/interest results, `engine/simulation/compareScenarios.ts`),
    only in the richer `PortfolioSummary` behind portfolio-action
    results — documented as a genuine gap rather than derived via
    duplicated Formula Engine logic in the UI or built by widening a
    completed Milestone 2 Engine type.
13. **Batch 9 (M6-010) raised no new numbered conflict, but recorded a
    load-bearing functional gap: no "Save Scenario" UI exists anywhere
    in the app.** `06_TASKS.md` M6-015 ("Save Simulation") is a
    separate, later, P1 task that owns building it; `savedScenarios`
    (Batch 2) is real but honestly empty for every user until M6-015
    lands, which `ScenarioComparison`'s own empty state says explicitly.
    Manual browser verification of the populated comparison table used
    a temporary `window.__simStoreDebug` hook in
    `stores/simulationStore.ts` to seed real saved scenarios via the
    Store's own `saveCurrentScenario` action — removed completely
    before finalizing, confirmed via an empty `git diff` on that file.
    "Risk" (M6-010's 7th `Compare` item) is blocked by Conflict #1, the
    same Health Factor risk-band classification blocked since Milestone
    5; "Debt"/"Liquidation price" recur as the same two documented gaps
    Batch 8 already found in `ScenarioSummary`, not new ones.
14. **Batch 10 (M6-011) found and fixed a significant, milestone-wide
    coverage measurement gap, not a new conflict.** `vitest.config.ts`'s
    coverage `include` list never contained
    `features/simulation/**`/`app/simulation/**` since Milestone 6
    began — every prior batch's own "X% covered" claims about
    Simulation files reflected files that were never measured, not
    files genuinely verified as covered. Fixed by adding both entries;
    this surfaced 4 real, previously invisible gaps (3 closed with new
    tests this batch — Target Health Factor's error/onChange paths, the
    Percentage-Change-cleared-to-empty path, and the "Interest
    Scenario" label branch in `ScenarioComparison`/`ScenarioCharts`; 1
    left uncovered as genuinely unreachable defensive code in
    `ScenarioSummary.tsx`, consistent with precedent already accepted
    elsewhere in this codebase). Separately, "Debt" and "BTC exposure"
    (2 of M6-011's own 5 named chart targets) recur as a structural,
    permanent gap — `saveCurrentScenario` never captures
    portfolio-action results, so no saved-scenario path ever carries
    this data, unlike Batches 8/9's own gaps which resolve for
    portfolio-action results. Manual browser verification reused Batch
    9's own temporary `window.__simStoreDebug` seeding technique, again
    fully reverted and confirmed via an empty `git diff`.
15. **Batch 11 (M6-012) raised no new numbered conflict, but recorded
    one deliberate scoping decision worth flagging.** M6-012's own
    Description ("Display projected portfolio evolution across the
    selected time horizon") names no point count or spacing for the
    projection, and neither `02_Formulas.md` nor `03_UI.md` names a
    dedicated timeline/projection function anywhere — confirmed absent
    by grep across `engine/`/`services/` before design began. Resolved
    by composing the already-public `simulateScenario` Service function
    (M3-009) repeatedly at 5 evenly-spaced points (0/25/50/75/100% of
    the active interest scenario's own `timeHorizonDays`), holding
    `priceScenario`/`borrowApr` fixed — no new Formula Engine logic, the
    same "reuse, never invent" discipline this milestone has followed
    throughout. Also confirmed, before implementing, that
    `calculateProratedInterest` (F-030) accepts `days: 0` as a valid,
    non-erroring input via its own `validateTimePeriod` (a thin wrapper
    over `validateNonNegative`), so the timeline's first point needed no
    special-casing. Unlike M6-011, M6-012 has no `Requirements` section
    in `06_TASKS.md` — the same "Accessible alternatives" (`role="img"`
    - `aria-label`) and "Responsive" (`ResponsiveContainer`) treatment
      `ScenarioCharts.tsx` (Batch 10) established is still applied to
      `ScenarioTimeline.tsx` for internal consistency, not because M6-012
      itself names either as a requirement. Manual browser verification
      needed no temporary debug hook this time — the timeline is driven
      entirely by the already-real Borrow Rate/Holding Period fields on an
      active interest scenario, fully reachable through real UI
      interaction. A mid-batch working-tree reset also required redoing
      this batch's implementation from scratch on a re-synced base — see
      the Batch 11 write-up above for the recovery details.
16. **Batch 12 (M6-013) raised no new numbered conflict, but recorded
    one deliberate scoping decision and reused an existing one.**
    "Fees" and "Slippage" recur as the exact same conflict #8 gap
    (`engine/loop/calculateLoopCosts.ts`, `engine/exit/
calculateExitPosition.ts`) — confirmed by a fresh grep of
    `02_Formulas.md` before implementation, not assumed from memory —
    documented with the same wording those two Engine functions already
    use, rather than inventing new phrasing. The new scoping decision:
    "Price assumptions"/"Rate assumptions" are shown for both
    `currentResult` (price/interest scenarios) and `portfolioActionPreview`
    (portfolio actions), satisfying M6-013's own DoD ("Every simulation
    is fully transparent") literally, rather than scoping the whole
    panel to price/interest scenarios only the way `ScenarioTimeline`
    (Batch 11) scoped itself to interest scenarios only — a portfolio
    action's own "price assumption" (the current market price, used
    unmodified) is labeled explicitly rather than omitted or fabricated.
    Also required a Store change: `ServiceMetadata` (`engineVersion`,
    `formulaVersion`) was being silently discarded by both
    `runSimulation`/`runPortfolioActionSimulation` — the same class of
    gap `warnings` had before Batch 9 — fixed by capturing it in a new
    shared `lastMetadata` field, deliberately left untouched by
    `runTimelineProjection` for the same reason `warnings` already is
    (Batch 11).
17. **Batch 1 raised no new numbered conflict, but recorded one deliberate
    scoping decision worth flagging**: 03_UI.md's own Dashboard mockups
    name a `Portfolio Status`/`Risk Category` field (example values
    "Healthy"/"Low") that is exactly the Health Factor risk-band
    classification Conflict #1 already blocks — not built here.
    `DashboardMetric.status` was scoped to a structural `'ok' |
'unavailable'` value instead (derived only from whether a raw value is
    `null`), avoiding both inventing risk-band thresholds and silently
    dropping M5-003's own "Status classifications" Include item. Conflict
    #1 is very likely to become directly blocking once M5-007 (Health
    Factor Status Component) or M5-010 (Risk Warning Banner) is reached —
    flagged for the next batch that touches either.
18. **Batch 2 raised no new numbered conflict.** M5-004's "Portfolio
    switcher"/"Refresh action" Include items initially looked like they
    might require new UI or a live-data mechanism; both resolved by
    reusing already-shipped, real mechanisms instead (`AppHeader`'s
    existing switcher; `recomputeSummary` from M4-017) rather than
    duplicating or inventing anything — documented as scoping decisions in
    the Batch 2 write-up, not conflicts. Discovered and fixed one real gap
    in Batch 1's own `DashboardViewModel` while implementing this task:
    identity/freshness were previously only available in the `ok: true`
    branch, which would have hidden them exactly when M5-004's own DoD
    needed them most (a calculation failure) — restructured into a shared
    `DashboardViewModelBase`, additive only, all of Batch 1's tests still
    pass unchanged.
19. **Batch 3 raised no new numbered conflict.** M5-005's "Status" Support
    item was scoped wider (`'ok' | 'warning' | 'unavailable'`) than
    `DashboardMetric.status` itself (`'ok' | 'unavailable'`, Conflict #1
    avoidance) — the generic card supports all three per its own task
    text; no caller drives `'warning'` yet, and none will until Conflict
    #1 is resolved and M5-007/M5-010 can honestly compute a risk-based
    warning. M5-006's own 8-card list was read literally as excluding
    `liquidationDistance`/`liquidationBuffer` (both present in
    `DashboardMetrics` since Batch 1, both explicitly named as M5-009's
    own later content) — required a small, documented test update (one
    `"N/A (no debt)"` occurrence instead of three) since the KPI grid it
    replaced Batch 1's plain list, which had rendered all three.
20. **Batch 4 raised one new conflict (#29)**: `generateRecommendationSet`
    (M3-012) needs a full `RecommendationRuleConfig` with 5 fields no
    `Portfolio` field carries and no specification page defaults —
    discovered while trying to build M5-007's "Required action to restore
    target" and M5-009's "target safety" actions honestly. Resolved by
    adding a narrower new Service
    (`calculateTargetHealthFactorActions`) needing only the portfolio's
    own real `targetHealthFactor` setting, rather than inventing the other
    five fields — a real, working capability with a genuinely smaller
    scope than the blocked one, not a workaround. M5-008 and M5-010 (the
    other two Risk Sections tasks) were deliberately deferred rather than
    attempted partially — see the Batch 4 write-up's own opening
    paragraph for why each is scoped out this batch specifically, not
    silently dropped.
21. **Milestone 5 Batch 5 raised no new conflict — it independently
    re-confirmed Batch 4's M5-008/M5-010 conclusions, per instruction, by
    re-researching each Warning case individually rather than trusting
    the prior summary.** M5-008 remains wholly blocked (no partial
    subset). M5-010's "Health Factor near liquidation" was traced all the
    way to `LIQUIDATION_PROXIMITY` (`engine/loop/validateLoopStrategySafety.ts`)
    to check whether it offered a reusable proximity threshold — it
    turned out to check `healthFactor <= 1.0` (the liquidation boundary
    itself, not a "near" buffer) and is scoped to Loop Strategy inputs,
    confirming no invented threshold could be avoided there either.
    "Invalid protocol parameters" was confirmed structurally unreachable
    (not merely blocked) by tracing the Zod `.refine()` cross-field check
    through every Store mutation path. M5-011/M5-012 raised no gaps at
    all — "Portfolio percentage" (always 100%) and M5-012's "hide the
    chart" condition are both direct, mechanical consequences of Conflict
    A already approved in Milestone 4, not new interpretation.
22. **Batch 6 raised no new conflict — both of its two deliberately
    unbuilt items carry forward already-established decisions, not new
    gaps.** M5-013's "Projected debt where available" reuses Conflict
    #7's existing block (compound interest has no documented formula).
    M5-014's "Debt-to-equity ratio" reuses M2-008's own already-approved
    Milestone 2 decision to skip that exact sub-item ("no Formula ID ...
    would mean inventing a formula") — found by checking whether M2-008
    (the Engine-layer task this Dashboard section's Include list mirrors
    almost exactly) had already made this call, rather than
    re-deciding it from scratch. Also discovered, while implementing
    Monthly/Daily interest cost, that they are not simple divisions of
    the annual figure — `Daily = Debt × APR / 365` and
    `Monthly = Daily × 30` (F-030/F-031) do not equal `Annual / 365` /
    `Annual / 12` — resolved by calling the real, already-public Engine
    functions via a new Service rather than approximating.
23. **Batch 7 raised no new numbered conflict — it resolved the M5-015
    scoping question conflict #29 itself had left open since Batch 4**,
    overdue since Batch 6's own note. Three options were on the table:
    (a) scope M5-015 to only the repayment/additionalCollateral
    categories the Batch 4 `calculateTargetHealthFactorActions` Service
    already supports; (b) collect the five missing
    `RecommendationRuleConfig` fields as new portfolio settings; (c)
    define documented defaults for them. (c) was rejected as invention;
    (b) was rejected as disproportionate scope creep into already-shipped
    Milestone 4 code and a product-level decision beyond a single
    batch's standing. (a) was chosen, for direct consistency with
    M5-007/M5-009's own precedent — the same Service, the same
    conflict, the same resolution. Also noted, without raising it as a
    conflict: 03_UI.md's "PRIMARY RECOMMENDATION" mockup says "Only one
    recommendation is displayed," while `06_TASKS.md`'s M5-015 names
    "Top recommendations" (plural) with a Priority ranking field —
    followed `06_TASKS.md` as authoritative per established practice; the
    practical difference is softened since the scoped-down universe never
    exceeds 2 items anyway.
24. **Milestone 5 Batch 8 raised no new numbered conflict.** M5-017
    (Data Freshness Indicators) needed no new Engine or Service call —
    every field it displays was already threaded through
    `DashboardFreshness` by Batch 2 (M5-004). Its "Fresh or stale
    classification" Show item was scoped to market data only, carrying
    forward `services/protocol/quote.ts`'s own already-established M3-008
    finding that no "PROTOCOL FRESHNESS" rule is documented anywhere,
    rather than inventing a staleness threshold for protocol parameters.
    M5-018 (Refresh Workflow) was resolved with no new code: its
    "Request new market data"/"Request updated protocol parameters"/
    "Validate responses" steps require a live data provider that does not
    exist in this Manual-Mode version (the same REQ-010/`PriceProvider`
    gap Batch 2's own M5-004 write-up already resolved for the "Refresh
    action" Include item, not a new conflict); its "Recalculate portfolio
    summary"/"Retain previous valid values if refresh fails" steps were
    already true for free, since `recomputeSummary` never fetches and so
    cannot lose or overwrite valid data. See the Batch 8 write-up above
    for the full field-by-field reasoning.
25. **Milestone 5 Batch 9 raised no new numbered conflict.** M5-019
    (Loading States) found and fixed a real, pre-existing "layout shift"
    bug (the old "Loading…" line and the no-portfolio/portfolio branch
    below it rendered simultaneously) rather than just adding a skeleton
    on top of it. M5-020 (Empty States) investigated each of its 6
    Include items individually: "No portfolio" was already satisfied;
    "Portfolio without collateral" was confirmed structurally unreachable
    by tracing both `calculateLoanToValue` and `calculateEffectiveLeverage`
    (every zero-collateral scenario fails calculation, never renders as a
    distinguishable empty state); "Missing prices"/"Missing protocol
    parameters" were confirmed structurally unreachable via
    `types/portfolio.schema.ts`'s own required (non-optional) `market`/
    `protocol` fields; "Portfolio without debt" (a new `NoDebtNotice`
    component) and "No recommendations" (extending
    `RecommendationSummary` with a new `emptyReason` field) were the two
    genuinely buildable items, and were built. The "No recommendations"
    build revisits, rather than contradicts, Batch 7's own decision to
    render nothing — Batch 7 had no task asking for an explanation yet;
    M5-020 now does. See the Batch 9 write-up above for the full
    per-item reasoning.
26. **Milestone 5 Batch 10 raised no new numbered conflict.** M5-021's
    own cross-document investigation (mirroring M4-017's own method)
    found two real, concrete gaps a literal `06_TASKS.md`-only reading
    would have missed: 03_UI.md's Dashboard-specific "ERROR HANDLING"
    section names a "Retry Button" the previous error branch did not
    have; `01_PRD.md`'s generic error-display guideline names an "Error
    Identifier" neither the Dashboard's nor the Portfolio page's own
    error banner previously showed. Both closed in
    `DashboardErrorBanner`. "Use last valid data" was resolved by
    directly applying M4-017's own already-established finding
    (validate-before-mutate already guarantees this) rather than
    re-deriving it or inventing a new summary cache. See the Batch 10
    write-up above for the full reasoning.
27. **Milestone 5 Batch 11 raised no new numbered conflict.** M5-016's
    "Export portfolio" Action item was cross-referenced against
    03_UI.md's own "EXPORT OPTIONS" section (CSV, JSON, calculation
    timestamps — PDF explicitly deferred as "Future Version") rather
    than assumed to be satisfied by reusing M4-017's narrower
    recovery-copy export, which is scoped to raw entered data for
    failure cases specifically, not calculated output. A new,
    deliberately separate `exportPortfolioSummary.ts` module was added
    for this real, documented, distinct requirement. "Run
    simulation"/"Build loop strategy"/"Create exit plan" were marked
    unavailable (not linked through) since Milestones 6/7 have not been
    reached — the placeholder pages' own text already says so, and this
    task's own "Unavailable actions should explain why" Requirement
    gives explicit grounds for it, more cautious than the sidebar's own
    pre-existing (M1-scaffold) links to the same routes. See the Batch
    11 write-up above for the full reasoning.
28. **Milestone 5 Batch 12 raised no new numbered conflict, but found
    and fixed two real horizontal-overflow bugs via actual Playwright
    viewport checks** — reading Tailwind class names alone would not
    have caught either: `AppHeader`'s portfolio switcher had no width
    cap (overflowed at 375px with a long portfolio name), and
    `PortfolioCompositionSection`'s table was visibly cramped at exactly
    768px (the sidebar-appears breakpoint). Fixing the table required a
    third change (`AppShell`'s `<main>` needed `min-w-0`, the standard
    flexbox fix that lets a flex child's own `overflow-x-auto`
    descendant actually contain overflow instead of widening the whole
    page) — found only because the viewport check still failed after
    the first table fix alone. All three fixes touch shared,
    pre-Milestone-5 layout components (`AppHeader.tsx`, `AppShell.tsx`,
    both M1-006), a deliberate, documented exception since M5-023's own
    "No horizontal page scrolling" Requirement is a property of what the
    Dashboard route actually renders on screen. A mobile navigation gap
    was found and documented but not built (no sidebar replacement below
    `md:`) — out of scope for a Dashboard-content task. See the Batch 12
    write-up above for the full reasoning.
29. **Milestone 5 Batch 13 raised no new numbered conflict, but found
    M5-024's own DoD points to an empty section.** "Meets the
    accessibility requirements defined in the Build Guide" names
    `04_BUILD_GUIDE.md`'s own "ACCESSIBILITY" line, which is a bare
    checklist tick with no actual content anywhere in that document.
    Resolved by verifying against WCAG AA instead — the real, concrete,
    cross-document-consistent target three separate sections agree on
    (`01_PRD.md` REQ-008-F/REQ-011-E, `03_UI.md`'s own "ACCESSIBILITY"
    section), not an invented bar. Added `@axe-core/playwright`
    (devDependency) and ran automated WCAG-AA scans across 4
    structurally distinct Dashboard states — zero violations in all
    four. Investigated all 8 of the task's own Review items
    individually: 4 confirmed already correct (heading order, keyboard
    navigation, focus visibility, color-independent warnings), 1
    confirmed structurally not applicable (chart alternatives — no
    chart exists, Conflict A), 2 real, found-not-assumed gaps fixed
    (table semantics — missing `scope="col"`; status announcements —
    `DashboardErrorBanner`/`NoDebtNotice` had no live-region role), and
    1 real gap fixed that two earlier batches' own comments had already
    flagged as this exact task's future work (tooltip accessibility —
    `KpiCard`'s and `QuickActionsSection`'s `title` tooltips were only
    reachable by mouse hover, never by keyboard, silently failing
    M5-016's own "explain why" Requirement for keyboard/screen-reader
    users specifically). See the Batch 13 write-up above for the full
    per-item reasoning.
30. **Milestone 5 Batch 14 raised no new numbered conflict, but found
    where M5-022's own toggle state should live had no documented
    answer.** 03_UI.md's "DEVELOPER MODE" section implies a persistent,
    app-wide control, but its own "SETTINGS" page's literal Version 1
    field list does not name a Developer Mode toggle, and no task
    anywhere assigns building a Settings page. Resolved with a new,
    small, dedicated `stores/developerModeStore.ts` — the same
    lightweight-Store pattern `stores/portfolioStore.ts` already
    established — rather than inventing a Settings page this milestone
    does not build. Also checked which of the task's 7 "Display where
    appropriate" items were genuinely new: "Assumptions," "Warnings,"
    and "Calculation timestamp" are already visible to every user today
    (`LiquidationRiskPanel`, `RiskWarningBanner`, the "Calculated
    {timestamp}" line), so only "Raw values"/"Formula IDs"/"Engine
    version"/"Formula version" were genuinely new, gated content — the
    other three were not moved behind the new toggle, since hiding
    already-visible information from normal users would contradict this
    task's own DoD. See the Batch 14 write-up above for the full
    reasoning.
31. **Milestone 5 Batch 15 raised no new numbered conflict.** M5-025
    ("Create Dashboard Component Tests") turned out to be an audit task,
    not a build task — every one of the 15 Dashboard components already
    had its own test file from incremental development across Batches
    1–14. Checked each of the task's 8 named `Cover` items individually
    against the existing suite (the same discipline Batch 14 applied to
    M5-022's 7 "Display where appropriate" items): 4 were already
    satisfied (Normal values, Missing data, Warning states, Developer
    Mode); 4 had genuine gaps, closed this batch (Zero debt in 4 more
    components beyond the 2 already covered; Critical Health Factor, via
    a shared near-liquidation fixture; Stale data, via a real
    `vi.useFakeTimers()` fixture rather than a synthetic prop; Long
    values, a 200-character portfolio name and a 24-character formatted
    KPI value). Zero production code changed — only 7 test files. See
    the Batch 15 write-up above for the full reasoning.
32. **Milestone 5 Batch 16 raised no new numbered conflict.** M5-026
    ("Create Dashboard Integration Tests") was resolved by finding and
    following an existing, exact precedent (`tests/integration/portfolio/
portfolioWorkflows.test.ts`, M4-018) rather than inventing a new
    testing convention: no React rendering, one `describe` block per
    named `Cover` item, chaining real Store and Dashboard-builder calls
    across multiple sequential steps in a single test. Built a new
    `tests/integration/dashboard/dashboardWorkflows.test.ts` (no such
    directory existed yet) one layer above M4-018's own file — chaining
    `buildDashboardViewModel` → `buildHealthFactorStatus` →
    `buildRiskWarnings`, the exact call chain `app/page.tsx` itself
    makes. All 6 `Cover` items covered (8 tests); the genuinely new case
    among them ("Refresh price") explicitly changes the portfolio's
    stored market price out from under the active record, then calls
    `recomputeSummary` and confirms the view model reflects the new
    price rather than a stale cached one — no existing test had ever
    changed the price _before_ exercising Refresh. Zero production code
    changed. See the Batch 16 write-up above for the full reasoning.
33. **Milestone 5 Batch 17 raised no new numbered conflict.** M5-027
    ("Create Dashboard End-to-End Tests") followed
    `tests/e2e/portfolioWorkflows.spec.ts`'s (M4-018) own established
    convention exactly. Built a new `tests/e2e/dashboardWorkflows.spec.ts`
    covering all 8 named `Flows`, plus a dedicated 3-viewport
    parametrized test (reusing `responsiveLayout.spec.ts`'s own M5-023
    breakpoints) for the DoD's own "supported viewport sizes" clause,
    rather than tripling the file's runtime by repeating all 8 Flows at
    every size. Found and fixed two real, found-not-assumed test bugs in
    the first draft: `getByRole('link', { name: 'Edit Portfolio' })`
    was ambiguous against `QuickActionsSection`'s own separate "Edit
    portfolio" (lowercase) link (fixed with `exact: true`); resizing to
    mobile _before_ a multi-step workflow that needed further in-app
    navigation timed out, since `AppSidebar`'s links are hidden below
    `md:` with no mobile-navigation replacement built yet (fixed by
    performing all cross-page navigation at the default desktop
    viewport, resizing only to check the completed workflow's own
    rendered result). Zero production code changed. See the Batch 17
    write-up above for the full reasoning.
34. **Milestone 5 Batch 18 raised one new, significant conflict
    (#30) — the largest found in this entire engagement.** M5-028
    ("Validate Dashboard Against UI Specification"), the final
    Milestone 5 task, required reading `03_UI.md` in full for the
    first time at this granularity, not just its previously-cited
    sections. Found that Page 3 ("Dashboard") describes an entirely
    different, never-built design — a Market Snapshot with 24-hour
    price change, a Portfolio Score, a Risk Category, a Position
    Timeline chart, a Recent Activity event log — that shares almost no
    vocabulary with `06_TASKS.md`'s own M5-001–M5-024 task list this
    milestone actually built. Confirmed `06_TASKS.md` as authoritative
    (its own M5-006 "Cards" list matches the built `DashboardKpiGrid`
    exactly; Page 3's own card list does not), not retrofitted (would
    require inventing a historical-data subsystem violating Conflict B
    and Conflict #7 at once), and flagged as Conflict #30 for a product
    decision. Individually verified all 7 of the task's own `Verify`
    items, not just this one large finding; also found and fixed one
    real, small gap (`TOOLTIPS`: `DebtAndInterestPanel`/
    `LeverageSummarySection` had none) and, while fixing it, found and
    fixed a second, pre-existing accessibility gap
    (`HealthFactorStatusSection`'s own tooltip was never keyboard-
    reachable — the same WCAG 2.1.1 issue Batch 13 fixed for `KpiCard`,
    never applied here). Verified all 12 Milestone 5 Acceptance
    Criteria directly. This closes Milestone 5's task list
    (M5-001–M5-028, M5-008 excepted). See the Batch 18 write-up above
    for the full reasoning.
35. **From Milestone 4 Batch 8, still open**: conflict #28 — M4-013's Dependencies
    suggested auto-save should extend to the Collateral/Debt Position
    Management forms, but M4-009's own DoD requires explicit confirmation
    for risk-increasing changes to those same fields; resolved by keeping
    the more specific, already-implemented M4-009 behavior. Also: two of
    M4-013's four DoD-named save states (`'saving'`/`'offline'`) cannot be
    genuinely, honestly built in this synchronous, no-network
    architecture.
36. **Batch 9 raised no new conflict.** Every ambiguity in M4-017's short
    "Include" list was resolved by reading the fuller ERROR RECOVERY
    context across `01_PRD.md`/`03_UI.md`/`04_BUILD_GUIDE.md` rather than
    guessing. One finding worth flagging without raising it as a
    conflict: 03_UI.md's "Retry Button" is built and real (it genuinely
    re-runs the calculation), but cannot itself resolve a calculation
    failure in this architecture, since every other mutating Store action
    already keeps cached summaries in sync with committed data — fixing
    the underlying position is what actually clears the error, not the
    Retry click. Documented as an honest limitation, not a specification
    conflict.
37. **From Batch 6, still open**: conflict #27 — M4-012 never says
    whether an archived portfolio remains independently selectable (e.g.
    still reachable via the switcher or a clickable list row) while
    archived. Resolved conservatively for internal consistency: archived
    portfolios are excluded from `AppHeader`'s switcher and rendered as
    non-clickable rows on the Portfolio List Page; unarchiving is the
    only documented path back to selectability.
38. **From Batch 5, still open**: conflict #26 — M4-009's DoD requires
    confirmation for "risk-increasing" changes, but no such term is
    defined anywhere in the documentation (no threshold, band, or scoring
    rule). Resolved with the most conservative possible directional
    comparison (`after.healthFactor < before.healthFactor`), not an
    invented threshold or classification system.
39. **From Batch 4, still open**: conflict #25 — M4-008 names "Price"
    and "Rate type" as debt fields with no counterpart anywhere in the
    data model. "Price" shown as read-only informational text; "Rate
    type" not rendered at all.
40. **From Batch 3, still open — recurred in Batch 7 with the same
    resolution**: conflict #24 — M4-005's (and now M4-015's) "Protocol
    parameters or preset" names a preset option with no concrete values
    anywhere in the documentation. Resolved both times by offering
    manual entry only.
41. **From Batch 2, still open**: conflict #23 — 03_UI.md's own "six
    primary pages" inventory has no room for a Portfolio List page.
    Resolved by keeping `/portfolios` out of the sidebar, reachable only
    via the `AppHeader` switcher.
42. **From Batch 1, still open**: "Settings" (conflict #22) — M4-001
    names it as a required field with no defined shape anywhere. Resolved
    conservatively (safety-targets-only) — still flagged for a real
    decision.
43. **Conflict #20 remains resolved** (Batch 0) — no longer an open
    item.
44. **From Milestone 3 Batch 9 (Formula Engine numbering — not this
    Milestone 4's batches)**: M3-013's "persistence adapters" mention
    (conflict #21) has no persistence Service or task to attach to until
    Milestone 8 — revisit when Milestone 8 (Persistence, Authentication,
    Cloud Synchronization & Import/Export) is reached, not before.
45. **Outstanding blockers/conflicts carried forward from Milestone 2**:
    F-026 (Health Factor status classification, conflict #1), compound
    interest / M2-013–M2-014 (conflict #7), the partially-unassigned
    Recommendation Engine chapter (conflict #9 — F-061–F-064
    implemented; F-060, F-065–F-069 not), "Exit readiness"'s unmapped
    Formula ID (conflict #11), F-067's partial documentation (conflict
    #12), the unspecified "Target borrow percentage" blocking a
    post-loop Golden Reference Portfolio fixture (conflict #14),
    M2-029's DoD-vs-scope tension over the 33 unimplemented Formula IDs
    (conflict #15), the Build-Guide-vs-Formulas.md performance-target
    disagreement plus M2-030's 2 unmapped benchmark categories (conflict
    #16), and M2-031's undocumented public/internal split criteria
    (conflict #17). None of these blocked Milestone 2's own completion.
46. **Revisited in Milestone 2 Batch 7, confirmed still open at the
    specification level but no longer blocking implementation**:
    swap-fees/slippage/gas-estimate (conflict #8), "Target cash
    proceeds"'s ambiguous mechanics (conflict #10), and F-040's
    exit-collateral-sale discrepancy (conflict #13, a known, tested
    approximation).
47. **From Milestone 3/4, still open — final tally at Milestone 4's
    completion**: "Source status"'s undefined _generic_ value domain
    (conflict #18), "Formula version" aggregation across a
    multi-Engine-call Service (conflict #19), M3-013's persistence-
    adapter gap (conflict #21 — point 15 above), "Settings"'s undefined
    shape (conflict #22 — point 13 above), the Portfolio List page's
    missing place in 03_UI.md's page inventory (conflict #23 — point 12
    above), the missing protocol-preset values (conflict #24 — point 11
    above), the debt "Price"/"Rate type" gap (conflict #25 — point 10
    above), the undefined "risk-increasing" term (conflict #26 — point 9
    above), whether an archived portfolio stays independently selectable
    (conflict #27 — point 8 above), and the auto-save-vs-confirmation
    tension plus the two unreachable DoD save states (conflict #28 —
    point 6 above). Conflict #20 (resolved Batch 0) is not counted.
    **27 open conflicts remain (28 total raised across the entire
    Milestone 4 review, minus #20, resolved) — unchanged by Batch 10,
    which raised none. All 27 are handed off for a future
    product/engineering decision; none blocked Milestone 4's own
    completion.**
