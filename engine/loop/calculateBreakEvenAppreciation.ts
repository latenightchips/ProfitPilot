import { toDecimal, toOutputNumber } from '../shared/decimal';
import { createFailure, createSuccess, type FormulaResult } from '../shared/result';
import { validateNonNegative, validatePositive } from '../validation/validate';

const FORMULA_ID = 'F-037';
const FORMULA_VERSION = '1.0';

/**
 * Break-Even BTC Appreciation — 02_Formulas.md F-037.
 * Equation: Required Return = Annual Interest / Exposure.
 *
 * The equation has no "x 100" term (unlike, e.g., F-025 Liquidation
 * Buffer), so this returns a 0-1 decimal (0.0166667, not 1.67) — consistent
 * with 04_BUILD_GUIDE.md's "percentages are decimals throughout the
 * Engine" convention; the doc's own "1.67%" example is that same decimal
 * formatted for display.
 */
export function calculateBreakEvenAppreciation(
  annualInterest: number,
  exposure: number,
): FormulaResult<number> {
  const options = {
    formulaId: FORMULA_ID,
    formulaVersion: FORMULA_VERSION,
    inputsUsed: { annualInterest, exposure },
  };

  const interest = validateNonNegative(annualInterest, 'annualInterest');
  if (!interest.ok) return createFailure(interest.error, options);

  const exposureValue = validatePositive(exposure, 'exposure');
  if (!exposureValue.ok) return createFailure(exposureValue.error, options);

  const requiredReturn = toDecimal(interest.value).dividedBy(exposureValue.value);
  return createSuccess(toOutputNumber(requiredReturn), options);
}
