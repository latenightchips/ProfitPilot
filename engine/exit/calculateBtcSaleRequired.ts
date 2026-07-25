import { toDecimal, toOutputNumber } from '../shared/decimal';
import { createFailure, createSuccess, type FormulaResult } from '../shared/result';
import { validateNonNegative, validatePrice } from '../validation/validate';

const FORMULA_ID = 'F-042';
const FORMULA_VERSION = '1.0';

/**
 * BTC Sale Required — 02_Formulas.md F-042.
 * Equation: BTC Sold = Repayment / BTC Price.
 */
export function calculateBtcSaleRequired(
  repayment: number,
  btcPriceUsd: number,
): FormulaResult<number> {
  const options = {
    formulaId: FORMULA_ID,
    formulaVersion: FORMULA_VERSION,
    inputsUsed: { repayment, btcPriceUsd },
  };

  const repaymentValue = validateNonNegative(repayment, 'repayment');
  if (!repaymentValue.ok) return createFailure(repaymentValue.error, options);

  const price = validatePrice(btcPriceUsd, 'btcPriceUsd');
  if (!price.ok) return createFailure(price.error, options);

  const btcSold = toDecimal(repaymentValue.value).dividedBy(price.value);
  return createSuccess(toOutputNumber(btcSold), options);
}
