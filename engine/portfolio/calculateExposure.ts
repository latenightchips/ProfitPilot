import { createFailure, createSuccess, type FormulaResult } from '../shared/result';
import type { CollateralPosition, MarketPrices } from '../shared/types';
import { calculateCollateralValue } from './calculateCollateralValue';

const FORMULA_ID = 'F-010';
const FORMULA_VERSION = '1.0';

/**
 * Exposure — 02_Formulas.md F-010.
 * Equation: Exposure = Total BTC Holdings × BTC Price.
 *
 * Version 1 models a single, fully-collateralized BTC position
 * (01_PRD.md REQ-003), so total BTC holdings equals the collateral
 * quantity, and Exposure is numerically identical to Collateral Value
 * (F-002) under the current scope — reused rather than recomputed. This
 * also serves 06_TASKS.md M2-008's "Effective BTC exposure": with one
 * collateral asset, 100% of exposure is BTC, so no separate calculation
 * exists for it.
 */
export function calculateExposure(
  collateral: CollateralPosition,
  market: MarketPrices,
): FormulaResult<number> {
  const options = {
    formulaId: FORMULA_ID,
    formulaVersion: FORMULA_VERSION,
    inputsUsed: { collateral, market },
    assumptions: [
      'Exposure equals Collateral Value: Version 1 models a single, fully-collateralized BTC position.',
    ],
  };

  const collateralResult = calculateCollateralValue(collateral, market);
  if (!collateralResult.ok) return createFailure(collateralResult.error, options);

  return createSuccess(collateralResult.value, options, collateralResult.warnings);
}
