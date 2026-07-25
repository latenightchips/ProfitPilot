# ProfitPilot — Project Status

Last updated: 2026-07-25
Current milestone: **Milestone 2 — Formula Engine** (per `docs/06_TASKS.md`), Batch 6 of 9 complete (pending approval)

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
2. **This pass stops here for approval** of Batch 6 (M2-018) before
   committing, per instruction.
3. Once approved and committed: **Batch 7 — Simulation (M2-019, M2-020)**,
   the next chapter after Loop. M2-019 ("Price Scenario Simulation")
   depends on M2-006/M2-009/M2-010 (all done) and is unblocked. M2-020
   ("Interest Scenario Simulation") depends on M2-014 (blocked, compound
   interest — conflict #7) and M2-019 — expect a partial batch again, same
   pattern as Batches 4, 5, and 6. M2-021/M2-022 have not yet been read in
   detail and should be checked at the start of that batch to confirm they
   belong to a later batch rather than this one.
4. **Outstanding blockers carried forward, independent of which batch is in
   progress**: F-026 (Health Factor status classification, conflict #1),
   compound interest / M2-013–M2-014 (conflict #7, and M2-017's still-open
   formal dependency on it, and now M2-020's direct dependency on it), the
   swap-fees/slippage/gas-estimate gap (conflict #8, affects M2-017's
   "Total implementation cost" and will recur in later milestones), and the
   unassigned Recommendation Engine chapter F-060–F-069 (conflict #9).
   Revisit all four once resolved upstream.
