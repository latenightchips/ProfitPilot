import { toDecimal, toOutputNumber } from '../shared/decimal';
import { createFailure, createSuccess, type FormulaResult } from '../shared/result';
import { validateNonNegative, validateThreshold } from '../validation/validate';

const FORMULA_ID = 'F-022';
const FORMULA_VERSION = '1.0';

/**
 * Health Factor — 02_Formulas.md F-022.
 * Equation: Health Factor = (Collateral Value × Liquidation Threshold) / Debt.
 *
 * Version 1 models a single collateral position, so "Collateral Value" here
 * is directly the already-computed value from calculateCollateralValue
 * (F-002) — there is no separate "weighted liquidation threshold" or
 * "adjusted collateral value" (06_TASKS.md M2-009) to compute, since both
 * only apply to multi-collateral portfolios, which are out of scope
 * (01_PRD.md REQ-003).
 *
 * "Health Factor without debt" (M2-009): with zero debt the equation
 * divides by zero. A zero-debt position carries no liquidation risk at any
 * price, so this returns success with value Infinity and an explanatory
 * warning, satisfying M2-009's "handles zero-debt portfolios safely" DoD.
 * This is a deliberate, documented exception to the global "never return
 * Infinity" rule (01_PRD.md REQ-002 "ERROR HANDLING") — that rule targets
 * accidental unhandled division-by-zero, not this explicitly anticipated,
 * mathematically correct limit.
 */
export function calculateHealthFactor(
  collateralValue: number,
  liquidationThreshold: number,
  debtValue: number,
): FormulaResult<number> {
  const options = {
    formulaId: FORMULA_ID,
    formulaVersion: FORMULA_VERSION,
    inputsUsed: { collateralValue, liquidationThreshold, debtValue },
  };

  const collateral = validateNonNegative(collateralValue, 'collateralValue');
  if (!collateral.ok) return createFailure(collateral.error, options);

  const threshold = validateThreshold(liquidationThreshold, 'liquidationThreshold');
  if (!threshold.ok) return createFailure(threshold.error, options);

  const debt = validateNonNegative(debtValue, 'debtValue');
  if (!debt.ok) return createFailure(debt.error, options);

  if (debt.value.isZero()) {
    return createSuccess(Infinity, options, [
      {
        code: 'NO_DEBT',
        message: 'No debt exists; Health Factor is infinite (no liquidation risk).',
      },
    ]);
  }

  const healthFactor = toDecimal(collateral.value).times(threshold.value).dividedBy(debt.value);
  return createSuccess(toOutputNumber(healthFactor), options);
}
