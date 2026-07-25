import { calculateHealthFactor } from '../health/calculateHealthFactor';
import { calculateLiquidationDistance } from '../liquidation/calculateLiquidationDistance';
import { calculateCollateralValue } from '../portfolio/calculateCollateralValue';
import { calculateDebtValue } from '../portfolio/calculateDebtValue';
import { calculateLoanToValue } from '../portfolio/calculateLoanToValue';
import { calculateNetWorth } from '../portfolio/calculateNetWorth';
import { calculatePortfolioValue } from '../portfolio/calculatePortfolioValue';
import { createFailure, createSuccess, type FormulaResult } from '../shared/result';
import type { PortfolioInput } from '../shared/types';
import { calculatePortfolioGain } from './calculatePortfolioGain';
import { type PriceScenarioInput, resolveScenarioPrice } from './resolveScenarioPrice';

const FORMULA_ID = 'F-050';
const FORMULA_VERSION = '1.0';

export interface PriceScenarioParams {
  portfolio: PortfolioInput;
  scenario: PriceScenarioInput;
}

export interface PriceScenarioResult {
  scenarioBtcPriceUsd: number;
  /** Collateral Value — F-002. */
  collateralValue: number;
  /** Debt Value — F-003. Unaffected by a price scenario (stablecoin debt). */
  debtValue: number;
  /** Net Equity — F-004. */
  netEquity: number;
  /** Loan-to-Value — F-020. */
  loanToValue: number;
  /** Health Factor — F-022. */
  healthFactor: number;
  /** Distance to Liquidation — F-023. */
  liquidationDistance: number;
  /** Profit or Loss — F-007, scenario Portfolio Value vs. the current baseline. */
  profitOrLoss: number;
}

/**
 * Price Scenario Simulation — 06_TASKS.md M2-019 ("Implement Price
 * Scenario Simulation"). Realizes 02_Formulas.md F-050 "Price Change
 * Simulation" (recalculate portfolio state after a BTC price movement),
 * composing already-implemented Formula IDs for each of M2-019's
 * documented outputs. F-051 "Percentage Price Movement" is used (via
 * resolveScenarioPrice) to satisfy the DoD's "supports both absolute
 * prices and percentage changes" — both forms resolve to a single
 * absolute price before any other calculation runs.
 *
 * BTC holdings and debt balance are unchanged by a price scenario — only
 * `market.btcPriceUsd` varies — matching F-050's own "Debt: Unchanged"
 * example.
 */
export function simulatePriceScenario(
  params: PriceScenarioParams,
): FormulaResult<PriceScenarioResult> {
  const options = {
    formulaId: FORMULA_ID,
    formulaVersion: FORMULA_VERSION,
    inputsUsed: { ...params },
  };

  const { portfolio, scenario } = params;

  const scenarioPriceResult = resolveScenarioPrice(portfolio.market.btcPriceUsd, scenario);
  if (!scenarioPriceResult.ok) return createFailure(scenarioPriceResult.error, options);

  const scenarioMarket = { btcPriceUsd: scenarioPriceResult.value };

  const collateralValueResult = calculateCollateralValue(portfolio.collateral, scenarioMarket);
  if (!collateralValueResult.ok) return createFailure(collateralValueResult.error, options);

  const debtValueResult = calculateDebtValue(portfolio.debt);
  if (!debtValueResult.ok) return createFailure(debtValueResult.error, options);

  const scenarioPortfolio: PortfolioInput = {
    ...portfolio,
    market: scenarioMarket,
  };

  const netEquityResult = calculateNetWorth(scenarioPortfolio);
  if (!netEquityResult.ok) return createFailure(netEquityResult.error, options);

  const loanToValueResult = calculateLoanToValue(
    debtValueResult.value,
    collateralValueResult.value,
  );
  if (!loanToValueResult.ok) return createFailure(loanToValueResult.error, options);

  const healthFactorResult = calculateHealthFactor(
    collateralValueResult.value,
    portfolio.protocol.liquidationThreshold,
    debtValueResult.value,
  );
  if (!healthFactorResult.ok) return createFailure(healthFactorResult.error, options);

  const liquidationDistanceResult = calculateLiquidationDistance(
    collateralValueResult.value,
    portfolio.protocol.liquidationThreshold,
    debtValueResult.value,
  );
  if (!liquidationDistanceResult.ok) return createFailure(liquidationDistanceResult.error, options);

  // portfolio.collateral was already validated above (via
  // collateralValueResult), and portfolio.market.btcPriceUsd was already
  // validated by resolveScenarioPrice (it validates currentBtcPriceUsd
  // before applying any scenario), so this branch is unreachable given
  // valid inputs; kept for defense in depth.
  const baselinePortfolioValueResult = calculatePortfolioValue(
    portfolio.collateral,
    portfolio.market,
  );
  if (!baselinePortfolioValueResult.ok)
    return createFailure(baselinePortfolioValueResult.error, options);

  // scenarioMarket.btcPriceUsd and portfolio.collateral were already
  // validated above; unreachable given valid inputs, kept for defense in
  // depth.
  const scenarioPortfolioValueResult = calculatePortfolioValue(
    portfolio.collateral,
    scenarioMarket,
  );
  if (!scenarioPortfolioValueResult.ok)
    return createFailure(scenarioPortfolioValueResult.error, options);

  const profitOrLossResult = calculatePortfolioGain(
    scenarioPortfolioValueResult.value,
    baselinePortfolioValueResult.value,
  );
  if (!profitOrLossResult.ok) return createFailure(profitOrLossResult.error, options);

  const warnings = [
    ...collateralValueResult.warnings,
    ...debtValueResult.warnings,
    ...netEquityResult.warnings,
    ...loanToValueResult.warnings,
    ...healthFactorResult.warnings,
    ...liquidationDistanceResult.warnings,
  ];

  return createSuccess(
    {
      scenarioBtcPriceUsd: scenarioPriceResult.value,
      collateralValue: collateralValueResult.value,
      debtValue: debtValueResult.value,
      netEquity: netEquityResult.value,
      loanToValue: loanToValueResult.value,
      healthFactor: healthFactorResult.value,
      liquidationDistance: liquidationDistanceResult.value,
      profitOrLoss: profitOrLossResult.value,
    },
    options,
    warnings,
  );
}
