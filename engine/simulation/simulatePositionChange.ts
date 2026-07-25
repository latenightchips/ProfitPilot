import { calculateHealthFactor } from '../health/calculateHealthFactor';
import { calculateLiquidationDistance } from '../liquidation/calculateLiquidationDistance';
import { calculateCollateralValue } from '../portfolio/calculateCollateralValue';
import { calculateDebtValue } from '../portfolio/calculateDebtValue';
import { calculateLoanToValue } from '../portfolio/calculateLoanToValue';
import { calculateNetWorth } from '../portfolio/calculateNetWorth';
import { toDecimal, toOutputNumber } from '../shared/decimal';
import {
  createFailure,
  createSuccess,
  type FormulaResult,
  type FormulaWarning,
} from '../shared/result';
import type { CollateralPosition, DebtPosition, PortfolioInput } from '../shared/types';

const FORMULA_ID = 'F-052';
const FORMULA_VERSION = '1.0';

export interface PositionChangeInput {
  portfolio: PortfolioInput;
  /** BTC quantity change. Positive = "Add collateral", negative = "Withdraw collateral". */
  collateralDelta: number;
  /** Debt balance change. Positive = "Borrow more", negative = "Repay debt". */
  debtDelta: number;
}

/**
 * A portfolio snapshot at one point in time — 02_Formulas.md F-052
 * "Portfolio Projection" ("Every scenario recalculates every metric"),
 * scoped to the same field set 06_TASKS.md M2-019 (Price Scenario
 * Simulation) uses, since M2-021 does not itemize its own output fields
 * and depends on M2-019.
 */
export interface PortfolioSnapshot {
  /** Collateral Value — F-002. */
  collateralValue: number;
  /** Debt Value — F-003. */
  debtValue: number;
  /** Net Equity — F-004. */
  netEquity: number;
  /** Loan-to-Value — F-020. */
  loanToValue: number;
  /** Health Factor — F-022. */
  healthFactor: number;
  /** Distance to Liquidation — F-023. */
  liquidationDistance: number;
}

export interface PositionChangeResult {
  before: PortfolioSnapshot;
  after: PortfolioSnapshot;
}

function computeSnapshot(
  collateral: CollateralPosition,
  debt: DebtPosition,
  portfolio: PortfolioInput,
): FormulaResult<PortfolioSnapshot> {
  const options = {
    formulaId: FORMULA_ID,
    formulaVersion: FORMULA_VERSION,
    inputsUsed: { collateral, debt, market: portfolio.market, protocol: portfolio.protocol },
  };

  const collateralValueResult = calculateCollateralValue(collateral, portfolio.market);
  if (!collateralValueResult.ok) return createFailure(collateralValueResult.error, options);

  const debtValueResult = calculateDebtValue(debt);
  if (!debtValueResult.ok) return createFailure(debtValueResult.error, options);

  const snapshotPortfolio: PortfolioInput = { ...portfolio, collateral, debt };

  // collateral and debt were already validated above (via
  // collateralValueResult and debtValueResult), so this branch is
  // unreachable given valid inputs; kept for defense in depth.
  const netEquityResult = calculateNetWorth(snapshotPortfolio);
  if (!netEquityResult.ok) return createFailure(netEquityResult.error, options);

  // debtValueResult.value and collateralValueResult.value are already
  // proven-valid non-negative numbers; unreachable given valid inputs,
  // kept for defense in depth.
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

  // If portfolio.protocol.liquidationThreshold were invalid, the
  // calculateHealthFactor call above (identical threshold argument) would
  // already have failed and returned first; unreachable given valid
  // inputs, kept for defense in depth.
  const liquidationDistanceResult = calculateLiquidationDistance(
    collateralValueResult.value,
    portfolio.protocol.liquidationThreshold,
    debtValueResult.value,
  );
  if (!liquidationDistanceResult.ok) return createFailure(liquidationDistanceResult.error, options);

  const warnings: FormulaWarning[] = [
    ...collateralValueResult.warnings,
    ...debtValueResult.warnings,
    ...netEquityResult.warnings,
    ...loanToValueResult.warnings,
    ...healthFactorResult.warnings,
    ...liquidationDistanceResult.warnings,
  ];

  return createSuccess(
    {
      collateralValue: collateralValueResult.value,
      debtValue: debtValueResult.value,
      netEquity: netEquityResult.value,
      loanToValue: loanToValueResult.value,
      healthFactor: healthFactorResult.value,
      liquidationDistance: liquidationDistanceResult.value,
    },
    options,
    warnings,
  );
}

