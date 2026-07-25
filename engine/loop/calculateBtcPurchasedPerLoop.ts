import { toDecimal, toOutputNumber } from '../shared/decimal';
import { createFailure, createSuccess, type FormulaResult } from '../shared/result';
import { validateNonNegative, validatePrice } from '../validation/validate';

const FORMULA_ID = 'F-015';
const FORMULA_VERSION = '1.0';

/**
 * BTC Purchased Per Loop — 02_Formulas.md F-015.
 * Equation: BTC Bought = Borrow Amount / BTC Price.
 */
export function calculateBtcPurchasedPerLoop(
  borrowAmount: number,
  btcPriceUsd: number,
): FormulaResult<number> {
  const options = {
    formulaId: FORMULA_ID,
    formulaVersion: FORMULA_VERSION,
    inputsUsed: { borrowAmount, btcPriceUsd },
  };

  const amount = validateNonNegative(borrowAmount, 'borrowAmount');
  if (!amount.ok) return createFailure(amount.error, options);

  const price = validatePrice(btcPriceUsd, 'btcPriceUsd');
  if (!price.ok) return createFailure(price.error, options);

  const btcBought = toDecimal(amount.value).dividedBy(price.value);
  return createSuccess(toOutputNumber(btcBought), options);
}
