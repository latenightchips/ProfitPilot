import type { ExecutionCostAssumptions } from '@/engine';
import type { ExecutionCostAssumptionsSettings } from '@/types/portfolio';

/**
 * Resolves a portfolio's own `settings.executionCostAssumptions`
 * (`ExecutionCostAssumptionsSettings` — each field independently
 * optional) into the Engine's `ExecutionCostAssumptions` shape (both
 * rates required numbers) — V4 Readiness Audit §12 P1-6. The single
 * shared implementation both `services/loop/strategy.ts` and
 * `services/exit/plan.ts` call, so "is swap fee/slippage configured for
 * this portfolio" can never drift into two different answers.
 *
 * Returns `undefined` — meaning "not configured, stay frictionless/
 * unavailable" — unless at least one of `swapFeeRate`/`slippageRate` is
 * actually set; a portfolio that configured only `gasCostUsd` must not
 * silently also start reporting a $0 swap-fee/slippage cost it never
 * asked for. Once either rate is set, the other defaults to `0` — the
 * same "omitted rate = 0" convention `resolveEffectiveExecutionRate`
 * (`engine/validation/validate.ts`) already establishes at the Engine
 * layer, applied one layer earlier so the friction already applied to
 * BTC purchased/sold and the dollar cost figures reported for it can
 * never disagree about which rate was "unset."
 */
export function resolveExecutionCostAssumptions(
  settings: ExecutionCostAssumptionsSettings | undefined,
): ExecutionCostAssumptions | undefined {
  if (settings === undefined) return undefined;
  if (settings.swapFeeRate === undefined && settings.slippageRate === undefined) {
    return undefined;
  }
  return {
    swapFeeRate: settings.swapFeeRate ?? 0,
    slippageRate: settings.slippageRate ?? 0,
  };
}
