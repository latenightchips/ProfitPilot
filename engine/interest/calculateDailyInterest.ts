import { Decimal, toDecimal, toOutputNumber } from '../shared/decimal';
import { createFailure, createSuccess, type FormulaResult } from '../shared/result';
import { validateNonNegative, validateRate } from '../validation/validate';

const FORMULA_ID = 'F-030';
const FORMULA_VERSION = '1.0';
const DAYS_PER_YEAR = 365;

/**
 * Debt × APR / 365 × days — 02_Formulas.md F-030's equation, generalized to
 * an arbitrary number of days rather than hardcoded to one. Exported as an
 * internal engine/interest/ utility so calculateDailyInterest (days = 1)
 * and calculateProratedInterest (arbitrary days) share one implementation
 * rather than each computing it themselves — README.md "Every calculation
 * must exist only once." Not part of the curated public Engine API
 * (finalized in M2-031).
 */
function computeInterestForPeriod(debtValue: Decimal, apr: Decimal, days: Decimal): Decimal {
  return debtValue.times(apr).dividedBy(DAYS_PER_YEAR).times(days);
}

/**
 * Daily Interest — 02_Formulas.md F-030.
 * Equation: Daily Interest = Debt × APR / 365.
 */
export function calculateDailyInterest(debtValue: number, apr: number): FormulaResult<number> {
  const options = {
    formulaId: FORMULA_ID,
    formulaVersion: FORMULA_VERSION,
    inputsUsed: { debtValue, apr },
  };

  const debt = validateNonNegative(debtValue, 'debtValue');
  if (!debt.ok) return createFailure(debt.error, options);

  const rate = validateRate(apr, 'apr');
  if (!rate.ok) return createFailure(rate.error, options);

  const interest = computeInterestForPeriod(debt.value, rate.value, toDecimal(1));
  return createSuccess(toOutputNumber(interest), options);
}

export { computeInterestForPeriod };
