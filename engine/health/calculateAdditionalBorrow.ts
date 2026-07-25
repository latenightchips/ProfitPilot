import { calculateTargetDebt } from '../exit/calculateTargetDebt';
import { toDecimal, toOutputNumber } from '../shared/decimal';
import {
  createFailure,
  createSuccess,
  type FormulaResult,
  type FormulaWarning,
} from '../shared/result';
import { validateNonNegative } from '../validation/validate';
import { calculateHealthFactor } from './calculateHealthFactor';

const FORMULA_ID = 'F-027';
const FORMULA_VERSION = '1.0';

/**
 * Maximum Additional Debt — 02_Formulas.md F-027.
 * Equation: Max Additional Debt = ((Collateral × Liquidation Threshold) /
 *   Target HF) − Current Debt.
 *
 * The first term is the same equation as F-040 "Target Debt" (Exit
 * Strategy chapter, M2-023) — reused via `calculateTargetDebt` rather
 * than duplicated, following the F-012/F-021 pattern from
 * `calculateBorrowCapacity.ts`. (Batch 3 originally kept this as a
 * private helper here, scoped to M2-011, with a comment flagging
 * promotion to a shared public F-040 implementation once M2-023 was
 * reached — this is that promotion.)
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

  const debt = validateNonNegative(currentDebt, 'currentDebt');
  if (!debt.ok) return createFailure(debt.error, options);

  const targetDebtResult = calculateTargetDebt(
    collateralValue,
    liquidationThreshold,
    targetHealthFactor,
  );
  if (!targetDebtResult.ok) return createFailure(targetDebtResult.error, options);

  const additionalDebt = toDecimal(targetDebtResult.value).minus(debt.value);

  const warnings: FormulaWarning[] = [];
  const resultingDebt = toDecimal(debt.value).plus(additionalDebt);
  const verification = calculateHealthFactor(
    collateralValue,
    liquidationThreshold,
    toOutputNumber(resultingDebt),
  );
  if (
    !verification.ok ||
    !toDecimal(verification.value).minus(targetHealthFactor).abs().lessThanOrEqualTo('0.0000001')
  ) {
    warnings.push({
      code: 'TARGET_VERIFICATION_MISMATCH',
      message:
        'Recomputing Health Factor with the resulting debt did not reproduce the target Health Factor.',
    });
  }

  return createSuccess(toOutputNumber(additionalDebt), options, warnings);
}
