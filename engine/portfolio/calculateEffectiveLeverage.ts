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
 *
 * **Zero exposure with zero net worth (V1.1 Batch 4 — Full-Exit /
 * Zero-State Robustness)** — a fully exited, empty portfolio (zero
 * collateral, zero debt) has zero exposure AND zero net worth
 * simultaneously; the ratio is genuinely 0/0, not "undefined because a
 * position with real exposure happens to have no net worth left." Follows
 * the exact same zero/zero-vs-nonzero/zero split `calculateLoanToValue`
 * (F-020) and `calculateDebtRatio` (F-006) already establish for the
 * analogous zero-denominator case, rather than failing closed on a state
 * that is fully valid and, elsewhere in this same Engine
 * (`calculateHealthFactor`'s zero-debt case, `calculateLoanToValue`
 * itself), already treated as representable. Any OTHER zero-net-worth
 * case (real exposure remains but net worth has been driven to exactly
 * zero — the position is at the edge of insolvency) still fails closed:
 * leverage is genuinely undefined there, not 0.
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

  const exposure = toDecimal(exposureResult.value);
  const netWorth = toDecimal(netWorthResult.value);
  const warnings = [...exposureResult.warnings, ...netWorthResult.warnings];

  if (netWorth.isZero()) {
    if (exposure.isZero()) {
      return createSuccess(0, options, [
        ...warnings,
        {
          code: 'ZERO_EXPOSURE_ZERO_NET_WORTH',
          message: 'No exposure and no net worth: effective leverage is 0.',
        },
      ]);
    }
    return createFailure(
      {
        code: 'DIVISION_BY_ZERO',
        message: 'Cannot compute effective leverage: net worth is zero.',
      },
      options,
    );
  }

  const leverage = exposure.dividedBy(netWorth);
  if (netWorth.isNegative()) {
    warnings.push({
      code: 'NEGATIVE_EQUITY',
      message: 'Net worth is negative; the leverage ratio is not meaningful in the usual sense.',
    });
  }

  return createSuccess(toOutputNumber(leverage), options, warnings);
}
