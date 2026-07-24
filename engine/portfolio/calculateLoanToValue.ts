import { toDecimal, toOutputNumber } from '../shared/decimal';
import { createFailure, createSuccess, type FormulaResult } from '../shared/result';
import { validateNonNegative } from '../validation/validate';

const FORMULA_ID = 'F-020';
const FORMULA_VERSION = '1.0';

/**
 * Loan-to-Value — 02_Formulas.md F-020.
 * Equation: LTV = Debt / Collateral Value.
 *
 * Takes already-computed Collateral Value (F-002) and Debt Value (F-003)
 * rather than raw portfolio inputs, so it composes with whichever module
 * produced them instead of recomputing — README.md "Every calculation
 * must exist only once."
 */
export function calculateLoanToValue(
  debtValue: number,
  collateralValue: number,
): FormulaResult<number> {
  const options = {
    formulaId: FORMULA_ID,
    formulaVersion: FORMULA_VERSION,
    inputsUsed: { debtValue, collateralValue },
  };

  const debt = validateNonNegative(debtValue, 'debtValue');
  if (!debt.ok) return createFailure(debt.error, options);

  const collateral = validateNonNegative(collateralValue, 'collateralValue');
  if (!collateral.ok) return createFailure(collateral.error, options);

  if (collateral.value.isZero()) {
    if (debt.value.isZero()) {
      return createSuccess(0, options, [
        { code: 'ZERO_COLLATERAL_ZERO_DEBT', message: 'No collateral and no debt: LTV is 0.' },
      ]);
    }
    return createFailure(
      {
        code: 'DIVISION_BY_ZERO',
        message: 'Cannot compute LTV: debt exists with zero collateral value.',
      },
      options,
    );
  }

  const ltv = toDecimal(debt.value).dividedBy(collateral.value);
  return createSuccess(toOutputNumber(ltv), options);
}
