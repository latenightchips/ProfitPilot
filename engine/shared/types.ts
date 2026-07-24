/**
 * Shared domain types — 06_TASKS.md M2-002 ("Implement Shared Financial Types").
 *
 * Scope note: Version 0.1 supports one collateral asset (Bitcoin) and one
 * debt asset (a stablecoin) — 01_PRD.md REQ-003: "Version 0.1 assumes
 * Bitcoin only" / "Version 0.1 assumes one stablecoin". Every Formula ID in
 * 02_Formulas.md (F-001–F-069) is single-asset. Multi-asset fields implied
 * by some 06_TASKS.md Milestone 2 task descriptions (e.g. "by asset",
 * "weighted maximum LTV") have no corresponding documented formula and are
 * therefore not modeled here — see PROJECT_STATUS.md.
 *
 * Percentages and rates (LTV, liquidation threshold, APR/APY) are
 * represented as decimals throughout the Engine (0.8, not 80) —
 * 04_BUILD_GUIDE.md.
 */

export type PercentageDecimal = number;

export interface MarketPrices {
  btcPriceUsd: number;
}

/** TERMINOLOGY.md: "Collateral — Deposited assets." Version 0.1: BTC only. */
export interface CollateralPosition {
  asset: 'BTC';
  quantity: number;
}

/** TERMINOLOGY.md: "Debt — Borrowed stablecoins." Version 0.1: one stablecoin. */
export interface DebtPosition {
  asset: string;
  balance: number;
}

/**
 * Protocol parameters are always inputs, never hardcoded — 02_Formulas.md,
 * 04_BUILD_GUIDE.md. Version 0.1 supports Aave V3 (01_PRD.md REQ-003).
 */
export interface ProtocolParameters {
  maxLoanToValue: PercentageDecimal;
  liquidationThreshold: PercentageDecimal;
  borrowApr: PercentageDecimal;
  supplyApr: PercentageDecimal;
}

export interface PortfolioInput {
  collateral: CollateralPosition;
  debt: DebtPosition;
  market: MarketPrices;
  protocol: ProtocolParameters;
}

export type { FormulaError, FormulaMetadata, FormulaResult, FormulaWarning } from './result';
