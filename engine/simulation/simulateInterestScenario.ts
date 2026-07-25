import { calculateHealthFactor } from '../health/calculateHealthFactor';
import { calculateProratedInterest } from '../interest/calculateProratedInterest';
import { calculateCollateralValue } from '../portfolio/calculateCollateralValue';
import { calculateNetWorth } from '../portfolio/calculateNetWorth';
import { createFailure, createSuccess, type FormulaResult } from '../shared/result';
import type { PortfolioInput } from '../shared/types';
import { calculateDebtGrowth } from './calculateDebtGrowth';
import { type PriceScenarioInput, resolveScenarioPrice } from './resolveScenarioPrice';

const FORMULA_ID = 'F-033';
const FORMULA_VERSION = '1.0';

export interface InterestScenarioParams {
  portfolio: PortfolioInput;
  /** Reuses M2-019's price scenario shape, so both dimensions can be combined in one call. */
  priceScenario: PriceScenarioInput;
  /** "Time horizon" — 06_TASKS.md M2-020. Days over which interest accrues. */
  timeHorizonDays: number;
  /** "Rate assumptions" — 06_TASKS.md M2-020. An explicit input rather than defaulted from protocol.borrowApr. */
  borrowApr: number;
}

export interface InterestScenarioResult {
  scenarioBtcPriceUsd: number;
  /** Accrued Interest — F-030 (generalized to an arbitrary day count, M2-012). */
  accruedInterest: number;
  /** Debt Growth — F-033. */
  projectedDebt: number;
  /** Collateral Value — F-002, on the scenario price. */
  projectedCollateralValue: number;
  /** Net Equity — F-004, using the projected (grown) debt. */
  projectedEquity: number;
  /** Health Factor — F-022, using the projected (grown) debt. */
  projectedHealthFactor: number;
}

/**
 * Interest Scenario Simulation — 06_TASKS.md M2-020 ("Implement Interest
 * Scenario Simulation"). Formally depends on M2-014 ("Variable Rate
 * Projection", blocked — see PROJECT_STATUS.md conflict #7), but its own
 * "Projected debt" sub-item does not need variable-rate/compound
 * projection: it is satisfied by F-033 "Debt Growth" (Future Debt =
 * Current Debt + Accrued Interest), an explicitly simple, single-constant-
 * rate equation, using the already-implemented simple-interest chain
 * (F-030/M2-012, generalized to an arbitrary day count) for "Accrued
 * Interest". Same task-dependency-graph-inconsistency pattern as M2-017's
 * unsatisfied dependency on M2-013 (Batch 5) — the formal M2-014
 * dependency remains unsatisfied, so this task is Partial, not Done.
 *
 * Satisfies the DoD ("price and interest assumptions can be combined in
 * one deterministic scenario") by accepting the same `PriceScenarioInput`
 * shape M2-019 uses (resolved via F-051) alongside the time horizon and
 * rate: BTC price movement and debt growth from interest are applied
 * together in a single call, sharing scenario resolution rather than
 * requiring two separate function calls.
 */
export function simulateInterestScenario(
  params: InterestScenarioParams,
): FormulaResult<InterestScenarioResult> {
  const options = {
    formulaId: FORMULA_ID,
    formulaVersion: FORMULA_VERSION,
    inputsUsed: { ...params },
  };

  const { portfolio, priceScenario, timeHorizonDays, borrowApr } = params;

  const scenarioPriceResult = resolveScenarioPrice(portfolio.market.btcPriceUsd, priceScenario);
  if (!scenarioPriceResult.ok) return createFailure(scenarioPriceResult.error, options);

  const scenarioMarket = { btcPriceUsd: scenarioPriceResult.value };

  const projectedCollateralValueResult = calculateCollateralValue(
    portfolio.collateral,
    scenarioMarket,
  );
  if (!projectedCollateralValueResult.ok)
    return createFailure(projectedCollateralValueResult.error, options);

  const accruedInterestResult = calculateProratedInterest(
    portfolio.debt.balance,
    borrowApr,
    timeHorizonDays,
  );
  if (!accruedInterestResult.ok) return createFailure(accruedInterestResult.error, options);

  // portfolio.debt.balance was already validated above by
  // calculateProratedInterest, and accruedInterest is always non-negative
  // (validated within calculateProratedInterest), so this branch is
  // unreachable given valid inputs; kept for defense in depth.
  const projectedDebtResult = calculateDebtGrowth(
    portfolio.debt.balance,
    accruedInterestResult.value,
  );
  if (!projectedDebtResult.ok) return createFailure(projectedDebtResult.error, options);

  const projectedPortfolio: PortfolioInput = {
    ...portfolio,
    market: scenarioMarket,
    debt: { asset: portfolio.debt.asset, balance: projectedDebtResult.value },
  };

  // projectedPortfolio.collateral and .market were already validated
  // above, and .debt.balance is a sum of two already-non-negative values,
  // so this branch is unreachable given valid inputs; kept for defense in
  // depth.
  const projectedEquityResult = calculateNetWorth(projectedPortfolio);
  if (!projectedEquityResult.ok) return createFailure(projectedEquityResult.error, options);

  const projectedHealthFactorResult = calculateHealthFactor(
    projectedCollateralValueResult.value,
    portfolio.protocol.liquidationThreshold,
    projectedDebtResult.value,
  );
  if (!projectedHealthFactorResult.ok)
    return createFailure(projectedHealthFactorResult.error, options);

  const warnings = [
    ...projectedCollateralValueResult.warnings,
    ...accruedInterestResult.warnings,
    ...projectedDebtResult.warnings,
    ...projectedEquityResult.warnings,
    ...projectedHealthFactorResult.warnings,
  ];

  return createSuccess(
    {
      scenarioBtcPriceUsd: scenarioPriceResult.value,
      accruedInterest: accruedInterestResult.value,
      projectedDebt: projectedDebtResult.value,
      projectedCollateralValue: projectedCollateralValueResult.value,
      projectedEquity: projectedEquityResult.value,
      projectedHealthFactor: projectedHealthFactorResult.value,
    },
    options,
    warnings,
  );
}
