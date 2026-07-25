import { toDecimal, toOutputNumber } from '../shared/decimal';
import { createFailure, createSuccess, type FormulaResult } from '../shared/result';
import { validateNonNegative, validatePositive, validateThreshold } from '../validation/validate';

const FORMULA_ID = 'F-040';
const FORMULA_VERSION = '1.0';

/**
 * Target Debt — 02_Formulas.md F-040.
 * Equation: Target Debt = (Collateral × Liquidation Threshold) / Target HF.
 *
 * The identical equation was first needed in Batch 3 as the first term of
 * F-027 "Maximum Additional Debt" (`calculateAdditionalBorrow.ts`,
 * M2-011), where it was kept as a private, non-exported helper — that
 * file's own comment flagged it for promotion to a shared public F-040
 * implementation "when M2-023 is reached," following the F-012/F-021
 * pattern from `calculateBorrowCapacity.ts`. This is that promotion:
 * `calculateAdditionalBorrow` now calls this function instead of
 * duplicating the equation.
 */
export function calculateTargetDebt(
  collateralValue: number,
  liquidationThreshold: number,
  targetHealthFactor: number,
): FormulaResult<number> {
  const options = {
    formulaId: FORMULA_ID,
    formulaVersion: FORMULA_VERSION,
    inputsUsed: { collateralValue, liquidationThreshold, targetHealthFactor },
  };

  const collateral = validateNonNegative(collateralValue, 'collateralValue');
  if (!collateral.ok) return createFailure(collateral.error, options);

  const threshold = validateThreshold(liquidationThreshold, 'liquidationThreshold');
  if (!threshold.ok) return createFailure(threshold.error, options);

  const targetHf = validatePositive(targetHealthFactor, 'targetHealthFactor');
  if (!targetHf.ok) return createFailure(targetHf.error, options);

  const targetDebt = toDecimal(collateral.value).times(threshold.value).dividedBy(targetHf.value);
  return createSuccess(toOutputNumber(targetDebt), options);
}
