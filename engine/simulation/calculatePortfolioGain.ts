import { toDecimal, toOutputNumber } from '../shared/decimal';
import { createFailure, createSuccess, type FormulaResult } from '../shared/result';
import { validateNonNegative } from '../validation/validate';

const FORMULA_ID = 'F-007';
const FORMULA_VERSION = '1.0';

/**
 * Portfolio Gain — 02_Formulas.md F-007 ("FORMULA 007" in the page-1
 * Portfolio Value Mathematics chapter).
 * Equation: Gain = Current Value − Initial Investment.
 *
 * 06_TASKS.md M2-019 lists "Profit or loss" as a required scenario output
 * without citing a Formula ID (no 06_TASKS.md task text ever cites one
 * directly). F-007 is the only documented formula matching that concept:
 * comparing a scenario's portfolio value against a baseline value is
 * exactly F-007's "Current Value − Initial Investment". This refines the
 * Batch 2 finding that F-005-F-008 were unassigned — that check searched
 * for each formula's literal name ("Portfolio Gain" etc.) in
 * `06_TASKS.md`, which never appears there; M2-019 instead uses the
 * plain-English synonym "Profit or loss". See PROJECT_STATUS.md.
 */
export function calculatePortfolioGain(
  currentValue: number,
  initialInvestment: number,
): FormulaResult<number> {
  const options = {
    formulaId: FORMULA_ID,
    formulaVersion: FORMULA_VERSION,
    inputsUsed: { currentValue, initialInvestment },
  };

  const current = validateNonNegative(currentValue, 'currentValue');
  if (!current.ok) return createFailure(current.error, options);

  const initial = validateNonNegative(initialInvestment, 'initialInvestment');
  if (!initial.ok) return createFailure(initial.error, options);

  const gain = toDecimal(current.value).minus(initial.value);
  return createSuccess(toOutputNumber(gain), options);
}
