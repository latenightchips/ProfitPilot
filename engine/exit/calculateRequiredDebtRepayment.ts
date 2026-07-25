import { toDecimal, toOutputNumber } from '../shared/decimal';
import { createFailure, createSuccess, type FormulaResult } from '../shared/result';
import { validateNonNegative } from '../validation/validate';

const FORMULA_ID = 'F-041';
const FORMULA_VERSION = '1.0';

/**
 * Required Debt Repayment — 02_Formulas.md F-041.
 * Equation: Repayment = max(0, Current Debt − Target Debt).
 */
export function calculateRequiredDebtRepayment(
  currentDebt: number,
  targetDebt: number,
): FormulaResult<number> {
  const options = {
    formulaId: FORMULA_ID,
    formulaVersion: FORMULA_VERSION,
    inputsUsed: { currentDebt, targetDebt },
  };

  const debt = validateNonNegative(currentDebt, 'currentDebt');
  if (!debt.ok) return createFailure(debt.error, options);

  const target = validateNonNegative(targetDebt, 'targetDebt');
  if (!target.ok) return createFailure(target.error, options);

  const repayment = toDecimal(debt.value).minus(target.value);
  return createSuccess(toOutputNumber(repayment.isNegative() ? toDecimal(0) : repayment), options);
}
