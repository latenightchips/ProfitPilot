import { toDecimal, toOutputNumber } from '../shared/decimal';
import { createFailure, createSuccess, type FormulaResult } from '../shared/result';
import { validateNonNegative, validatePrice, validateThreshold } from '../validation/validate';

const FORMULA_ID = 'F-024';
const FORMULA_VERSION = '1.0';

/**
 * Liquidation Price — 02_Formulas.md F-024.
 * Equation: Liquidation Price = Current BTC Price × Debt /
 *   (Collateral Value × Liquidation Threshold).
 * This is the BTC price at which Health Factor (F-022) reaches exactly 1.0.
 *
 * Edge cases (not explicitly covered by 02_Formulas.md's F-024 text, so
 * handled conservatively as structured failures rather than an invented
 * numeric convention — README.md "ERROR HANDLING"):
 *   - Zero debt: no liquidation is possible at any price, so "the price
 *     that triggers liquidation" doesn't exist.
 *   - Zero collateral with nonzero debt: the denominator is zero.
 */
export function calculateLiquidationPrice(
  currentBtcPrice: number,
  debtValue: number,
  collateralValue: number,
  liquidationThreshold: number,
): FormulaResult<number> {
  const options = {
    formulaId: FORMULA_ID,
    formulaVersion: FORMULA_VERSION,
    inputsUsed: { currentBtcPrice, debtValue, collateralValue, liquidationThreshold },
  };

  const price = validatePrice(currentBtcPrice, 'currentBtcPrice');
  if (!price.ok) return createFailure(price.error, options);

  const debt = validateNonNegative(debtValue, 'debtValue');
  if (!debt.ok) return createFailure(debt.error, options);

  const collateral = validateNonNegative(collateralValue, 'collateralValue');
  if (!collateral.ok) return createFailure(collateral.error, options);

  const threshold = validateThreshold(liquidationThreshold, 'liquidationThreshold');
  if (!threshold.ok) return createFailure(threshold.error, options);

  if (debt.value.isZero()) {
    return createFailure(
      {
        code: 'NOT_APPLICABLE_NO_DEBT',
        message: 'Liquidation price is not defined when there is no debt.',
      },
      options,
    );
  }

  const denominator = toDecimal(collateral.value).times(threshold.value);
  if (denominator.isZero()) {
    return createFailure(
      {
        code: 'DIVISION_BY_ZERO',
        message: 'Cannot compute liquidation price: debt exists with zero effective collateral.',
      },
      options,
    );
  }

  const liquidationPrice = toDecimal(price.value).times(debt.value).dividedBy(denominator);
  return createSuccess(toOutputNumber(liquidationPrice), options);
}
