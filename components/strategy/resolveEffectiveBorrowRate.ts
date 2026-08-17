import { type ApplicationPortfolio, deriveAaveV4EffectiveBorrowRate } from '@/services';

/**
 * V4 Readiness Audit §12 Stage 21. A further copy of the same V3/V4
 * borrow-rate dispatch already established at
 * `features/loop-builder/utils/resolveBorrowRateAssumption.ts` and
 * `features/simulation/utils/resolveEffectiveBorrowRate.ts` — continuing
 * this codebase's deliberate "each consumption boundary owns its own thin
 * copy" convention (see `components/strategy/format.ts`'s own header
 * comment for the same reasoning applied to formatting helpers) rather than
 * introducing a new cross-feature dependency for `components/strategy/`,
 * which Loop Builder, Exit Planner, and Recommendations all import from.
 *
 * **This is the BLENDED, whole-position "effective borrow rate" —
 * `annualCost / totalDebt` — NOT the same quantity as
 * `AaveV4DebtState.baseDrawnApr`** (see
 * `features/simulation/utils/resolveEffectiveBorrowRate.ts`'s own header
 * comment for the full reasoning: `riskPremium` is layered on top of
 * `baseDrawnApr` separately by the Engine, so this blended number already
 * has it folded in). This module is DISPLAY-ONLY inside
 * `StrategyAssumptionsPanel` — never wire its return value into anything
 * that resembles `AaveV4RateStress.baseDrawnApr`.
 *
 * V3 (or unset): the raw `protocol.borrowApr` scalar, unchanged. V4: the
 * canonical rate, `null` (never a fabricated or stale V3 number) when
 * `v4DebtState` has not synced yet or the derivation itself fails.
 */
export function resolveEffectiveBorrowRate(portfolio: ApplicationPortfolio): number | null {
  if (portfolio.protocolVersion !== 'v4') {
    return portfolio.protocol.borrowApr;
  }
  if (portfolio.v4DebtState === undefined) {
    return null;
  }
  const rateStep = deriveAaveV4EffectiveBorrowRate(portfolio.v4DebtState, null, 'manual');
  return rateStep.ok ? rateStep.value : null;
}
