/**
 * Formula Engine — public entry point.
 *
 * 06_TASKS.md M2-001: "The Engine can be imported through a single public
 * entry point. No framework dependencies exist inside the Engine." M2-031
 * ("Publish Formula Engine API") finalizes this as the curated public
 * surface: "Only services communicate directly with the Formula Engine"
 * (04_BUILD_GUIDE.md "SERVICES DIRECTORY"), and every Service-facing
 * calculation, its result type, and the shared domain vocabulary needed to
 * call it and interpret its result are exported below — nothing more.
 *
 * This module has no React, Next.js, Supabase, browser, or persistence
 * dependencies, and none may be added — 04_BUILD_GUIDE.md "Dependency
 * Rules".
 *
 * Two modules are intentionally NOT re-exported here (M2-031 Requirement:
 * "Hide internal helpers"), even though both remain fully implemented,
 * tested, and directly importable from their own file for engine-internal
 * and test use:
 *   - `./validation/invariants` (`checkNetWorthInvariant` and its 4
 *     siblings): M2-027's own Description/DoD frame these as an automated
 *     *test*-time consistency check ("Add automated checks..." / "Invariant
 *     violations fail tests and expose implementation defects"), not a
 *     Service-facing calculation with a Formula ID — every consumer today
 *     (`tests/unit/engine/invariants/`, `tests/unit/engine/validation/`)
 *     already imports it directly from `./validation/invariants`, never
 *     through this barrel.
 *   - `./validation/validate` (`validateNonNegative` and its siblings):
 *     internal plumbing each formula function already uses to build its
 *     own `FormulaResult` error — a Service never needs to pre-validate
 *     input before calling a formula function, since every formula
 *     function already validates and returns a structured error itself
 *     (01_PRD.md REQ-002 "ERROR HANDLING"). `06_TASKS.md`'s own later
 *     Milestone 3/4 tasks ("Create Portfolio Validation Schemas," "Use Zod
 *     validation") establish a *separate*, Zod-based schema layer for
 *     actual Service/UI-facing input validation — confirming these
 *     granular validators were never meant to cross the Engine/Service
 *     boundary directly.
 * See PROJECT_STATUS.md's Batch 15 section and conflict #17 for the full
 * reasoning, including the judgment calls involved.
 */

/** Exit Strategy — 02_Formulas.md F-040–F-042; 06_TASKS.md M2-023/M2-024. */
export {
  calculateBtcSaleRequired,
  calculateExitPosition,
  calculateRequiredDebtRepayment,
  calculateTargetDebt,
  calculateTargetExit,
  type ExitPositionInput,
  type ExitPositionResult,
  type ExitTarget,
  type TargetExitParams,
  type TargetExitResult,
  type UnavailableExitCost,
} from './exit';

/** Health Factor & Target-Health-Factor borrowing — F-022, F-027; M2-009, M2-011. */
export { calculateAdditionalBorrow, calculateHealthFactor } from './health';

/** Simple Interest — F-030–F-032; M2-012. */
export {
  calculateAnnualInterest,
  calculateDailyInterest,
  calculateMonthlyInterest,
  calculateProratedInterest,
} from './interest';

/** Liquidation risk — F-023–F-025; M2-010. */
export {
  calculateLiquidationBuffer,
  calculateLiquidationDistance,
  calculateLiquidationPrice,
} from './liquidation';

/** Leverage & Loop Mathematics — F-012–F-015, F-018, F-037; M2-015–M2-018. */
export {
  calculateAvailableBorrow,
  calculateBorrowCapacity,
  calculateBreakEvenAppreciation,
  calculateBtcPurchasedPerLoop,
  calculateLoopCapital,
  calculateLoopCosts,
  calculateLoopStep,
  calculateLoopStrategy,
  calculateMaximumBorrowLimit,
  type LoopCostResult,
  type LoopSafetyCheck,
  type LoopSafetyFinding,
  type LoopSafetyValidationResult,
  type LoopStepInput,
  type LoopStepRecord,
  type LoopStepResult,
  type LoopStopReason,
  type LoopStrategyInput,
  type LoopStrategyResult,
  type UnavailableLoopCost,
  validateLoopStrategySafety,
} from './loop';

