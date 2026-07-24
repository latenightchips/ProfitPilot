import { Decimal, toDecimal, toOutputNumber } from '../shared/decimal';
import { createFailure, createSuccess, type FormulaResult } from '../shared/result';
import { validateNonNegative, validatePercentage } from '../validation/validate';

const FORMULA_VERSION = '1.0';

/**
 * 02_Formulas.md documents the same equation twice under two Formula IDs,
 * in two different chapters:
 *   F-012 "Borrow Capacity" (Leverage & Loop Mathematics)
 *   F-021 "Maximum Borrow Limit" (Aave Risk Mathematics)
 * Both: Collateral Value × Maximum LTV. One computational core here;
 * calculateBorrowCapacity and calculateMaximumBorrowLimit below are thin,
 * correctly-Formula-ID-tagged wrappers around it — README.md "Every
 * calculation must exist only once."
 */
function computeBorrowCapacity(collateralValue: Decimal, maxLoanToValue: Decimal): Decimal {
  return collateralValue.times(maxLoanToValue);
}

function validateBorrowCapacityInputs(collateralValue: number, maxLoanToValue: number) {
  const collateral = validateNonNegative(collateralValue, 'collateralValue');
  if (!collateral.ok) return collateral;

  const maxLtv = validatePercentage(maxLoanToValue, 'maxLoanToValue');
  if (!maxLtv.ok) return maxLtv;

  return { ok: true as const, value: { collateral: collateral.value, maxLtv: maxLtv.value } };
}

/** Borrow Capacity — 02_Formulas.md F-012. */
export function calculateBorrowCapacity(
  collateralValue: number,
  maxLoanToValue: number,
): FormulaResult<number> {
  const options = {
    formulaId: 'F-012',
    formulaVersion: FORMULA_VERSION,
    inputsUsed: { collateralValue, maxLoanToValue },
  };
  const inputs = validateBorrowCapacityInputs(collateralValue, maxLoanToValue);
  if (!inputs.ok) return createFailure(inputs.error, options);
  const capacity = computeBorrowCapacity(inputs.value.collateral, inputs.value.maxLtv);
  return createSuccess(toOutputNumber(capacity), options);
}

/** Maximum Borrow Limit — 02_Formulas.md F-021. Same equation as F-012; see module note above. */
export function calculateMaximumBorrowLimit(
  collateralValue: number,
  maxLoanToValue: number,
): FormulaResult<number> {
  const options = {
    formulaId: 'F-021',
    formulaVersion: FORMULA_VERSION,
    inputsUsed: { collateralValue, maxLoanToValue },
  };
  const inputs = validateBorrowCapacityInputs(collateralValue, maxLoanToValue);
  if (!inputs.ok) return createFailure(inputs.error, options);
  const capacity = computeBorrowCapacity(inputs.value.collateral, inputs.value.maxLtv);
  return createSuccess(toOutputNumber(capacity), options);
}

/**
 * Available Borrow — 02_Formulas.md F-013.
 * Equation: Available Borrow = Borrow Capacity − Current Debt.
 * Reuses calculateBorrowCapacity (F-012) rather than recomputing.
 */
export function calculateAvailableBorrow(
  collateralValue: number,
  maxLoanToValue: number,
  currentDebt: number,
): FormulaResult<number> {
  const options = {
    formulaId: 'F-013',
    formulaVersion: FORMULA_VERSION,
    inputsUsed: { collateralValue, maxLoanToValue, currentDebt },
  };

  const capacityResult = calculateBorrowCapacity(collateralValue, maxLoanToValue);
  if (!capacityResult.ok) return createFailure(capacityResult.error, options);

  const debt = validateNonNegative(currentDebt, 'currentDebt');
  if (!debt.ok) return createFailure(debt.error, options);

  const available = toDecimal(capacityResult.value).minus(debt.value);
  const warnings = available.isNegative()
    ? [
        {
          code: 'BORROW_CAPACITY_EXCEEDED',
          message: 'Current debt exceeds borrow capacity. No safe borrowing is available.',
        },
      ]
    : [];

  return createSuccess(toOutputNumber(available), options, warnings);
}
