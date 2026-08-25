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

/**
 * Exit Strategy — 02_Formulas.md F-040–F-042; 06_TASKS.md M2-023/M2-024.
 * `calculateBtcSaleRequired` is now tagged F-071 (V4 Readiness Audit §12
 * P1-5), generalizing F-042 — see that file's own doc comment and
 * `tests/fixtures/formulaCoverage.ts`'s F-042 entry (unchanged: still
 * `implemented`, still tagged independently by `calculateExitPosition`'s
 * own primary F-042 label).
 */
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

/**
 * Leverage & Loop Mathematics — F-012–F-014, F-018, F-037; M2-015–M2-018.
 * `calculateBtcPurchasedPerLoop` is now tagged F-070 (V4 Readiness Audit
 * §12 P1-5), generalizing F-015 — see that file's own doc comment and
 * `tests/fixtures/formulaCoverage.ts`'s F-015 entry.
 */
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
 * Execution Cost Mathematics — F-070–F-073; V4 Readiness Audit §12 P1-4
 * (formula contract), P1-5 (this implementation). F-070/F-071 are not
 * re-exported here by name — reach them through
 * `calculateBtcPurchasedPerLoop`/`calculateBtcSaleRequired` above (Loop)
 * and below (Exit), the same "one call chain owns the formula" boundary
 * this stage was explicitly scoped to. Only the genuinely-standalone,
 * reusable accounting primitives — F-072 (Transaction Gas Cost) and
 * F-073 (Total Execution Cost) — get their own top-level export, since
 * neither is embedded into `LoopStrategyResult`/`ExitPositionResult` yet
 * (deliberately deferred past this stage's own "engine implementation
 * only" scope guard).
 */
export {
  calculateTotalExecutionCost,
  calculateTransactionGasCost,
  type TotalExecutionCostResult,
} from './execution';

/**
 * Protocol/version dispatch for debt projection — V4 Readiness Audit §12.
 * `projectProtocolDebt` is the one place a Service resolves "which
 * protocol-version's math to run" from an explicit `AaveProtocolVersion`,
 * instead of importing a specific version's projector by name
 * (`services/simulation/scenario.ts` previously did exactly that,
 * importing `projectVariableDebt` from `./protocols/aaveV3` directly — the
 * architectural gap this dispatcher closes). See `./protocols/index.ts`
 * for the dispatcher itself and `./protocols/types.ts` for why V3 and V4
 * need genuinely different request/response shapes (Stage 2: V4 now has
 * real math, not just a typed unsupported boundary).
 */
export {
  type AaveProtocolVersion,
  type AaveV3DebtProjectionRequest,
  type AaveV4DebtProjection,
  type AaveV4DebtProjectionRequest,
  projectProtocolDebt,
  type ProtocolDebtProjectionRequest,
} from './protocols';

/**
 * Aave V3 protocol-specific accrual — not a 02_Formulas.md Formula ID.
 * Reproduces Aave V3's own on-chain compounded variable-debt math
 * (`MathUtils.calculateCompoundedInterest`), isolated from the generic
 * Simple Interest formulas above (F-030–F-032, unchanged). Still exported
 * directly for callers/tests that intentionally want V3's math by name.
 * Aave V4's own TIME-PROJECTION implementation (`./protocols/aaveV4`'s
 * `projectAaveV4Debt`) is deliberately NOT exported here by name, even now
 * that its math is real (Stage 2) — reach it only through
 * `projectProtocolDebt`, never directly, so the dispatcher stays the one
 * place version selection happens.
 */
export { projectVariableDebt } from './protocols/aaveV3';

/**
 * Aave V4 repayment allocation — V4 Readiness Audit §12 Stage 12. A
 * genuinely different operation from `projectAaveV4Debt` above (instant
 * repayment allocation, not forward time-projection) with no V3
 * equivalent to dispatch against — V3 has no premium stream, so a V3
 * repayment is just a direct balance subtraction with no Engine formula
 * needed. Exported directly by name, the same "no dispatcher to go
 * through" precedent `projectVariableDebt` above already sets for V3. See
 * `./protocols/aaveV4/deriveDebtAfterRepayment.ts` for the full
 * `aave/aave-v4` source citations behind this formula.
 */
export { type AaveV4RepaymentInput, deriveAaveV4DebtAfterRepayment } from './protocols';

/**
 * Portfolio Metrics — F-001–F-004, F-006, F-010, F-011, F-020;
 * M2-006–M2-008. `calculateDebtAssetValue` (V4 Readiness Audit §12
 * P1-D2) is not one of these — a protocol-neutral post-spec addition,
 * same "descriptive string ID, not a new F-XXX" convention as the
 * `AAVE-V4-*`-prefixed formulas above.
 */
export {
  calculateCollateralValue,
  calculateDebtAssetValue,
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
  ExecutionCostAssumptions,
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
