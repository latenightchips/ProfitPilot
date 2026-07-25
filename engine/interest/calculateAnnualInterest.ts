import { toOutputNumber } from '../shared/decimal';
import { createFailure, createSuccess, type FormulaResult } from '../shared/result';
import { validateNonNegative, validateRate } from '../validation/validate';

const FORMULA_ID = 'F-032';
const FORMULA_VERSION = '1.0';

/**
 * Annual Interest — 02_Formulas.md F-032.
 * Equation: Annual Interest = Debt × APR.
 *
 * This is documented as its own direct equation, not derived from
 * calculateDailyInterest (unlike F-031) — implemented that way to match
 * 02_Formulas.md exactly.
 */
export function calculateAnnualInterest(debtValue: number, apr: number): FormulaResult<number> {
  const options = {
    formulaId: FORMULA_ID,
    formulaVersion: FORMULA_VERSION,
    inputsUsed: { debtValue, apr },
  };

  const debt = validateNonNegative(debtValue, 'debtValue');
  if (!debt.ok) return createFailure(debt.error, options);

  const rate = validateRate(apr, 'apr');
  if (!rate.ok) return createFailure(rate.error, options);

  const annual = debt.value.times(rate.value);
  return createSuccess(toOutputNumber(annual), options);
}
