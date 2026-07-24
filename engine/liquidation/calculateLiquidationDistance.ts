import { calculateHealthFactor } from '../health/calculateHealthFactor';
import { toDecimal, toOutputNumber } from '../shared/decimal';
import { createFailure, createSuccess, type FormulaResult } from '../shared/result';

const FORMULA_ID = 'F-023';
const FORMULA_VERSION = '1.0';

/**
 * Distance to Liquidation — 02_Formulas.md F-023.
 * Equation: Distance = Health Factor − 1.0.
 * Reuses calculateHealthFactor (F-022) rather than recomputing it.
 *
 * When Health Factor is infinite (zero debt — see calculateHealthFactor),
 * Distance is also infinite; the same warning is carried through.
 */
export function calculateLiquidationDistance(
  collateralValue: number,
  liquidationThreshold: number,
  debtValue: number,
): FormulaResult<number> {
  const options = {
    formulaId: FORMULA_ID,
    formulaVersion: FORMULA_VERSION,
    inputsUsed: { collateralValue, liquidationThreshold, debtValue },
  };

  const healthFactorResult = calculateHealthFactor(
    collateralValue,
    liquidationThreshold,
    debtValue,
  );
  if (!healthFactorResult.ok) return createFailure(healthFactorResult.error, options);

  const distance = toDecimal(healthFactorResult.value).minus(1);
  return createSuccess(toOutputNumber(distance), options, healthFactorResult.warnings);
}
