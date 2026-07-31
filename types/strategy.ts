import type { PortfolioSummary } from '@/services';

/**
 * Shared Strategy View Models — 06_TASKS.md M7-002 ("Create Shared
 * Strategy View Models"). Dependencies: M7-001. Priority P0, Effort M.
 * Description: "Create typed view models for strategy results." Include:
 * "Current portfolio baseline, Proposed strategy result,
 * Before-and-after comparison, Warnings, Assumptions, Costs, Formula
 * references, Engine version." DoD: "Strategy components consume stable
 * UI-ready models without recalculating financial values."
 *
 * **Lives in the top-level `types/` directory, not inside any one
 * feature.** `04_BUILD_GUIDE.md`'s own "TYPES DIRECTORY" note ("Shared
 * TypeScript interfaces") already names this directory's purpose
 * exactly, and `types/index.ts`'s own header comment already documents
 * it as this project's one location for cross-cutting shared types
 * (`Portfolio`, M4-001). Unlike this codebase's usual "each feature owns
 * its own thin utility layer" preference (see
 * `features/simulation/utils/format.ts`'s own header comment for that
 * precedent), Loop Builder and Exit Planner genuinely need to consume
 * the *same* types here — M7-003's own DoD literally requires it ("The
 * component supports Loop Builder and Exit Planner results") — so this
 * is the one deliberate exception, not a contradiction of that
 * preference.
 *
 * **"Formula references" and "Engine version" reuse `ServiceMetadata`
 * directly (`services/shared/result.ts`, M3-002) — no new type
 * invented.** Every `ServiceResult` already carries `engineVersion`/
 * `formulaVersion`; `stores/simulationStore.ts`'s own `lastMetadata`
 * field (M6-013) already established the "store the most recent
 * successful call's metadata, read it directly in the assumptions
 * panel" pattern this milestone reuses rather than re-deriving.
 *
 * **"Warnings" is `StrategyWarning[]`, defined below for M7-005 — not
 * `ServiceWarning[]`.** `ServiceWarning` (`code`/`message`) is the
 * generic Service-layer carrier already used everywhere; M7-005's own
 * Requirements ask for a richer shape ("Every warning includes a cause,
 * severity, and suggested response"), which `ServiceWarning` cannot
 * satisfy without fabricating fields it was never designed to hold. A
 * new, purpose-built type is the honest choice, not an extension of an
 * existing one meant for a different purpose.
 *
 * **"Proposed strategy result" has no shared type here** — Loop's
 * `LoopStrategyPreview` (M3-010) and Exit's `ExitPlanResult` (M3-011)
 * already exist, are already tool-specific in shape (loop steps vs. an
 * exit transaction), and neither shares enough structure to unify
 * without inventing a lowest-common-denominator type nothing asked for.
 * Each tool's own Store (M7-007, M7-020) consumes its own Service's
 * result directly; only the genuinely-shared pieces below are factored
 * out.
 */

/**
 * A single portfolio state (current or proposed) reduced to exactly the
 * fields `StrategyComparison` (M7-003) needs. `summary` reuses
 * `calculatePortfolioSummary` (M3-005) as-is — already covers 8 of
 * M7-003's 9 "Support" metrics (Collateral → `collateralValue`, Debt →
 * `debtValue`, Net equity, Health Factor, LTV → `loanToValue`,
 * Leverage, Liquidation price → `liquidation.price`, Interest cost).
 * `btcExposure` covers the 9th (`calculateExposure`, F-010 — not part of
 * `PortfolioSummary` itself). Computing both is each tool's own Store's
 * responsibility once it exists (M7-007, M7-020) — this file defines
 * only the shape, not a new calculation.
 */
export interface StrategyBaseline {
  summary: PortfolioSummary;
  btcExposure: number;
}

/**
 * The shared "Before-and-after comparison" shape M7-002's own Include
 * list names, and M7-003 renders. `after` is `null` exactly when a
 * strategy is infeasible (mirrors `ExitPlanResult.after`'s own
 * convention, M3-011) — there is no "after" portfolio to compare
 * against, not a fabricated one.
 */
export interface StrategyComparisonResult {
  feasible: boolean;
  before: StrategyBaseline;
  after: StrategyBaseline | null;
}

/**
 * The shared "Costs" shape M7-002's own Include list names. Each tool
 * maps its own Service cost fields into this list at its Store layer —
 * `LoopCostResult` (`borrowingInterest`, `breakEvenAppreciation`,
 * `unavailable`) for Loop, `ExitTransactionSummary` +
 * `unavailableCosts` for Exit. `amount: null` paired with
 * `unavailableReason` is this list's own honest way of itemizing a
 * documented gap (conflict #8 — swap fees/slippage/gas estimate have no
 * Formula ID anywhere) instead of fabricating a `$0`, the exact
 * convention `engine/loop/calculateLoopCosts.ts`'s own
 * `UnavailableLoopCost`/`engine/exit`'s own `UnavailableExitCost`
 * already established at the Engine layer.
 */
export interface StrategyCostItem {
  label: string;
  amount: number | null;
  unavailableReason?: string;
}

/**
 * The 8 warning categories M7-005's own Categories list names, verbatim.
 */
export type StrategyWarningCategory =
  | 'safety'
  | 'liquidation'
  | 'borrowingCapacity'
  | 'interestBurden'
  | 'transactionCost'
  | 'staleData'
  | 'invalidTarget'
  | 'infeasibleStrategy';

/**
 * `'error'` for a strategy-blocking condition (mirrors `LoopSafetyFinding`'s
 * own `severity` union, `engine/loop/validateLoopStrategySafety.ts`),
 * `'warning'` for a non-blocking one — the same two-level severity this
 * codebase has used consistently since `ServiceWarning`/`FormulaWarning`
 * (Milestone 2–3), not a new three-or-more-level scheme invented here.
 */
export type StrategyWarningSeverity = 'error' | 'warning';

/**
 * Shared Strategy Warning — 06_TASKS.md M7-005 ("Create Shared Strategy
 * Warning System"). Requirements: "Every warning includes a cause,
 * severity, and suggested response." Each tool's own Store maps its
 * real Engine/Service findings into this shape once that Store exists
 * (M7-013 "Implement Loop Safety Analysis" and M7-027 "Implement Exit
 * Feasibility Analysis" both declare an explicit M7-005 dependency for
 * exactly this reason) — this file defines only the shape and a
 * reusable renderer (`StrategyWarnings.tsx`), not real warning
 * generation, since no Loop/Exit Store exists yet in this batch.
 */
export interface StrategyWarning {
  category: StrategyWarningCategory;
  severity: StrategyWarningSeverity;
  cause: string;
  suggestedResponse: string;
}