/**
 * Collateral and Debt Scenarios — 06_TASKS.md M2-021 ("Implement
 * Collateral and Debt Scenarios").
 *
 * 06_TASKS.md's own "SCENARIO TYPES" list (02_Formulas.md page 7) names
 * "Manual Debt Repayment" and "Additional Collateral" as supported
 * scenario types alongside "BTC Price Change" (M2-019's F-050/F-051), but
 * documents no separate equation for them — they are the same portfolio
 * metrics (F-002/F-003/F-004/F-020/F-022/F-023), recomputed after a
 * change to collateral quantity or debt balance instead of a change to
 * price. A single signed-delta interface handles all five documented
 * sub-bullets without five separate functions:
 *   - "Add collateral": collateralDelta > 0, debtDelta = 0
 *   - "Withdraw collateral": collateralDelta < 0, debtDelta = 0
 *   - "Borrow more": debtDelta > 0, collateralDelta = 0
 *   - "Repay debt": debtDelta < 0, collateralDelta = 0
 *   - "Combined actions": both nonzero, applied together
 * Tagged F-052 "Portfolio Projection" ("every scenario recalculates every
 * metric") as the closest documented match for a generic post-change
 * recalculation, distinct from F-050 which is specifically price-triggered.
 *
 * DoD ("each simulated action returns both before and after portfolio
 * states") is satisfied literally: `before` is the snapshot of the
 * unmodified portfolio, `after` is the snapshot with both deltas applied.
 */
export function simulatePositionChange(
  input: PositionChangeInput,
): FormulaResult<PositionChangeResult> {
  const options = {
    formulaId: FORMULA_ID,
    formulaVersion: FORMULA_VERSION,
    inputsUsed: { ...input },
  };

  const { portfolio, collateralDelta, debtDelta } = input;

  const beforeResult = computeSnapshot(portfolio.collateral, portfolio.debt, portfolio);
  if (!beforeResult.ok) return createFailure(beforeResult.error, options);

  const newCollateralQuantity = toDecimal(portfolio.collateral.quantity).plus(collateralDelta);
  if (newCollateralQuantity.isNegative()) {
    return createFailure(
      {
        code: 'INVALID_COLLATERAL_DELTA',
        message: 'collateralDelta cannot withdraw more collateral than the portfolio holds.',
      },
      options,
    );
  }

  const newDebtBalance = toDecimal(portfolio.debt.balance).plus(debtDelta);
  if (newDebtBalance.isNegative()) {
    return createFailure(
      {
        code: 'INVALID_DEBT_DELTA',
        message: 'debtDelta cannot repay more debt than the portfolio owes.',
      },
      options,
    );
  }

  const afterCollateral: CollateralPosition = {
    asset: portfolio.collateral.asset,
    quantity: toOutputNumber(newCollateralQuantity),
  };
  const afterDebt: DebtPosition = {
    asset: portfolio.debt.asset,
    balance: toOutputNumber(newDebtBalance),
  };

  // afterCollateral.quantity and afterDebt.balance are already guaranteed
  // non-negative (checked above), and portfolio.market/protocol already
  // succeeded via the `before` snapshot; unreachable given valid inputs,
  // kept for defense in depth.
  const afterResult = computeSnapshot(afterCollateral, afterDebt, portfolio);
  if (!afterResult.ok) return createFailure(afterResult.error, options);

  const warnings = [...beforeResult.warnings, ...afterResult.warnings];

  return createSuccess({ before: beforeResult.value, after: afterResult.value }, options, warnings);
}
