import { toDecimal, toOutputNumber } from '../shared/decimal';
import { createFailure, createSuccess, type FormulaResult } from '../shared/result';
import { validateNonNegative } from '../validation/validate';

const FORMULA_ID = 'F-033';
const FORMULA_VERSION = '1.0';

/**
 * Debt Growth — 02_Formulas.md F-033.
 * Equation: Future Debt = Current Debt + Accrued Interest.
 *
 * F-033 is explicitly simple (non-compounding): its own text ends with
 * "Future versions may support continuous compounding," meaning the
 * current version's "debt growth" is exactly this addition. This is the
 * same equation identified in the Batch 4 finding as the closest
 * documented match for "projected debt balance," there left unassigned
 * because M2-013 (which would have used it) is scoped to compound
 * interest. M2-020's "Projected debt" is the correct home for it — see
 * PROJECT_STATUS.md.
 */
export function calculateDebtGrowth(
  currentDebt: number,
  accruedInterest: number,
): FormulaResult<number> {
  const options = {
    formulaId: FORMULA_ID,
    formulaVersion: FORMULA_VERSION,
    inputsUsed: { currentDebt, accruedInterest },
  };

  const debt = validateNonNegative(currentDebt, 'currentDebt');
  if (!debt.ok) return createFailure(debt.error, options);

  const interest = validateNonNegative(accruedInterest, 'accruedInterest');
  if (!interest.ok) return createFailure(interest.error, options);

  const futureDebt = toDecimal(debt.value).plus(interest.value);
  return createSuccess(toOutputNumber(futureDebt), options);
}
