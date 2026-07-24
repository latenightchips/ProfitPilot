import { createFailure, createSuccess, type FormulaResult } from '../shared/result';
import type { CollateralPosition, MarketPrices } from '../shared/types';
import { calculateCollateralValue } from './calculateCollateralValue';

const FORMULA_ID = 'F-001';
const FORMULA_VERSION = '1.0';

/**
 * Portfolio Value — 02_Formulas.md F-001.
 * Equation: Portfolio Value = Σ(Asset Amount × Asset Price).
 *
 * Version 1 models exactly one asset class — a single collateralized BTC
 * position (01_PRD.md REQ-003) — so Portfolio Value is numerically
 * identical to Collateral Value (F-002) under the current scope. Kept as
 * its own function, reusing calculateCollateralValue rather than
 * duplicating the multiplication, both for Formula ID traceability
 * (06_TASKS.md M2-032) and because the two concepts diverge once
 * non-collateralized holdings are modeled.
 */
export function calculatePortfolioValue(
  collateral: CollateralPosition,
  market: MarketPrices,
): FormulaResult<number> {
  const options = {
    formulaId: FORMULA_ID,
    formulaVersion: FORMULA_VERSION,
    inputsUsed: { collateral, market },
    assumptions: [
      'Portfolio Value equals Collateral Value: Version 1 models a single ' +
        'collateralized BTC position with no separate uncollateralized holdings.',
    ],
  };

  const collateralResult = calculateCollateralValue(collateral, market);
  if (!collateralResult.ok) return createFailure(collateralResult.error, options);

  return createSuccess(collateralResult.value, options, collateralResult.warnings);
}
