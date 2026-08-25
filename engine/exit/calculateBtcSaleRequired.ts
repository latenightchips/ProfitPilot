import { toDecimal, toOutputNumber } from '../shared/decimal';
import { createFailure, createSuccess, type FormulaResult } from '../shared/result';
import type { ExecutionCostAssumptions } from '../shared/types';
import {
  resolveEffectiveExecutionRate,
  validateNonNegative,
  validatePrice,
} from '../validation/validate';

const FORMULA_ID = 'F-071';
const FORMULA_VERSION = '1.0';

/**
 * BTC Sale Required After Execution Friction — 02_Formulas.md F-071 (V4
 * Readiness Audit §12 P1-5).
 *
 * Equation: Effective Rate = (1 - Swap Fee Rate) x (1 - Slippage Rate);
 * BTC Sold = Repayment / (BTC Price x Effective Rate).
 *
 * **Generalizes F-042** ("BTC Sold = Repayment / BTC Price") —
 * `assumptions` is optional; when omitted, or when both rates are exactly
 * zero, `resolveEffectiveExecutionRate` returns Effective Rate exactly
 * `1`, and this reduces byte-for-byte to F-042's own equation. Every
 * existing caller that does not supply execution-cost assumptions is
 * mathematically unaffected — this is the same function, at the same call
 * sites, not a parallel cost subsystem. No separate F-042-tagged code
 * path exists any more; see `tests/fixtures/formulaCoverage.ts`'s own
 * F-042 entry and 02_Formulas.md's "Generalizes F-042" note for F-071.
 *
 * `resolveEffectiveExecutionRate` (`engine/validation/validate.ts`)
 * guarantees Effective Rate is strictly greater than zero before this
 * function ever divides by it — never a silent Infinity or NaN.
 */
export function calculateBtcSaleRequired(
  repayment: number,
  btcPriceUsd: number,
  assumptions?: ExecutionCostAssumptions,
): FormulaResult<number> {
  const options = {
    formulaId: FORMULA_ID,
    formulaVersion: FORMULA_VERSION,
    inputsUsed: { repayment, btcPriceUsd, assumptions },
  };

  const repaymentValue = validateNonNegative(repayment, 'repayment');
  if (!repaymentValue.ok) return createFailure(repaymentValue.error, options);

  const price = validatePrice(btcPriceUsd, 'btcPriceUsd');
  if (!price.ok) return createFailure(price.error, options);

  const effectiveRate = resolveEffectiveExecutionRate(assumptions);
  if (!effectiveRate.ok) return createFailure(effectiveRate.error, options);

  const btcSold = toDecimal(repaymentValue.value).dividedBy(
    toDecimal(price.value).times(effectiveRate.value),
  );
  return createSuccess(toOutputNumber(btcSold), options);
}
