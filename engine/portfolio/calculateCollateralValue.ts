import { toDecimal, toOutputNumber } from '../shared/decimal';
import { createFailure, createSuccess, type FormulaResult } from '../shared/result';
import type { CollateralPosition, MarketPrices } from '../shared/types';
import { validatePrice, validateTokenQuantity } from '../validation/validate';

const FORMULA_ID = 'F-002';
const FORMULA_VERSION = '1.0';

/**
 * Collateral Value — 02_Formulas.md F-002.
 * Equation: Collateral Value = Collateral Amount × Market Price.
 * Version 1 models a single BTC collateral position — 01_PRD.md REQ-003.
 */
export function calculateCollateralValue(
  collateral: CollateralPosition,
  market: MarketPrices,
): FormulaResult<number> {
  const options = {
    formulaId: FORMULA_ID,
    formulaVersion: FORMULA_VERSION,
    inputsUsed: { collateral, market },
  };

  const quantity = validateTokenQuantity(collateral.quantity, 'collateral.quantity');
  if (!quantity.ok) return createFailure(quantity.error, options);

  const price = validatePrice(market.btcPriceUsd, 'market.btcPriceUsd');
  if (!price.ok) return createFailure(price.error, options);

  const value = toDecimal(quantity.value).times(price.value);
  return createSuccess(toOutputNumber(value), options);
}
