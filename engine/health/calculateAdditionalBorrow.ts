import { Decimal, toDecimal, toOutputNumber } from '../shared/decimal';
import {
  createFailure,
  createSuccess,
  type FormulaResult,
  type FormulaWarning,
} from '../shared/result';
import { validateNonNegative, validatePositive, validateThreshold } from '../validation/validate';
import { calculateHealthFactor } from './calculateHealthFactor';

const FORMULA_ID = 'F-027';
const FORMULA_VERSION = '1.0';

/**
 * (Collateral × Liquidation Threshold) / Target HF — the first term of
 * 02_Formulas.md F-027 "Maximum Additional Debt". The identical equation is
 * also documented as F-040 "Target Debt" in the Exit Strategy chapter,
 * which belongs to a later Milestone 2 task (M2-023, not yet implemented).
 * Kept private here rather than exposed as a public, F-040-tagged function,
 * to stay scoped to this batch's assigned Formula IDs (M2-011); promote
 * this to a shared public implementation when M2-023 is reached, following
 * the F-012/F-021 pattern from calculateBorrowCapacity.ts.
 */
function computeTargetDebt(
  collateralValue: Decimal,
  liquidationThreshold: Decimal,
  targetHealthFactor: Decimal,
): Decimal {
  return collateralValue.times(liquidationThreshold).dividedBy(targetHealthFactor);
}

/**
 * Maximum Additional Debt — 02_Formulas.md F-027.
 * Equation: Max Additional Debt = ((Collateral × Liquidation Threshold) /
 *   Target HF) − Current Debt.
 *
 * The result is signed: positive means additional safe borrowing is
 * available; negative means debt must be repaid by that amount to reach
 * the target Health Factor. This single implementation serves both
 * 06_TASKS.md M2-011's "Debt repayment required" (negative case) and
 * M2-010's "Debt increase to liquidation" (this function evaluated with
 * targetHealthFactor = 1.0).
 *
 * M2-011's DoD ("every target calculation is verified by recomputing the
 * resulting Health Factor") is satisfied by recomputing Health Factor
 * (F-022) with the resulting debt and confirming it reproduces the target
 * within numerical tolerance; a mismatch attaches a warning rather than
 * silently returning an unverified number.
 */
export function calculateAdditionalBorrow(
  collateralValue: number,
  liquidationThreshold: number,
  currentDebt: number,
  targetHealthFactor: number,
): FormulaResult<number> {
  const options = {
    formulaId: FORMULA_ID,
    formulaVersion: FORMULA_VERSION,
    inputsUsed: { collateralValue, liquidationThreshold, currentDebt, targetHealthFactor },
  };

  const collateral = validateNonNegative(collateralValue, 'collateralValue');
  if (!collateral.ok) return createFailure(collateral.error, options);

  const threshold = validateThreshold(liquidationThreshold, 'liquidationThreshold');
  if (!threshold.ok) return createFailure(threshold.error, options);

  const debt = validateNonNegative(currentDebt, 'currentDebt');
  if (!debt.ok) return createFailure(debt.error, options);

  const targetHf = validatePositive(targetHealthFactor, 'targetHealthFactor');
  if (!targetHf.ok) return createFailure(targetHf.error, options);

  const targetDebt = computeTargetDebt(collateral.value, threshold.value, targetHf.value);
  const additionalDebt = targetDebt.minus(debt.value);

  const warnings: FormulaWarning[] = [];
  const resultingDebt = toDecimal(debt.value).plus(additionalDebt);
  const verification = calculateHealthFactor(
    collateralValue,
    liquidationThreshold,
    toOutputNumber(resultingDebt),
  );
  if (
    !verification.ok ||
    !toDecimal(verification.value).minus(targetHf.value).abs().lessThanOrEqualTo('0.0000001')
  ) {
    warnings.push({
      code: 'TARGET_VERIFICATION_MISMATCH',
      message:
        'Recomputing Health Factor with the resulting debt did not reproduce the target Health Factor.',
    });
  }

  return createSuccess(toOutputNumber(additionalDebt), options, warnings);
}
