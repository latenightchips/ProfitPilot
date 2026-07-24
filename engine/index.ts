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
export { calculateAdditionalBorrow, calculateHealthFactor } from './health';
export {
  calculateLiquidationBuffer,
  calculateLiquidationDistance,
  calculateLiquidationPrice,
} from './liquidation';
export {
  calculateAvailableBorrow,
  calculateBorrowCapacity,
  calculateMaximumBorrowLimit,
} from './loop';
export {
  calculateCollateralValue,
  calculateDebtValue,
  calculateEffectiveLeverage,
  calculateExposure,
  calculateLoanToValue,
  calculateNetWorth,
  calculatePortfolioValue,
} from './portfolio';
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
