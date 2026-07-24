import { toDecimal, toOutputNumber } from '../shared/decimal';
import { createFailure, createSuccess, type FormulaResult } from '../shared/result';
import type { PortfolioInput } from '../shared/types';
import { calculateExposure } from './calculateExposure';
import { calculateNetWorth } from './calculateNetWorth';

const FORMULA_ID = 'F-011';
const FORMULA_VERSION = '1.0';

/**
 * Effective Leverage — 02_Formulas.md F-011.
 * Equation: Effective Leverage = Exposure / Net Worth.
 */
export function calculateEffectiveLeverage(portfolio: PortfolioInput): FormulaResult<number> {
  const options = {
    formulaId: FORMULA_ID,
    formulaVersion: FORMULA_VERSION,
    inputsUsed: { portfolio },
  };

  const exposureResult = calculateExposure(portfolio.collateral, portfolio.market);
  if (!exposureResult.ok) return createFailure(exposureResult.error, options);

  const netWorthResult = calculateNetWorth(portfolio);
  if (!netWorthResult.ok) return createFailure(netWorthResult.error, options);

  const netWorth = toDecimal(netWorthResult.value);
  if (netWorth.isZero()) {
    return createFailure(
      {
        code: 'DIVISION_BY_ZERO',
        message: 'Cannot compute effective leverage: net worth is zero.',
      },
      options,
    );
  }

  const leverage = toDecimal(exposureResult.value).dividedBy(netWorth);
  const warnings = [...exposureResult.warnings, ...netWorthResult.warnings];
  if (netWorth.isNegative()) {
    warnings.push({
      code: 'NEGATIVE_EQUITY',
      message: 'Net worth is negative; the leverage ratio is not meaningful in the usual sense.',
    });
  }

  return createSuccess(toOutputNumber(leverage), options, warnings);
}
