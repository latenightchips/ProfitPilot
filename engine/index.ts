/**
 * Formula Engine — public entry point.
 *
 * 06_TASKS.md M2-001: "The Engine can be imported through a single public
 * entry point. No framework dependencies exist inside the Engine."
 *
 * This module has no React, Next.js, Supabase, browser, or persistence
 * dependencies, and none may be added — 04_BUILD_GUIDE.md "Dependency
 * Rules".
 *
 * The curated public API surface (hiding internal helpers) is finalized in
 * M2-031; until then this re-exports everything implemented so far.
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
export { calculateAdditionalBorrow, calculateHealthFactor } from './health';
export {
  calculateAnnualInterest,
  calculateDailyInterest,
  calculateMonthlyInterest,
  calculateProratedInterest,
} from './interest';
export {
  calculateLiquidationBuffer,
  calculateLiquidationDistance,
  calculateLiquidationPrice,
} from './liquidation';
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
export {
  Decimal,
  type DecimalInput,
  DISPLAY_PRECISION,
  roundForDisplay,
  toDecimal,
  toOutputNumber,
} from './shared/decimal';
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
export type {
  CollateralPosition,
  DebtPosition,
  MarketPrices,
  PercentageDecimal,
  PortfolioInput,
  ProtocolParameters,
} from './shared/types';
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
export {
  type ValidatedProtocolParameters,
  validateFinite,
  validateNonNegative,
  validatePercentage,
  validatePositive,
  validatePrice,
  validateProtocolParameters,
  validateRate,
  validateThreshold,
  validateTimePeriod,
  validateTokenQuantity,
  type ValidationResult,
} from './validation/validate';
