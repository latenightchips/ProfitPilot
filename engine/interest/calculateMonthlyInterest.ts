import { toDecimal, toOutputNumber } from '../shared/decimal';
import { createFailure, createSuccess, type FormulaResult } from '../shared/result';
import { calculateDailyInterest } from './calculateDailyInterest';

const FORMULA_ID = 'F-031';
const FORMULA_VERSION = '1.0';

/**
 * Monthly Interest — 02_Formulas.md F-031.
 * Equation: Monthly Interest = Daily Interest × 30.
 * Reuses calculateDailyInterest (F-030) rather than recomputing it, exactly
 * as the equation is documented.
 */
export function calculateMonthlyInterest(debtValue: number, apr: number): FormulaResult<number> {
  const options = {
    formulaId: FORMULA_ID,
    formulaVersion: FORMULA_VERSION,
    inputsUsed: { debtValue, apr },
  };

  const dailyResult = calculateDailyInterest(debtValue, apr);
  if (!dailyResult.ok) return createFailure(dailyResult.error, options);

  const monthly = toDecimal(dailyResult.value).times(30);
  return createSuccess(toOutputNumber(monthly), options, dailyResult.warnings);
}