/**
 * Protocol/version dispatch for debt projection — V4 Readiness Audit §12
 * Stage 1. `projectProtocolDebt` is the one place a Service resolves
 * "which protocol-version's math to run" from an explicit
 * `AaveProtocolVersion`, instead of importing a specific version's
 * projector by name (`services/simulation/scenario.ts` previously did
 * exactly that, importing `projectVariableDebt` from `./protocols/aaveV3`
 * directly — the architectural gap this dispatcher closes). See
 * `./protocols/index.ts` for the registry itself.
 */
export { type AaveProtocolVersion, projectProtocolDebt } from './protocols';

/**
 * Aave V3 protocol-specific accrual — not a 02_Formulas.md Formula ID.
 * Reproduces Aave V3's own on-chain compounded variable-debt math
 * (`MathUtils.calculateCompoundedInterest`), isolated from the generic
 * Simple Interest formulas above (F-030–F-032, unchanged). Still exported
 * directly for callers/tests that intentionally want V3's math by name.
 * Aave V4's own implementation (`./protocols/aaveV4`) is deliberately NOT
 * exported here by name — it has no real math yet (fails closed by
 * design); reach it only through `projectProtocolDebt`, never directly.
 */
export { projectVariableDebt } from './protocols/aaveV3';

/** Portfolio Metrics — F-001–F-004, F-006, F-010, F-011, F-020; M2-006–M2-008. */
export {
  calculateCollateralValue,
  calculateDebtRatio,
  calculateDebtValue,
  calculateEffectiveLeverage,
  calculateExposure,
  calculateLoanToValue,
  calculateNetWorth,
  calculatePortfolioValue,
} from './portfolio';

/** Recommendation Engine — F-061–F-064; M2-025/M2-026. */
export {
  type AdditionalCollateralRecommendationParams,
  type BorrowRecommendationParams,
  calculateAdditionalCollateralRecommendation,
  calculateBorrowRecommendation,
  calculateLoopRecommendation,
  calculateRepaymentRecommendation,
  type DecisionPriority,
  generateRecommendations,
  type GenerateRecommendationsParams,
  type LoopRecommendationParams,
  type Recommendation,
  type RecommendationCategory,
  type RecommendationRuleConfig,
  type RecommendationSet,
  type RepaymentRecommendationParams,
  type UnavailableRecommendationCategory,
} from './recommendation';

/**
 * Decimal arithmetic & display formatting — 04_BUILD_GUIDE.md "Formula
 * Engine Implementation." `roundForDisplay`/`DISPLAY_PRECISION` are for
 * the presentation layer only (the Engine itself never rounds
 * intermediates); `toDecimal`/`toOutputNumber`/`Decimal` let a Service
 * work in the same precision as the Engine when composing results.
 */
export {
  Decimal,
  type DecimalInput,
  DISPLAY_PRECISION,
  roundForDisplay,
  toDecimal,
  toOutputNumber,
} from './shared/decimal';

/** The `FormulaResult<T>` contract every public Engine function returns. */
export {
  createFailure,
  type CreateResultOptions,
  createSuccess,
  type FormulaError,
  type FormulaFailure,
  type FormulaMetadata,
  type FormulaResult,
  type FormulaSuccess,
  type FormulaWarning,
} from './shared/result';

/** Shared domain vocabulary — 06_TASKS.md M2-002. Version 0.1: one BTC collateral position, one stablecoin debt position. */
export type {
  CollateralPosition,
  DebtPosition,
  MarketPrices,
  PercentageDecimal,
  PortfolioInput,
  ProtocolParameters,
} from './shared/types';

/** Scenario Simulation — F-007, F-033, F-050–F-053; M2-019–M2-022. */
export {
  calculateDebtGrowth,
  calculatePortfolioGain,
  compareScenarios,
  type InterestScenarioParams,
  type InterestScenarioResult,
  type PortfolioSnapshot,
  type PositionChangeInput,
  type PositionChangeResult,
  type PriceScenarioInput,
  type PriceScenarioParams,
  type PriceScenarioResult,
  type RankedScenario,
  rankScenarios,
  resolveScenarioPrice,
  type ScenarioComparisonResult,
  type ScenarioMetric,
  type ScenarioMetricDifference,
  type ScenarioSummary,
  simulateInterestScenario,
  simulatePositionChange,
  simulatePriceScenario,
} from './simulation';
