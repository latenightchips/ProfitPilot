import { toDecimal, toOutputNumber } from '../shared/decimal';
import { createFailure, createSuccess, type FormulaResult } from '../shared/result';
import type { ExecutionCostAssumptions } from '../shared/types';
import { validateExecutionCostRate, validateNonNegative } from '../validation/validate';

const FORMULA_ID = 'F-073';
const FORMULA_VERSION = '1.0';

export interface TotalExecutionCostResult {
  swapFeeCostUsd: number;
  slippageCostUsd: number;
  totalGasCostUsd: number;
  totalExecutionCostUsd: number;
}

/**
 * Total Execution Cost — 02_Formulas.md F-073 (V4 Readiness Audit §12
 * P1-5). Reporting only — see this formula's own "No-Double-Count
 * Invariant" in 02_Formulas.md.
 *
 * Equation: Swap Fee Cost = Notional x Swap Fee Rate; Slippage Cost =
 * Notional x (1 - Swap Fee Rate) x Slippage Rate; Total Execution Cost =
 * Swap Fee Cost + Slippage Cost + Total Gas Cost.
 *
 * **No-Double-Count Invariant, preserved exactly.** F-070/F-071 already
 * apply `Notional x EffectiveRate` once, via
 * `resolveEffectiveExecutionRate`'s own `(1 - swapFeeRate) * (1 -
 * slippageRate)` composition. This function's `swapFeeCostUsd +
 * slippageCostUsd` is algebraically identical to
 * `notionalUsd * (1 - effectiveRate)` — the same friction F-070/F-071
 * already subtracted once — never a second deduction. See
 * 02_Formulas.md's F-073 "Identity Proof" for the full derivation; the
 * `notional * swapFeeRate + notional * (1 - swapFeeRate) * slippageRate`
 * shape below is written to match that proof's own sequential form
 * exactly, not simplified into an equivalent-but-untraceable expression.
 *
 * `notionalUsd` is the Loop context's Borrow Amount, or the Exit
 * context's gross (pre-friction) sale value — whichever the caller
 * already fed into F-070/F-071 for the same strategy. This function does
 * not know or care which; it only requires the identical `swapFeeRate`/
 * `slippageRate` already used for that computation.
 */
export function calculateTotalExecutionCost(
  notionalUsd: number,
  assumptions: ExecutionCostAssumptions,
  totalGasCostUsd: number,
): FormulaResult<TotalExecutionCostResult> {
  const options = {
    formulaId: FORMULA_ID,
    formulaVersion: FORMULA_VERSION,
    inputsUsed: { notionalUsd, assumptions, totalGasCostUsd },
  };

  const notional = validateNonNegative(notionalUsd, 'notionalUsd');
  if (!notional.ok) return createFailure(notional.error, options);

  const swapFeeRate = validateExecutionCostRate(assumptions.swapFeeRate, 'swapFeeRate');
  if (!swapFeeRate.ok) return createFailure(swapFeeRate.error, options);

  const slippageRate = validateExecutionCostRate(assumptions.slippageRate, 'slippageRate');
  if (!slippageRate.ok) return createFailure(slippageRate.error, options);

  const gasCost = validateNonNegative(totalGasCostUsd, 'totalGasCostUsd');
  if (!gasCost.ok) return createFailure(gasCost.error, options);

  const swapFeeCost = notional.value.times(swapFeeRate.value);
  const slippageCost = notional.value
    .times(toDecimal(1).minus(swapFeeRate.value))
    .times(slippageRate.value);
  const totalExecutionCost = swapFeeCost.plus(slippageCost).plus(gasCost.value);

  return createSuccess(
    {
      swapFeeCostUsd: toOutputNumber(swapFeeCost),
      slippageCostUsd: toOutputNumber(slippageCost),
      totalGasCostUsd: toOutputNumber(gasCost.value),
      totalExecutionCostUsd: toOutputNumber(totalExecutionCost),
    },
    options,
  );
}
