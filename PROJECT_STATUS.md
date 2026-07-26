# ProfitPilot — Project Status

Last updated: 2026-07-26
Current milestone: **Milestone 3 — Core Services** (per `docs/06_TASKS.md`), Batch 4 complete (pending approval) — M3-001 through M3-006 addressed. **Milestone 2 — Formula Engine is complete within the documented Version 1 scope** (M2-001 through M2-032 all addressed; M2-013/M2-014 formally blocked; 33 of 69 Formula IDs and multi-asset scenarios intentionally documented as out of scope rather than implemented — see that section's Batch 16 write-up and conflicts #5/#7/#15).

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

### 20. `calculatePortfolioSummary` cannot summarize a zero-debt portfolio — `calculateLiquidationPrice` (F-024) treats liquidation price as undefined without debt

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
2. **This pass stops here for approval** of Milestone 3 Batch 4 (M3-005,
   M3-006) before committing, per instruction.
3. Once approved and committed: **Milestone 3 Batch 5 — M3-007 (Market
   Data Service)**, the next task in sequence. M3-007 depends only on
   M3-002 (done) and is unblocked. It is also the natural place to
   finally resolve conflict #18 ("Source status" has no documented value
   domain) — M3-007's own "Support" list (Manual prices, Provider
   prices, Stale-data detection, Fallback behavior, Price timestamps)
   reads like the actual source of the `sourceStatus` values every prior
   batch has deferred defining. Re-read M3-007 and M3-008 (Protocol
   Parameter Service) together at the start of that batch, per the same
   grouping judgment used for M3-002/M3-003 and M3-005/M3-006, rather
   than assuming they're separate or combined by default.
4. **Outstanding blockers/conflicts carried forward from Milestone 2, all
   still open**: F-026 (Health Factor status classification, conflict
   #1), compound interest / M2-013–M2-014 (conflict #7), the
   swap-fees/slippage/gas-estimate gap (conflict #8), the
   partially-unassigned Recommendation Engine chapter (conflict #9 —
   F-061–F-064 implemented; F-060, F-065–F-069 not), "Target cash
   proceeds"'s ambiguous mechanics (conflict #10), "Exit readiness"'s
   unmapped Formula ID (conflict #11), F-067's partial documentation
   (conflict #12), F-040's exit-collateral-sale discrepancy (conflict
   #13, a known, tested approximation), the unspecified "Target borrow
   percentage" blocking a post-loop Golden Reference Portfolio fixture
   (conflict #14), M2-029's DoD-vs-scope tension over the 33
   unimplemented Formula IDs (conflict #15), the Build-Guide-vs-
   Formulas.md performance-target disagreement plus M2-030's 2 unmapped
   benchmark categories (conflict #16), and M2-031's undocumented
   public/internal split criteria (conflict #17). None of these 17
   blocked Milestone 2's own completion, but several (especially #1, #7,
   #8, #9) plausibly gate specific Milestone 3 Services.
5. **From Milestone 3 Batch 2, both still open**: "Source status"'s
   undefined value domain (conflict #18 — see point 3 above, M3-007 is
   likely where this finally gets resolved) and "Formula version"
   aggregation across a multi-Engine-call Service (conflict #19 — Batch
   4 implemented a checked stopgap, not a resolution; still open).
6. **New from this batch, open**: `calculatePortfolioSummary` cannot
   summarize a zero-debt portfolio, because `calculateLiquidationPrice`
   (F-024) treats liquidation price as undefined without debt (conflict
   #20). Needs a product/engineering decision on whether a
   `PortfolioSummary`-level convention for debt-free portfolios (e.g.
   `liquidation: null`) should be introduced, and at which layer
   (Engine or Service).
