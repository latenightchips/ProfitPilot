import { toOutputNumber } from '../shared/decimal';
import { createFailure, createSuccess, type FormulaResult } from '../shared/result';
import { validateNonNegative } from '../validation/validate';

const FORMULA_ID = 'F-014';
const FORMULA_VERSION = '1.0';

/**
 * Loop Capital — 02_Formulas.md F-014.
 * Equation: Loop Capital = Borrow Amount.
 *
 * Documented as its own Formula ID even though it is a direct identity: it
 * labels the amount actually borrowed this step as the capital that will
 * be converted to BTC (F-015), matching the LOOP DEPENDENCY GRAPH's
 * Borrow → BTC Purchase sequencing.
 */
export function calculateLoopCapital(borrowAmount: number): FormulaResult<number> {
  const options = {
    formulaId: FORMULA_ID,
    formulaVersion: FORMULA_VERSION,
    inputsUsed: { borrowAmount },
  };

  const amount = validateNonNegative(borrowAmount, 'borrowAmount');
  if (!amount.ok) return createFailure(amount.error, options);

  return createSuccess(toOutputNumber(amount.value), options);
}
