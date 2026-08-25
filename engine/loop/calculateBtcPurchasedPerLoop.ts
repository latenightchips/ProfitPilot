import { toDecimal, toOutputNumber } from '../shared/decimal';
import { createFailure, createSuccess, type FormulaResult } from '../shared/result';
import type { ExecutionCostAssumptions } from '../shared/types';
import {
  resolveEffectiveExecutionRate,
  validateNonNegative,
  validatePrice,
} from '../validation/validate';

const FORMULA_ID = 'F-070';
const FORMULA_VERSION = '1.0';

/**
 * Effective BTC Purchased After Execution Friction — 02_Formulas.md F-070
 * (V4 Readiness Audit §12 P1-5).
 *
 * Equation: Effective Rate = (1 - Swap Fee Rate) x (1 - Slippage Rate);
 * Effective Notional = Borrow Amount x Effective Rate; BTC Purchased =
 * Effective Notional / BTC Price.
 *
 * **Generalizes F-015** ("BTC Bought = Borrow Amount / BTC Price") —
 * `assumptions` is optional; when omitted, or when both rates are exactly
 * zero, `resolveEffectiveExecutionRate` returns Effective Rate exactly
 * `1`, Effective Notional is exactly Borrow Amount, and this reduces
 * byte-for-byte to F-015's own equation. Every existing caller that does
 * not supply execution-cost assumptions is mathematically unaffected —
 * this is the same function, at the same call sites, not a parallel cost
 * subsystem. No separate F-015-tagged code path exists any more; see
 * `tests/fixtures/formulaCoverage.ts`'s own F-015 entry and
 * 02_Formulas.md's "Generalizes F-015" note for F-070.
 *
 * The Effective Rate composition itself (multiplicative, not additive) is
 * NOT reproduced here — `resolveEffectiveExecutionRate`
 * (`engine/validation/validate.ts`) is the single shared implementation
 * F-071 also calls, per 02_Formulas.md's own "RATE COMPOSITION" section.
 */
export function calculateBtcPurchasedPerLoop(
  borrowAmount: number,
  btcPriceUsd: number,
  assumptions?: ExecutionCostAssumptions,
): FormulaResult<number> {
  const options = {
    formulaId: FORMULA_ID,
    formulaVersion: FORMULA_VERSION,
    inputsUsed: { borrowAmount, btcPriceUsd, assumptions },
  };

  const amount = validateNonNegative(borrowAmount, 'borrowAmount');
  if (!amount.ok) return createFailure(amount.error, options);

  const price = validatePrice(btcPriceUsd, 'btcPriceUsd');
  if (!price.ok) return createFailure(price.error, options);

  const effectiveRate = resolveEffectiveExecutionRate(assumptions);
  if (!effectiveRate.ok) return createFailure(effectiveRate.error, options);

  const effectiveNotional = toDecimal(amount.value).times(effectiveRate.value);
  const btcBought = effectiveNotional.dividedBy(price.value);
  return createSuccess(toOutputNumber(btcBought), options);
}
