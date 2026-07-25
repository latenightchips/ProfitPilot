import { calculateAnnualInterest } from '../interest/calculateAnnualInterest';
import { createFailure, createSuccess, type FormulaResult } from '../shared/result';
import { calculateBreakEvenAppreciation } from './calculateBreakEvenAppreciation';

const FORMULA_ID = 'F-037';
const FORMULA_VERSION = '1.0';

export interface UnavailableLoopCost {
  item: 'swapFees' | 'slippage' | 'gasEstimate' | 'totalImplementationCost';
  reason: string;
}

export interface LoopCostResult {
  /** Annual Interest — F-032, applied to the strategy's final debt. */
  borrowingInterest: number;
  /** Break-Even BTC Appreciation — F-037. */
  breakEvenAppreciation: number;
  /** Documented M2-017 cost items that are not computed, and why. */
  unavailable: UnavailableLoopCost[];
}

const UNAVAILABLE_COSTS: UnavailableLoopCost[] = [
  {
    item: 'swapFees',
    reason: 'No Formula ID or equation for swap fees exists in 02_Formulas.md.',
  },
  {
    item: 'slippage',
    reason: 'No Formula ID or equation for slippage exists in 02_Formulas.md.',
  },
  {
    item: 'gasEstimate',
    reason: 'No Formula ID or equation for gas estimation exists in 02_Formulas.md.',
  },
  {
    item: 'totalImplementationCost',
    reason:
      'Cannot be honestly totaled while swapFees, slippage, and gasEstimate are undocumented.',
  },
];

/**
 * Loop Cost Calculations — 06_TASKS.md M2-017 (partial; "Include" list is
 * "Borrowing interest / Swap fees / Slippage / Gas estimate / Total
 * implementation cost / Break-even BTC appreciation").
 *
 * M2-017's declared dependency on M2-013 ("compound interest", blocked —
 * see PROJECT_STATUS.md) does not block "Borrowing interest" itself: that
 * sub-item is satisfied by the already-implemented simple-interest chain
 * (F-030-F-032, M2-012), not compound interest. This is flagged in
 * PROJECT_STATUS.md as a task-dependency-graph inconsistency rather than
 * silently ignored.
 *
 * Swap fees, slippage, gas estimate, and total implementation cost have no
 * Formula ID anywhere in 02_Formulas.md, so they are not computed —
 * inventing a fee/slippage/gas model would violate "do not invent
 * formulas or architecture." They are itemized in `unavailable` with the
 * reason each is missing, so the M2-017 DoD's "every cost is itemized" is
 * satisfied for what is documented as unresolved, not silently dropped.
 *
 * Tagged F-037 (Break-Even BTC Appreciation) as its primary Formula ID:
 * it is the only newly-introduced equation here; "Borrowing interest"
 * reuses F-032 and is documented per-field above.
 */
export function calculateLoopCosts(
  finalDebt: number,
  borrowApr: number,
  exposure: number,
): FormulaResult<LoopCostResult> {
  const options = {
    formulaId: FORMULA_ID,
    formulaVersion: FORMULA_VERSION,
    inputsUsed: { finalDebt, borrowApr, exposure },
  };

  const annualInterestResult = calculateAnnualInterest(finalDebt, borrowApr);
  if (!annualInterestResult.ok) return createFailure(annualInterestResult.error, options);

  const breakEvenResult = calculateBreakEvenAppreciation(annualInterestResult.value, exposure);
  if (!breakEvenResult.ok) return createFailure(breakEvenResult.error, options);

  const warnings = [...annualInterestResult.warnings, ...breakEvenResult.warnings];

  return createSuccess(
    {
      borrowingInterest: annualInterestResult.value,
      breakEvenAppreciation: breakEvenResult.value,
      unavailable: UNAVAILABLE_COSTS,
    },
    options,
    warnings,
  );
}
