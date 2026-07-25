import { toDecimal, toOutputNumber } from '../shared/decimal';
import { createFailure, createSuccess, type FormulaResult } from '../shared/result';
import { validateNonNegative, validateRate, validateTimePeriod } from '../validation/validate';
import { computeInterestForPeriod } from './calculateDailyInterest';

const FORMULA_ID = 'F-030';
const FORMULA_VERSION = '1.0';

/**
 * Prorated Interest — 06_TASKS.md M2-012's "Prorated interest cost".
 * Uses 02_Formulas.md F-030's exact equation (Debt × APR / 365) for an
 * arbitrary number of days, the same way F-031 "Monthly Interest" is
 * documented as "Daily Interest × 30" — this is that same generalization
 * for a caller-supplied day count rather than a new formula. Tagged F-030
 * since it is that equation, not an invented one.
 *
 * Supports fractional day counts (e.g. 15.5 days), per M2-012's DoD
 * ("Tests cover ... fractional periods").
 */
export function calculateProratedInterest(
  debtValue: number,
  apr: number,
  days: number,
): FormulaResult<number> {
  const options = {
    formulaId: FORMULA_ID,
    formulaVersion: FORMULA_VERSION,
    inputsUsed: { debtValue, apr, days },
  };

  const debt = validateNonNegative(debtValue, 'debtValue');
  if (!debt.ok) return createFailure(debt.error, options);

  const rate = validateRate(apr, 'apr');
  if (!rate.ok) return createFailure(rate.error, options);

  const period = validateTimePeriod(days, 'days');
  if (!period.ok) return createFailure(period.error, options);

  const interest = computeInterestForPeriod(debt.value, rate.value, toDecimal(period.value));
  return createSuccess(toOutputNumber(interest), options);
}
