import { type ApplicationPortfolio, resolveRiskCapacityFraction } from '@/services';

/**
 * BLOCKER #2 fix (V4 Readiness Audit follow-up) — the same "extract one
 * shared derivation so `LoopStrategyControls.tsx`'s default-seeded field
 * and `LoopBuilderPageClient.tsx`'s prop to `LoopPresets.tsx` cannot
 * drift apart" precedent `resolveBorrowRateAssumption.ts` already
 * established for the rate field, applied here to "Maximum LTV."
 *
 * **Root cause this closes**: both call sites previously read
 * `portfolio.protocol.maxLoanToValue` unconditionally, regardless of
 * `protocolVersion`. For a V4 portfolio, that legacy V3 scalar has no
 * defined relationship to the real risk-capacity parameter
 * (`v4CollateralRisk.collateralFactor` — V4 has no separate max-LTV/
 * liquidation-threshold pair, see `services/portfolio/mapping.ts`'s own
 * `resolveRiskCapacityFraction` doc comment). Once that wrong value was
 * seeded as the field's default, `LoopStrategyControls.tsx`'s own
 * (separately fixed) submission discipline could bake it into a
 * permanent `maxLoanToValueOverride`, which `services/loop/strategy.ts`
 * always lets win over the correct dispatched risk-capacity fraction —
 * silently replacing V4's real collateral factor with an unrelated V3
 * number for every downstream loop calculation.
 *
 * **Deliberately NOT a direct call to `resolveRiskCapacityFraction`.**
 * That function returns `protocol.liquidationThreshold` for a V3 (or
 * unset) portfolio — the correct fraction for Health-Factor/liquidation
 * weighting, but the wrong V3 field for this specific "Maximum LTV"
 * input, which has always meant `protocol.maxLoanToValue` (borrow
 * capacity, not liquidation eligibility) for V3, exactly matching
 * `services/loop/strategy.ts`'s own un-overridden V3 baseline
 * (`maxLoanToValue = mappedInput.protocol.maxLoanToValue`). Only the V4
 * branch reuses `resolveRiskCapacityFraction` — for V4 it returns
 * `collateralFactor` regardless, since V4 has no such split at all,
 * matching `strategy.ts`'s own V4 dispatch (`riskCapacityFraction`,
 * assigned to both `maxLoanToValue` and `liquidationThreshold` together).
 *
 * Returns `null` — never a fabricated or stale V3 number — when a V4
 * portfolio has no synced `v4CollateralRisk` yet; callers decide their
 * own display/seed fallback for that case, the same convention
 * `resolveBorrowRateAssumption` already established.
 */
export function resolveMaxLoanToValueAssumption(portfolio: ApplicationPortfolio): number | null {
  if (portfolio.protocolVersion !== 'v4') {
    return portfolio.protocol.maxLoanToValue;
  }
  return resolveRiskCapacityFraction(portfolio);
}
